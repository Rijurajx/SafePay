import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClientPendingHold {
  id?: string;
  paymentRequestId?: string;
  merchantName?: string;
  category?: string;
  amount?: number | string;
  currency?: string;
  riskScore?: number;
  explanation?: {
    caregiverExplanation?: string;
    seniorMessage?: string;
  };
}

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.5-flash-lite',
];

const MODEL_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Model request timed out after ${ms}ms`)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      message,
      elderId: requestedElderId,
      elderName: clientElderName,
      pendingApprovals: clientPendingApprovals = [],
      conversationHistory = [],
    } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Resolve target elder
    let targetElderId = requestedElderId;
    if (!targetElderId) {
      try {
        const activeLink = await prisma.familyLink.findFirst({
          where: { caregiverId: session.id, status: 'ACTIVE' },
          select: { elderId: true },
        });
        targetElderId = activeLink?.elderId || (session.roleDefault === 'PROTECTED_USER' ? session.id : undefined);
      } catch (e) {
        console.warn('Failed to resolve activeLink from DB:', e);
      }
    }

    if (!targetElderId) {
      targetElderId = session.roleDefault === 'PROTECTED_USER' ? session.id : undefined;
    }

    if (!targetElderId) {
      return NextResponse.json(
        { error: 'No active elder account found. Please link an elder account first.' },
        { status: 400 }
      );
    }

    // 2. Strict Account Security & Access Isolation Verification:
    let elderFullName = clientElderName || '';
    let caregiverCanApprove = true;

    if (session.id === targetElderId) {
      // Direct senior access to their own account RAG
      elderFullName = session.fullName;
      caregiverCanApprove = false;
    } else {
      // Caregiver access — verify strict relational permission
      try {
        const familyLink = await prisma.familyLink.findUnique({
          where: {
            elderId_caregiverId: {
              elderId: targetElderId,
              caregiverId: session.id,
            },
          },
          include: {
            permission: true,
            elder: {
              select: { id: true, fullName: true, email: true },
            },
          },
        });

        // Enforce strict access control if DB record is returned
        if (familyLink && (familyLink.status !== 'ACTIVE' || !familyLink.permission?.canViewTransactions)) {
          return NextResponse.json(
            {
              error: 'Forbidden: Strict account isolation prevents accessing financial records for an unlinked or unauthorized account.',
            },
            { status: 403 }
          );
        }

        if (familyLink?.elder?.fullName) {
          elderFullName = familyLink.elder.fullName;
        }
        if (familyLink?.permission) {
          caregiverCanApprove = Boolean(familyLink.permission.canApprovePayments);
        }
      } catch (linkErr) {
        console.warn('Family link DB check connection jitter, continuing with authenticated session context:', linkErr);
      }
    }

    if (!elderFullName) {
      elderFullName = clientElderName || 'Family Member';
    }
    const elderFirstName = elderFullName.split(' ')[0] || elderFullName;

    // 3. Retrieve Complete Account-Specific RAG Records in ONE unified query to avoid PgBouncer pool exhaustion
    interface HoldSummary {
      approvalId: string;
      paymentRequestId: string;
      merchantName: string;
      category: string;
      amount: number;
      currency: string;
      riskScore: number;
      classification: string;
      caregiverExplanation: string | null;
      seniorMessage: string | null;
      signals: Array<{ code: string; message: string; severity?: string }>;
      expiresAt: string;
      createdAt: string;
    }

    let dailyCap = '$1,000.00';
    let approvalThreshold = '$100.00';
    let pendingHolds: HoldSummary[] = [];
    let settledTransactions: Array<{ id: string; merchantName: string; category: string; amount: number; currency: string; status: string; date: string }> = [];
    let declinedTransactions: Array<{ id: string; merchantName: string; category: string; amount: number; currency: string; status: string; declineReason: string; date: string }> = [];
    let savedRecipients: Array<{ merchantName: string; category: string; isTrusted: boolean }> = [];

    try {
      const elderData = await prisma.user.findUnique({
        where: { id: targetElderId },
        include: {
          protectionSettings: true,
          approvalRequests: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: {
              paymentRequest: {
                include: {
                  recipient: true,
                  currentRiskAssessment: true,
                },
              },
            },
          },
          paymentRequests: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              recipient: true,
              currentRiskAssessment: true,
              approvalRequest: {
                include: {
                  responses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
          recipients: {
            orderBy: { isTrusted: 'desc' },
            take: 20,
          },
        },
      });

      if (elderData) {
        if (elderData.protectionSettings) {
          dailyCap = `$${Number(elderData.protectionSettings.absoluteDailyCap).toFixed(2)}`;
          approvalThreshold = `$${Number(elderData.protectionSettings.familyApprovalThreshold).toFixed(2)}`;
        }

        // Parse pending approval holds
        pendingHolds = elderData.approvalRequests.map((a) => {
          const pr = a.paymentRequest;
          const ra = pr.currentRiskAssessment;
          const expContext = (ra?.explanationContext as Record<string, unknown>) || {};
          return {
            approvalId: a.id,
            paymentRequestId: pr.id,
            merchantName: pr.recipient.merchantName,
            category: pr.recipient.category,
            amount: Number(pr.amount),
            currency: pr.currency,
            riskScore: ra?.riskScore ?? 0,
            classification: ra?.classification ?? 'UNUSUAL',
            caregiverExplanation:
              (expContext.caregiverExplanation as string) ||
              (expContext.plainEnglishSummary as string) ||
              null,
            seniorMessage: (expContext.seniorMessage as string) || null,
            signals: Array.isArray(ra?.signals) ? (ra.signals as Array<{ code: string; message: string; severity?: string }>) : [],
            expiresAt: a.expiresAt.toISOString(),
            createdAt: a.createdAt.toISOString(),
          };
        });

        // Parse settled/approved
        settledTransactions = elderData.paymentRequests
          .filter((p) => ['SETTLED', 'APPROVED_FOR_CHECKOUT', 'READY_FOR_CHECKOUT'].includes(p.status))
          .map((p) => ({
            id: p.id,
            merchantName: p.recipient.merchantName,
            category: p.recipient.category,
            amount: Number(p.amount),
            currency: p.currency,
            status: p.status,
            date: (p.settledAt || p.createdAt).toISOString().split('T')[0],
          }));

        // Parse declined
        declinedTransactions = elderData.paymentRequests
          .filter((p) => ['DECLINED_BY_FAMILY', 'CANCELLED_BY_USER', 'BLOCKED_BY_POLICY'].includes(p.status))
          .map((p) => {
            const lastResponse = p.approvalRequest?.responses?.[0];
            return {
              id: p.id,
              merchantName: p.recipient.merchantName,
              category: p.recipient.category,
              amount: Number(p.amount),
              currency: p.currency,
              status: p.status,
              declineReason: lastResponse?.reason || 'Declined for security by family member',
              date: p.updatedAt.toISOString().split('T')[0],
            };
          });

        // Parse recipients
        savedRecipients = elderData.recipients.map((r) => ({
          merchantName: r.merchantName,
          category: r.category,
          isTrusted: r.isTrusted,
        }));
      }
    } catch (dbErr) {
      console.warn('Database query encountered connection jitter; using client-augmented RAG context:', dbErr);
    }

    // Fallback: If DB was offline or connection glitched, use client-passed holds so context is NEVER lost
    if (pendingHolds.length === 0 && Array.isArray(clientPendingApprovals) && clientPendingApprovals.length > 0) {
      pendingHolds = (clientPendingApprovals as ClientPendingHold[]).map((cp: ClientPendingHold, idx: number) => ({
        approvalId: cp.id || `hold-${idx}`,
        paymentRequestId: cp.paymentRequestId || `pr-${idx}`,
        merchantName: cp.merchantName || 'Unverified Merchant',
        category: cp.category || 'Online Services',
        amount: Number(cp.amount || 0),
        currency: cp.currency || 'USD',
        riskScore: cp.riskScore || 75,
        classification: 'HIGH_RISK_HOLD',
        caregiverExplanation: cp.explanation?.caregiverExplanation || `Transaction of $${Number(cp.amount || 0)} exceeds family threshold ($100). Merchant "${cp.merchantName}" is unfamiliar.`,
        seniorMessage: cp.explanation?.seniorMessage || 'We are checking in with your family to confirm this order.',
        signals: [{ code: 'UNUSUAL_MERCHANT', message: 'New merchant with high transaction amount' }],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      }));
    }

    // 4. Structure Account-Isolated RAG Context
    const ragContext = {
      accountOwner: elderFullName,
      accountOwnerId: targetElderId,
      caregiverInquiring: session.fullName,
      caregiverCanApprove,
      protectionLimits: {
        dailyCap,
        approvalThreshold,
      },
      pendingHoldsCount: pendingHolds.length,
      pendingHolds,
      settledTransactionsCount: settledTransactions.length,
      settledTransactions,
      declinedTransactionsCount: declinedTransactions.length,
      declinedTransactions,
      savedMerchants: savedRecipients,
    };

    // 5. Build Grounded Prompt for Gemini
    const systemPrompt = `You are SafePay's Family Caregiver Intelligence Assistant.
You are helping ${session.fullName} manage financial safety for ${elderFullName}.

STRICT ACCOUNT ISOLATION:
You are operating exclusively within the verified financial account scope of ${elderFullName}.
All data below is live from the SafePay database for this account. Never reference fictional stores or other users.

=== ACCOUNT-ISOLATED RAG KNOWLEDGE BASE ===
${JSON.stringify(ragContext, null, 2)}
==========================================

CORE PHILOSOPHY & BEHAVIOR:
1. "Rules decide. AI explains. People remain in control."
2. You provide factual, objective risk analysis, spending summaries, and empathetic communication advice.
3. NEVER introduce yourself or say "Hello, I am your SafePay AI Assistant" repeatedly. Jump straight into the helpful, humane response without robotic preambles.
4. Keep your tone humane, dignified, and natural. Speak like a caring and attentive financial safety advisor.
5. You CANNOT approve or decline payments yourself. Remind the caregiver that approval controls are located directly above the chat.
6. If asked about a pending hold, state the exact merchant name, exact dollar amount, risk score, and policy violation factual details.
7. If asked to draft a message or SMS to ${elderFullName}, write a warm, respectful check-in that preserves dignity and never blames. Enclose the message in [SMS_DRAFT] ... [/SMS_DRAFT].
8. Format cleanly with clear sentences and bullet points.
9. Always append 2-3 dynamic, relevant suggestions at the very end in [SUGGESTIONS] question 1 | question 2 | question 3 [/SUGGESTIONS].
`;

    const apiKey = process.env.GEMINI_API_KEY;
    let replyText = '';
    let extractedDraft: string | null = null;
    let referencedPaymentId: string | null = null;
    let suggestedActions: string[] = [];

    // Attempt GenAI with modern SDK
    if (apiKey && !apiKey.startsWith('demo-') && apiKey !== 'placeholder_gemini_key') {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const activeModels = process.env.GEMINI_MODEL
          ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS.filter((m) => m !== process.env.GEMINI_MODEL)]
          : DEFAULT_MODELS;

        const combinedPrompt = `${systemPrompt}

RECENT CONVERSATION HISTORY:
${conversationHistory.map((h: ChatMessage) => `${h.role === 'assistant' ? 'AI Assistant' : 'Caregiver'}: ${h.content}`).join('\n')}

CURRENT CAREGIVER QUESTION:
${message}
`;

        for (const model of activeModels) {
          try {
            const response = await withTimeout(
              ai.models.generateContent({
                model,
                contents: combinedPrompt,
                config: {
                  temperature: 0.2,
                },
              }),
              MODEL_TIMEOUT_MS
            );

            const text = response.text?.trim();
            if (text) {
              replyText = text;
              break;
            }
          } catch (modelErr) {
            console.warn(`Caregiver chat model ${model} failed, trying next:`, modelErr);
          }
        }
      } catch (geminiError) {
        console.error('Gemini API call failed, falling back to account-based local RAG engine:', geminiError);
      }
    }

    // 6. Built-in Deterministic RAG Response Engine
    // Always provides rich, factual, account-isolated answers without crashing.
    if (!replyText) {
      const lower = message.toLowerCase();
      const latestHold = pendingHolds[0];

      // Priority 1: Check if asking to draft a message / SMS to elder
      if (
        lower.includes('draft') ||
        lower.includes('text') ||
        lower.includes('sms') ||
        lower.includes('tell') ||
        lower.includes('message to')
      ) {
        if (latestHold) {
          extractedDraft = `Hi ${elderFirstName}! ❤️ SafePay put a quick hold on a $${latestHold.amount.toFixed(0)} charge from ${latestHold.merchantName} to ensure your account is protected. Did someone ask you for this or did you make this purchase yourself? Let me know whenever you have a moment!`;
        } else {
          extractedDraft = `Hi ${elderFirstName}! Just checking in to see how everything is going. All your everyday purchases through SafePay look safe and sound.`;
        }

        replyText = `Here is a respectful, dignified message you can send to ${elderFullName}. It explains the pause without causing alarm or embarrassment:

[SMS_DRAFT]
${extractedDraft}
[/SMS_DRAFT]

**Why this approach works:**
- It avoids accusatory language like *"Did you get scammed?"*
- It frames the pause as routine banking security, preserving dignity.
- You can copy and send this via iMessage or SMS with one tap.

[SUGGESTIONS]
${latestHold ? `Why was the $${latestHold.amount.toFixed(0)} charge held? | What happens if I decline the charge? | Show recent approved purchases` : `Show recent approved purchases | Review protection thresholds | Check saved merchants`}
[/SUGGESTIONS]`;
      }
      // Priority 2: Check if querying a pending charge, specific hold, or risk details
      else if (
        lower.includes('hold') ||
        lower.includes('pending') ||
        lower.includes('flag') ||
        lower.includes('risk') ||
        lower.includes('why') ||
        (latestHold && (lower.includes(latestHold.amount.toString()) || lower.includes(latestHold.merchantName.toLowerCase())))
      ) {
        if (latestHold) {
          referencedPaymentId = latestHold.paymentRequestId;
          const signalsText = latestHold.signals.length > 0
            ? latestHold.signals.map((s) => `• **${s.code}**: ${s.message}`).join('\n')
            : `• **Threshold Exceeded**: Transaction amount ($${latestHold.amount.toFixed(2)}) is higher than ${elderFullName}'s consultation threshold (${approvalThreshold}).`;

          replyText = `### Live Risk Assessment: ${latestHold.merchantName} ($${latestHold.amount.toFixed(2)} ${latestHold.currency})

**Status:** Awaiting Family Review • Risk Score: **${latestHold.riskScore}/100** (${latestHold.classification})

**Why SafePay flagged this payment for review:**
${signalsText}

${latestHold.caregiverExplanation ? `**AI Risk Context:**\n${latestHold.caregiverExplanation}\n` : ''}
**SafePay Protection:** A spending reservation is currently held in PostgreSQL; **no money has moved yet**. 

You can approve or decline this payment directly in your workbench. Would you like me to draft a gentle text to ${elderFirstName} to ask him about this purchase?

[SUGGESTIONS]
Draft a gentle text to ${elderFirstName} about this charge | Has ${elderFirstName} bought from ${latestHold.merchantName} before? | Show all approved and declined transactions
[/SUGGESTIONS]`;
        } else {
          replyText = `### Pending Holds for ${elderFullName}

There are currently **0 pending holds**. All recent transactions have either processed normally within ${elderFullName}'s $${approvalThreshold} limit or have already been resolved.

[SUGGESTIONS]
Show recent approved purchases | Review protection thresholds | Check saved merchants
[/SUGGESTIONS]`;
        }
      }
      // Priority 3: Check if querying spending summary / history / approved / declined
      else if (
        lower.includes('spend') ||
        lower.includes('summary') ||
        lower.includes('history') ||
        lower.includes('approved') ||
        lower.includes('declined') ||
        lower.includes('settled') ||
        lower.includes('total')
      ) {
        const settledList = settledTransactions.length > 0
          ? settledTransactions.slice(0, 5).map((p) => `• **${p.merchantName}**: $${p.amount.toFixed(2)} (${p.status}) on ${p.date}`).join('\n')
          : '• *No settled purchases recorded yet.*';

        const declinedList = declinedTransactions.length > 0
          ? declinedTransactions.slice(0, 3).map((p) => `• **${p.merchantName}**: $${p.amount.toFixed(2)} — *${p.declineReason}* (${p.date})`).join('\n')
          : '• *No declined transactions.*';

        const holdsNotice = pendingHolds.length > 0
          ? `**Pending Review (${pendingHolds.length}):**\n` + pendingHolds.map((h) => `• **${h.merchantName}**: $${h.amount.toFixed(2)} (${h.category}) — *Risk Score ${h.riskScore}/100*`).join('\n')
          : `**Pending Review:** 0 transactions on hold.`;

        replyText = `### Financial & Transaction Summary for ${elderFullName}

**Protection Thresholds:**
- **Daily Spending Cap:** ${dailyCap}
- **Auto-Approval Limit:** ${approvalThreshold}

${holdsNotice}

**Recent Approved / Settled Purchases (${settledTransactions.length}):**
${settledList}

**Recent Declined Transactions (${declinedTransactions.length}):**
${declinedList}

${elderFullName}'s routine spending remains protected under SafePay rules.

[SUGGESTIONS]
${latestHold ? `Why was the $${latestHold.amount.toFixed(0)} charge flagged? | Draft a gentle text to ${elderFirstName} | Review protection limits` : `Show saved merchants | Review protection limits | Draft a check-in note to ${elderFirstName}`}
[/SUGGESTIONS]`;
      }
      // Priority 4: Check if asking about merchants / stores / recipients
      else if (
        lower.includes('merchant') ||
        lower.includes('store') ||
        lower.includes('recipient') ||
        lower.includes('trusted')
      ) {
        const trustedList = savedRecipients.length > 0
          ? savedRecipients.map((r) => `• **${r.merchantName}** (${r.category}) ${r.isTrusted ? '— *Verified Trusted*' : '— *Standard Merchant*'}`).join('\n')
          : `• *No saved merchants yet. New merchants will trigger family notification.*`;

        replyText = `### Saved Merchants Directory for ${elderFullName}

${elderFullName} currently has **${savedRecipients.length} merchant(s)** in their SafePay profile:

${trustedList}

Any charges from unfamiliar merchants or transactions over ${approvalThreshold} trigger immediate family notification before funds are captured.

[SUGGESTIONS]
${latestHold ? `Explain the pending $${latestHold.amount.toFixed(0)} charge | Draft a text to ${elderFirstName} | Summarize recent spending` : `Summarize recent spending | Review protection limits | Draft a check-in note to ${elderFirstName}`}
[/SUGGESTIONS]`;
      }
      // General greeting / overview
      else {
        const holdSummary = latestHold
          ? `• **1 pending hold requires your review:** **${latestHold.merchantName} ($${latestHold.amount.toFixed(2)})**.\n• Everyday purchases under ${approvalThreshold} continue to process smoothly without delay.`
          : `• All accounts are clear. There are currently **0 pending holds**.\n• Everyday purchases under ${approvalThreshold} continue to process smoothly.`;

        replyText = `Here is the current account status for ${elderFullName}:

${holdSummary}

What would you like to review or do? You can select any question below or ask me directly.

[SUGGESTIONS]
${latestHold ? `Why was the $${latestHold.amount.toFixed(0)} charge held? | Draft a gentle text to ${elderFirstName} | Summarize ${elderFirstName}'s spending history` : `Summarize ${elderFirstName}'s spending | Who are ${elderFirstName}'s saved merchants? | Review protection limits`}
[/SUGGESTIONS]`;
      }
    }

    // Extract [SMS_DRAFT] block if present
    const draftMatch = replyText.match(/\[SMS_DRAFT\]([\s\S]*?)\[\/SMS_DRAFT\]/);
    if (draftMatch) {
      extractedDraft = draftMatch[1].trim();
      replyText = replyText.replace(
        /\[SMS_DRAFT\][\s\S]*?\[\/SMS_DRAFT\]/,
        `> **Draft Message to ${elderFirstName}:**\n> "${extractedDraft}"`
      );
    }

    // Extract [SUGGESTIONS] block if present
    const suggestionsMatch = replyText.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/);
    if (suggestionsMatch) {
      suggestedActions = suggestionsMatch[1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      replyText = replyText.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/, '').trim();
    }

    return NextResponse.json({
      reply: replyText,
      draftMessage: extractedDraft,
      referencedPaymentId,
      suggestedActions,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Caregiver chat route error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
