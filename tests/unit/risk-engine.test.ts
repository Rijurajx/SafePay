import { describe, it, expect } from 'vitest';
import { evaluateTransactionRisk } from '@/lib/risk/engine';
import { RiskClassification, PaymentRequestStatus } from '@prisma/client';

describe('Milestone 2: Deterministic Risk Engine Unit Tests', () => {
  const defaultProtectionSettings = {
    absoluteTransactionCap: 500.0,
    absoluteDailyCap: 1000.0,
    familyApprovalThreshold: 100.0,
    requireFamilyForNewRecipient: true,
    requireFamilyForUnusual: true,
  };

  const defaultBaseline = {
    version: 1,
    medianTransaction: 45.0,
    madTransaction: 15.0,
    usualStartHour: 8,
    usualEndHour: 22,
  };

  const trustedMerchant = {
    id: 'rec-1',
    merchantCode: 'trader-joes',
    merchantName: "Trader Joe's",
    category: 'Groceries',
    isTrusted: true,
    firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    lastPaidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  };

  const newMerchant = {
    id: 'rec-2',
    merchantCode: 'new-tech-gadgets',
    merchantName: 'New Tech Gadgets',
    category: 'Electronics',
    isTrusted: false,
    firstSeenAt: new Date(),
    lastPaidAt: null,
  };

  it('evaluates normal routine grocery purchase as NORMAL and auto-approved', () => {
    const result = evaluateTransactionRisk({
      amount: 42.5,
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 14, 0), // 2:00 PM
    });

    expect(result.classification).toBe(RiskClassification.NORMAL);
    expect(result.requiresFamilyApproval).toBe(false);
    expect(result.status).toBe(PaymentRequestStatus.READY_FOR_CHECKOUT);
    expect(result.riskScore).toBeLessThan(30);
    expect(result.signals).toHaveLength(0);
  });

  it('triggers family approval hold when transaction exceeds family threshold ($100)', () => {
    const result = evaluateTransactionRisk({
      amount: 140.0, // Above $100 threshold
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.requiresFamilyApproval).toBe(true);
    expect(result.status).toBe(PaymentRequestStatus.AWAITING_FAMILY);
    expect(result.classification).toBe(RiskClassification.UNUSUAL);
    expect(result.signals.some((s) => s.code === 'EXCEEDS_FAMILY_THRESHOLD')).toBe(true);
  });

  it('flags transaction as POLICY_VIOLATION and BLOCKED when exceeding absolute transaction cap ($500)', () => {
    const result = evaluateTransactionRisk({
      amount: 650.0, // Above $500 cap
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.classification).toBe(RiskClassification.POLICY_VIOLATION);
    expect(result.status).toBe(PaymentRequestStatus.BLOCKED_BY_POLICY);
    expect(result.requiresFamilyApproval).toBe(true);
    expect(result.signals.some((s) => s.code === 'EXCEEDS_ABSOLUTE_CAP')).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(50);
  });

  it('flags transaction when daily cumulative spending exceeds daily cap ($1000)', () => {
    const result = evaluateTransactionRisk({
      amount: 300.0,
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 850.0, // 850 + 300 = 1150 > 1000 cap
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.classification).toBe(RiskClassification.POLICY_VIOLATION);
    expect(result.signals.some((s) => s.code === 'EXCEEDS_DAILY_CAP')).toBe(true);
  });

  it('requires family approval for first-time untrusted merchant', () => {
    const result = evaluateTransactionRisk({
      amount: 35.0, // Under $100, but new merchant
      elderId: 'elder-1',
      recipient: newMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.requiresFamilyApproval).toBe(true);
    expect(result.status).toBe(PaymentRequestStatus.AWAITING_FAMILY);
    expect(result.signals.some((s) => s.code === 'NEW_RECIPIENT')).toBe(true);
  });

  it('flags high statistical variance (Modified Z-score >= 3.5)', () => {
    // Median: 45, MAD: 15.
    // Amount 180: (180 - 45) = 135. Modified Z: 0.6745 * 135 / 15 = 6.07 >= 3.5
    const result = evaluateTransactionRisk({
      amount: 180.0,
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.signals.some((s) => s.code === 'HIGH_VARIANCE_FROM_MEDIAN')).toBe(true);
    const zSignal = result.signals.find((s) => s.code === 'HIGH_VARIANCE_FROM_MEDIAN');
    expect(zSignal?.metadata?.modifiedZ).toBeGreaterThanOrEqual(3.5);
  });

  it('detects anomalous transaction hour outside usual active window (e.g. 2:30 AM)', () => {
    const result = evaluateTransactionRisk({
      amount: 40.0,
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline, // 8 AM - 10 PM
      currentDailySpend: 0,
      transactionTime: new Date(2026, 10, 7, 2, 30), // 2:30 AM
    });

    expect(result.signals.some((s) => s.code === 'UNUSUAL_TIME_OF_DAY')).toBe(true);
  });

  it('detects rapid transaction velocity in short time window', () => {
    const result = evaluateTransactionRisk({
      amount: 45.0,
      elderId: 'elder-1',
      recipient: trustedMerchant,
      protectionSettings: defaultProtectionSettings,
      spendingBaseline: defaultBaseline,
      currentDailySpend: 0,
      recentTransactionsCount: 4, // 4 previous transactions
      transactionTime: new Date(2026, 10, 7, 14, 0),
    });

    expect(result.signals.some((s) => s.code === 'RAPID_SPENDING_VELOCITY')).toBe(true);
  });
});

