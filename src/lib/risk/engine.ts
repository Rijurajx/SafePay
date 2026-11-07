import { Decimal } from '@prisma/client/runtime/library';
import { RiskClassification, PaymentRequestStatus } from '@prisma/client';
import { DeterministicEvaluationResult, RiskSignal } from '@/types';

export const CURRENT_RULES_VERSION = '2.0.0-rules-decide';

export interface EvaluateRiskParams {
  amount: number | Decimal;
  elderId: string;
  recipient: {
    id: string;
    merchantCode: string;
    merchantName: string;
    category: string;
    isTrusted: boolean;
    firstSeenAt: Date;
    lastPaidAt?: Date | null;
  };
  protectionSettings: {
    absoluteTransactionCap: Decimal | number;
    absoluteDailyCap: Decimal | number;
    familyApprovalThreshold: Decimal | number;
    requireFamilyForNewRecipient: boolean;
    requireFamilyForUnusual: boolean;
  };
  spendingBaseline?: {
    version: number;
    medianTransaction: Decimal | number;
    madTransaction: Decimal | number;
    usualStartHour: number;
    usualEndHour: number;
  } | null;
  currentDailySpend?: number;
  recentTransactionsCount?: number;
  transactionTime?: Date;
}

/**
 * Deterministic Risk Engine for SafePay
 * Core philosophy: "Rules decide. Math calculates. AI explains."
 * Never lets an LLM autonomously block or approve financial transactions.
 */
export function evaluateTransactionRisk(params: EvaluateRiskParams): DeterministicEvaluationResult {
  const {
    amount: rawAmount,
    recipient,
    protectionSettings,
    spendingBaseline,
    currentDailySpend = 0,
    recentTransactionsCount = 0,
    transactionTime = new Date(),
  } = params;

  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount.toString());
  const absoluteTransactionCap = Number(protectionSettings.absoluteTransactionCap.toString());
  const absoluteDailyCap = Number(protectionSettings.absoluteDailyCap.toString());
  const familyApprovalThreshold = Number(protectionSettings.familyApprovalThreshold.toString());

  const signals: RiskSignal[] = [];
  let riskScore = 0;
  let hasPolicyViolation = false;
  let hasUnusualSignal = false;
  let requiresFamilyApproval = false;
  let blockingReason: string | undefined;

  // 1. RULE: Absolute Transaction Cap
  if (amount > absoluteTransactionCap) {
    hasPolicyViolation = true;
    requiresFamilyApproval = true;
    riskScore += 50;
    blockingReason = `Amount ($${amount.toFixed(2)}) exceeds absolute transaction limit ($${absoluteTransactionCap.toFixed(2)})`;
    signals.push({
      code: 'EXCEEDS_ABSOLUTE_CAP',
      severity: 'CRITICAL',
      message: blockingReason,
      metadata: { amount, cap: absoluteTransactionCap },
    });
  }

  // 2. RULE: Absolute Daily Cap
  const totalDailyWithCurrent = currentDailySpend + amount;
  if (totalDailyWithCurrent > absoluteDailyCap) {
    hasPolicyViolation = true;
    requiresFamilyApproval = true;
    riskScore += 40;
    const msg = `Daily total ($${totalDailyWithCurrent.toFixed(2)}) exceeds maximum daily budget ($${absoluteDailyCap.toFixed(2)})`;
    if (!blockingReason) blockingReason = msg;
    signals.push({
      code: 'EXCEEDS_DAILY_CAP',
      severity: 'HIGH',
      message: msg,
      metadata: { currentDailySpend, amount, totalDailyWithCurrent, dailyCap: absoluteDailyCap },
    });
  }

  // 3. RULE: Family Approval Threshold
  if (amount > familyApprovalThreshold) {
    requiresFamilyApproval = true;
    hasUnusualSignal = true;
    riskScore += 25;
    signals.push({
      code: 'EXCEEDS_FAMILY_THRESHOLD',
      severity: 'MEDIUM',
      message: `Amount ($${amount.toFixed(2)}) exceeds family notification threshold ($${familyApprovalThreshold.toFixed(2)})`,
      metadata: { amount, threshold: familyApprovalThreshold },
    });
  }

  // 4. RULE: Recipient Familiarity & Trust
  const isFirstTimeMerchant = !recipient.isTrusted && !recipient.lastPaidAt;
  if (isFirstTimeMerchant && protectionSettings.requireFamilyForNewRecipient) {
    requiresFamilyApproval = true;
    hasUnusualSignal = true;
    riskScore += 20;
    signals.push({
      code: 'NEW_RECIPIENT',
      severity: 'MEDIUM',
      message: `First transaction with unverified merchant: "${recipient.merchantName}" (${recipient.category})`,
      metadata: { merchantName: recipient.merchantName, category: recipient.category, isTrusted: recipient.isTrusted },
    });
  }

  // 5. RULE: Adaptive Baseline Statistical Deviation (Modified Z-Score via Median + MAD)
  if (spendingBaseline) {
    const median = Number(spendingBaseline.medianTransaction.toString());
    const rawMad = Number(spendingBaseline.madTransaction.toString());
    // Safe floor for MAD to prevent division by zero in homogenous datasets
    const mad = Math.max(rawMad, 5.0);

    // Modified Z-Score: 0.6745 * (amount - median) / MAD
    const modifiedZ = (0.6745 * (amount - median)) / mad;

    if (modifiedZ >= 3.5 || (median > 0 && amount >= median * 3)) {
      hasUnusualSignal = true;
      if (protectionSettings.requireFamilyForUnusual) {
        requiresFamilyApproval = true;
      }
      const scoreBump = Math.min(30, Math.max(15, Math.round(modifiedZ * 5)));
      riskScore += scoreBump;
      signals.push({
        code: 'HIGH_VARIANCE_FROM_MEDIAN',
        severity: 'MEDIUM',
        message: `Transaction is significantly higher than regular spending (typical median: $${median.toFixed(2)}, variance Z: ${modifiedZ.toFixed(1)})`,
        metadata: { amount, median, mad, modifiedZ: Number(modifiedZ.toFixed(2)) },
      });
    }

    // 6. RULE: Unusual Time-of-Day Check
    const hour = transactionTime.getHours();
    if (hour < spendingBaseline.usualStartHour || hour > spendingBaseline.usualEndHour) {
      hasUnusualSignal = true;
      riskScore += 15;
      signals.push({
        code: 'UNUSUAL_TIME_OF_DAY',
        severity: 'LOW',
        message: `Transaction occurred at ${hour}:00, outside regular active hours (${spendingBaseline.usualStartHour}:00 - ${spendingBaseline.usualEndHour}:00)`,
        metadata: { hour, usualStartHour: spendingBaseline.usualStartHour, usualEndHour: spendingBaseline.usualEndHour },
      });
    }
  }

  // 7. RULE: High Velocity Anomaly Check
  if (recentTransactionsCount >= 3) {
    hasUnusualSignal = true;
    riskScore += 20;
    signals.push({
      code: 'RAPID_SPENDING_VELOCITY',
      severity: 'MEDIUM',
      message: `High frequency: ${recentTransactionsCount + 1} transactions initiated in a short window`,
      metadata: { recentTransactionsCount },
    });
  }

  // Final Classification & Score Normalization
  const normalizedScore = Math.min(100, riskScore);

  let classification: RiskClassification = RiskClassification.NORMAL;
  if (hasPolicyViolation) {
    classification = RiskClassification.POLICY_VIOLATION;
  } else if (hasUnusualSignal || normalizedScore >= 35) {
    classification = RiskClassification.UNUSUAL;
  }

  let status: PaymentRequestStatus = PaymentRequestStatus.READY_FOR_CHECKOUT;
  if (hasPolicyViolation) {
    status = PaymentRequestStatus.BLOCKED_BY_POLICY;
  } else if (requiresFamilyApproval) {
    status = PaymentRequestStatus.AWAITING_FAMILY;
  }

  return {
    classification,
    riskScore: normalizedScore,
    requiresFamilyApproval,
    signals,
    status,
    blockingReason,
    rulesVersion: CURRENT_RULES_VERSION,
    baselineVersion: spendingBaseline?.version,
  };
}

