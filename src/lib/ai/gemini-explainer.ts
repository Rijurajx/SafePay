import { GoogleGenAI } from '@google/genai';
import { GeminiExplanation, RiskSignal } from '@/types';
import { RiskClassification } from '@prisma/client';

export interface ExplanationInput {
  amount: number;
  currency?: string;
  merchantName: string;
  category: string;
  elderName: string;
  classification: RiskClassification;
  signals: RiskSignal[];
  medianSpend?: number;
}

// Lightweight low-latency models used during testing/development to preserve quota and speed up iteration.
// For the final PayPal demo presentation, set GEMINI_MODEL="gemini-3.7-flash" or "gemini-3.5-flash" in .env.
const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite', // Fastest, lowest tier model for rapid local/testing iteration
  'gemini-3.5-flash',
];

const MODEL_TIMEOUT_MS = 3500;

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

/**
 * Generate an empathetic, plain-English financial explanation for family caregivers
 * using Google Gemini AI, adhering to the principle:
 * "Rules decide. AI explains. People remain in control."
 */
export async function generateGeminiRiskExplanation(input: ExplanationInput): Promise<GeminiExplanation> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if no API key is provided
  if (!apiKey || apiKey.startsWith('demo-') || apiKey === 'placeholder') {
    return generateDeterministicFallback(input);
  }

  const { amount, currency = 'USD', merchantName, category, elderName, classification, signals, medianSpend } = input;

  const prompt = `
You are SafePay's Senior Financial Guardian Explainer AI.
SafePay's deterministic policy engine has evaluated this transaction.
Your role is NOT to decide whether to approve or decline. Your job is to EXPLAIN the factual context to the family caregivers (e.g., adult children) in plain, calm English while preserving the senior's (${elderName}'s) dignity and independence.

Transaction Data:
- Senior: ${elderName}
- Merchant: ${merchantName} (Category: ${category})
- Amount: $${amount.toFixed(2)} ${currency}
- Classification: ${classification}
- Regular Median Spending: ${medianSpend ? `$${medianSpend.toFixed(2)}` : 'Unknown'}
- Triggered Risk Signals:
${signals.map((s) => `  * [${s.severity}] ${s.code}: ${s.message}`).join('\n')}

Output requirements:
Return a valid JSON object strictly matching this schema with NO markdown code fences:
{
  "headline": "A single concise summary sentence (max 15 words) for mobile alerts.",
  "plainEnglishSummary": "2 clear sentences explaining why this transaction triggered family review in simple words without financial jargon.",
  "merchantAnalysis": "1-2 sentences on what this merchant is, typical purchases in this category, and whether it's new for the senior.",
  "suggestedQuestions": [
    "A respectful, warm check-in question the caregiver can ask Dad (e.g. 'Hey Dad, did you need help setting up the new tablet?')",
    "A second gentle follow-up question"
  ],
  "seniorMessage": "A warm, non-alarmist message displayed on Dad's screen (e.g. 'We're checking in with Maya & David to confirm this order. We'll update you in just a moment!')"
}
`;

  const ai = new GoogleGenAI({ apiKey });

  const activeModels = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS.filter((m) => m !== process.env.GEMINI_MODEL)]
    : DEFAULT_MODELS;

  for (const model of activeModels) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        MODEL_TIMEOUT_MS
      );

      const text = response.text?.trim();
      if (!text) continue;

      const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      return {
        headline: parsed.headline || `$${amount.toFixed(2)} at ${merchantName} requires family review`,
        plainEnglishSummary: parsed.plainEnglishSummary || `This transaction is higher than ${elderName}'s regular spending and has been held for caregiver confirmation.`,
        merchantAnalysis: parsed.merchantAnalysis || `${merchantName} is categorized under ${category}.`,
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0
          ? parsed.suggestedQuestions
          : [`Hi ${elderName.split(' ')[0]}, did you place an order at ${merchantName}?`],
        seniorMessage: parsed.seniorMessage || `We're checking in with your family to confirm this order. We'll let you know shortly!`,
        modelUsed: model,
        generatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Gemini model ${model} unavailable (${errorMsg.slice(0, 80)}), trying next...`);
    }
  }

  // Graceful fallback if Gemini API is unreachable or rate-limited
  return generateDeterministicFallback(input);
}

/**
 * Deterministic explanation fallback if LLM is offline
 */
export function generateDeterministicFallback(input: ExplanationInput): GeminiExplanation {
  const { amount, merchantName, elderName, signals, medianSpend } = input;
  const firstName = elderName.split(' ')[0] || 'Dad';

  const isDuplicate = signals.some((s) => s.code === 'DUPLICATE_PAYMENT_SUSPECTED');
  const isMonthlyOver = signals.some((s) => s.code === 'EXCEEDS_MONTHLY_BUDGET');
  const isNewMerchant = signals.some((s) => s.code === 'NEW_RECIPIENT');
  const isHighSpend = signals.some((s) => s.code === 'EXCEEDS_FAMILY_THRESHOLD' || s.code === 'HIGH_VARIANCE_FROM_MEDIAN');

  let headline = `$${amount.toFixed(2)} at ${merchantName} needs family confirmation`;
  let plainEnglishSummary = `This $${amount.toFixed(2)} order at ${merchantName} is awaiting caregiver confirmation.`;
  let suggestedQuestions = [
    `"Hi ${firstName}, did you order something from ${merchantName} today?"`,
    `"Let me know if you need any help verifying the order details or delivery address!"`,
  ];
  let seniorMessage = `Checking in with family to confirm this payment — we'll update you in just a moment!`;

  if (isDuplicate) {
    headline = `Potential duplicate charge of $${amount.toFixed(2)} at ${merchantName}`;
    plainEnglishSummary = `An identical charge of $${amount.toFixed(2)} to ${merchantName} was made recently. SafePay placed this transaction on hold to prevent accidental double-billing.`;
    suggestedQuestions = [
      `"Hi ${firstName}, did you intend to place this second order of $${amount.toFixed(2)} with ${merchantName}?"`,
      `"Did the payment screen freeze or reload during checkout?"`,
    ];
    seniorMessage = `We noticed an identical payment to ${merchantName} was made recently. We're double-checking with family so you aren't charged twice!`;
  } else if (isMonthlyOver) {
    headline = `Monthly spending limit reached ($${amount.toFixed(2)} at ${merchantName})`;
    plainEnglishSummary = `This $${amount.toFixed(2)} purchase brings ${firstName}'s monthly total beyond the allocated family budget.`;
    suggestedQuestions = [
      `"Hi ${firstName}, would you like us to increase your monthly spending limit for this purchase?"`,
    ];
    seniorMessage = `This purchase is slightly over this month's budget. We've sent a quick note to family to approve it!`;
  } else if (isNewMerchant && isHighSpend) {
    plainEnglishSummary = `This is ${firstName}'s first purchase at ${merchantName}, and the $${amount.toFixed(2)} total is above the typical $${(medianSpend || 45).toFixed(2)} spending baseline.`;
  } else if (isNewMerchant) {
    plainEnglishSummary = `${firstName} has not ordered from ${merchantName} previously. We've placed it on hold for quick verification.`;
  } else if (isHighSpend) {
    plainEnglishSummary = `The $${amount.toFixed(2)} total exceeds ${firstName}'s usual threshold. Caregivers have been notified for review.`;
  }

  return {
    headline,
    plainEnglishSummary,
    merchantAnalysis: `${merchantName} is categorized under ${input.category || 'general merchandise'}.`,
    suggestedQuestions,
    seniorMessage,
    modelUsed: 'deterministic-fallback',
    generatedAt: new Date().toISOString(),
  };
}
