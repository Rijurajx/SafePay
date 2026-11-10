import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';
import { evaluateTransactionRisk } from '@/lib/risk/engine';
import { generateGeminiRiskExplanation } from '@/lib/ai/gemini-explainer';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditActorType, PaymentRequestStatus, ReservationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      paymentRequestId,
      elderId: requestedElderId,
      amount: inputAmount,
      merchantName: inputMerchantName,
      merchantCode: inputMerchantCode,
      category: inputCategory = 'General Merchandise',
      transactionTime: inputTransactionTime,
    } = body;

    // Resolve target elder intelligently
    let elderId = requestedElderId;
    if (!elderId) {
      if (session.roleDefault === 'PROTECTED_USER') {
        elderId = session.id;
      } else {
        const activeLink = await prisma.familyLink.findFirst({
          where: { caregiverId: session.id, status: 'ACTIVE' },
          select: { elderId: true },
        });
        elderId = activeLink?.elderId || '11111111-1111-4111-a111-111111111111';
      }
    }

    // Authorize access to elder's scope
    const authResult = await authorizeElderDataScope(session, elderId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason || 'Forbidden' }, { status: 403 });
    }

    const elder = await prisma.user.findUnique({
      where: { id: elderId },
      include: {
        protectionSettings: true,
        spendingBaselines: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!elder) {
      return NextResponse.json({ error: 'Elder account not found' }, { status: 404 });
    }

    // Default protection settings if not configured
    const protectionSettings = elder.protectionSettings || {
      absoluteTransactionCap: new Decimal(500.0),
      absoluteDailyCap: new Decimal(1000.0),
      familyApprovalThreshold: new Decimal(100.0),
      requireFamilyForNewRecipient: true,
      requireFamilyForUnusual: true,
      approvalTimeoutMinutes: 30,
      version: 1,
    };

    const latestBaseline = elder.spendingBaselines[0] || null;

    let targetPaymentRequest;
    let recipient;
    let amount: number;

    if (paymentRequestId) {
      // Evaluate an existing PaymentRequest
      targetPaymentRequest = await prisma.paymentRequest.findUnique({
        where: { id: paymentRequestId },
        include: { recipient: true },
      });

      if (!targetPaymentRequest || targetPaymentRequest.elderId !== elderId) {
        return NextResponse.json({ error: 'Payment request not found or unauthorized' }, { status: 404 });
      }

      recipient = targetPaymentRequest.recipient;
      amount = Number(targetPaymentRequest.amount.toString());
    } else {
      // Create or evaluate an ad-hoc or simulated checkout transaction
      if (!inputAmount || Number(inputAmount) <= 0) {
        return NextResponse.json({ error: 'Valid positive amount is required' }, { status: 400 });
      }
      amount = Number(inputAmount);

      const merchantName = inputMerchantName || 'Unknown Store';
      const merchantCode = inputMerchantCode || merchantName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Find or create recipient for elder
      recipient = await prisma.recipient.upsert({
        where: {
          elderId_merchantCode: {
            elderId,
            merchantCode,
          },
        },
        update: {},
        create: {
          elderId,
          merchantCode,
          merchantName,
          category: inputCategory,
          isTrusted: false,
        },
      });

      targetPaymentRequest = await prisma.paymentRequest.create({
        data: {
          elderId,
          recipientId: recipient.id,
          merchantOrderReference: `SAFE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          amount: new Decimal(amount),
          status: PaymentRequestStatus.INITIATED,
          policyVersion: '2.0.0',
          baselineVersion: latestBaseline?.version,
        },
        include: { recipient: true },
      });
    }

    // Calculate current daily spend (settled transactions + active reservations today)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySettled = await prisma.paymentRequest.aggregate({
      where: {
        elderId,
        status: PaymentRequestStatus.SETTLED,
        settledAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const todayReservations = await prisma.spendingReservation.aggregate({
      where: {
        elderId,
        status: ReservationStatus.ACTIVE,
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const currentDailySpend =
      Number(todaySettled._sum.amount?.toString() || 0) +
      Number(todayReservations._sum.amount?.toString() || 0);

    // Calculate current monthly spend
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthSettled = await prisma.paymentRequest.aggregate({
      where: {
        elderId,
        status: PaymentRequestStatus.SETTLED,
        settledAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });
    const currentMonthlySpend = Number(monthSettled._sum.amount?.toString() || 0);

    // Query recent transactions to the same merchant within last 24h for duplicate anomaly detection
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSameMerchantRecords = await prisma.paymentRequest.findMany({
      where: {
        elderId,
        recipientId: recipient.id,
        id: { not: targetPaymentRequest.id },
        createdAt: { gte: twentyFourHoursAgo },
        status: {
          in: [
            PaymentRequestStatus.SETTLED,
            PaymentRequestStatus.AWAITING_FAMILY,
            PaymentRequestStatus.READY_FOR_CHECKOUT,
            PaymentRequestStatus.CHECKOUT_IN_PROGRESS,
            PaymentRequestStatus.INITIATED,
          ],
        },
      },
      select: {
        amount: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentTransactionsSameMerchant = recentSameMerchantRecords.map((r) => ({
      amount: Number(r.amount.toString()),
      createdAt: r.createdAt,
      status: r.status,
    }));

    // Calculate transaction velocity in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentTransactionsCount = await prisma.paymentRequest.count({
      where: {
        elderId,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    // 1. RUN DETERMINISTIC RISK ENGINE
    const deterministicResult = evaluateTransactionRisk({
      amount,
      elderId,
      recipient,
      protectionSettings,
      spendingBaseline: latestBaseline,
      currentDailySpend,
      currentMonthlySpend,
      recentTransactionsCount,
      recentTransactionsSameMerchant,
      transactionTime: inputTransactionTime ? new Date(inputTransactionTime) : new Date(),
    });

    // 2. GENERATE GEMINI AI FINANCIAL EXPLANATION (Only on anomalous / hold-triggered transactions)
    let explanation;
    if (deterministicResult.requiresFamilyApproval) {
      explanation = await generateGeminiRiskExplanation({
        amount,
        merchantName: recipient.merchantName,
        category: recipient.category,
        elderName: elder.fullName,
        classification: deterministicResult.classification,
        signals: deterministicResult.signals,
        medianSpend: latestBaseline ? Number(latestBaseline.medianTransaction.toString()) : undefined,
      });
    } else {
      // Instant deterministic explanation for routine normal transactions
      explanation = {
        headline: `$${amount.toFixed(2)} at ${recipient.merchantName} approved within baseline`,
        plainEnglishSummary: `Routine purchase at ${recipient.merchantName} is within ${elder.fullName}'s regular spending baseline.`,
        merchantAnalysis: `${recipient.merchantName} (${recipient.category}) is recognized and trusted.`,
        suggestedQuestions: [],
        seniorMessage: `Payment approved! Thank you, ${elder.fullName.split(' ')[0]}.`,
        modelUsed: 'deterministic-baseline',
        generatedAt: new Date().toISOString(),
      };
    }

    // 3. PERSIST RISK ASSESSMENT & UPDATE STATE ATOMICALLY
    const [assessment] = await prisma.$transaction([
      prisma.riskAssessment.create({
        data: {
          paymentRequestId: targetPaymentRequest.id,
          classification: deterministicResult.classification,
          riskScore: deterministicResult.riskScore,
          signals: deterministicResult.signals as object,
          rulesVersion: deterministicResult.rulesVersion,
          baselineVersion: deterministicResult.baselineVersion,
          explanationContext: explanation as object,
        },
      }),
      prisma.paymentRequest.update({
        where: { id: targetPaymentRequest.id },
        data: {
          status: deterministicResult.status,
          requiresFamilyApproval: deterministicResult.requiresFamilyApproval,
        },
      }),
    ]);

    // Link as current assessment
    await prisma.paymentRequest.update({
      where: { id: targetPaymentRequest.id },
      data: { currentRiskAssessmentId: assessment.id },
    });

    // If requires family approval, create ApprovalRequest & SpendingReservation
    if (deterministicResult.requiresFamilyApproval) {
      const timeoutMinutes = protectionSettings.approvalTimeoutMinutes || 30;
      const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      await prisma.approvalRequest.upsert({
        where: {
          paymentRequestId_elderId: {
            paymentRequestId: targetPaymentRequest.id,
            elderId,
          },
        },
        update: {
          expiresAt,
          status: 'PENDING',
        },
        create: {
          paymentRequestId: targetPaymentRequest.id,
          elderId,
          expiresAt,
          status: 'PENDING',
        },
      });

      // Place hold in spending reservation
      await prisma.spendingReservation.upsert({
        where: {
          paymentRequestId_elderId: {
            paymentRequestId: targetPaymentRequest.id,
            elderId,
          },
        },
        update: {
          status: ReservationStatus.ACTIVE,
          amount: new Decimal(amount),
        },
        create: {
          paymentRequestId: targetPaymentRequest.id,
          elderId,
          amount: new Decimal(amount),
          status: ReservationStatus.ACTIVE,
        },
      });
    }

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        paymentRequestId: targetPaymentRequest.id,
        actorId: session.id,
        actorType: session.isSynthetic ? AuditActorType.USER : AuditActorType.SYSTEM,
        eventType: 'RISK_EVALUATION_COMPLETED',
        newState: deterministicResult.status,
        metadata: {
          riskScore: deterministicResult.riskScore,
          classification: deterministicResult.classification,
          signalsCount: deterministicResult.signals.length,
          modelUsed: explanation.modelUsed,
        },
      },
    });

    return NextResponse.json({
      assessmentId: assessment.id,
      paymentRequestId: targetPaymentRequest.id,
      classification: deterministicResult.classification,
      riskScore: deterministicResult.riskScore,
      requiresFamilyApproval: deterministicResult.requiresFamilyApproval,
      signals: deterministicResult.signals,
      explanation,
      status: deterministicResult.status,
      blockingReason: deterministicResult.blockingReason,
    });
  } catch (error: unknown) {
    console.error('Error evaluating transaction risk:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
