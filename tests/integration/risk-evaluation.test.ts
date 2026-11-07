import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as evaluateRiskPost } from '@/app/api/risk/evaluate/route';
import { GET as getAssessmentById } from '@/app/api/risk/assessments/[id]/route';
import { DEMO_PERSONAS, createDemoPersonaToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateDeterministicFallback } from '@/lib/ai/gemini-explainer';
import { RiskClassification } from '@prisma/client';

describe('Milestone 2: Risk Evaluation & Gemini Explainer Integration Tests', { timeout: 35000 }, () => {
  const thomasId = DEMO_PERSONAS.thomas.id;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/risk/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 150, merchantName: 'Tech Store' }),
    });

    const res = await evaluateRiskPost(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Authentication required');
  });

  it('evaluates an anomalous $185 purchase for Thomas and creates Gemini explanation + hold', async () => {
    // Authenticate as Maya (Primary Caregiver with view/approval rights)
    const { token } = await createDemoPersonaToken('maya');

    const req = new NextRequest('http://localhost:3000/api/risk/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        elderId: thomasId,
        amount: 185.0,
        merchantName: 'BestElectronics Online',
        category: 'Consumer Electronics',
      }),
    });

    const res = await evaluateRiskPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.assessmentId).toBeDefined();
    expect(data.paymentRequestId).toBeDefined();
    expect(data.requiresFamilyApproval).toBe(true);
    expect(data.status).toBe('AWAITING_FAMILY');
    expect(data.classification).toBe('UNUSUAL');

    // Verify signals
    expect(data.signals.length).toBeGreaterThan(0);
    const signalCodes = data.signals.map((s: { code: string }) => s.code);
    expect(signalCodes).toContain('EXCEEDS_FAMILY_THRESHOLD');

    // Verify Gemini explanation context
    expect(data.explanation).toBeDefined();
    expect(data.explanation.plainEnglishSummary).toBeDefined();
    expect(typeof data.explanation.plainEnglishSummary).toBe('string');
    expect(Array.isArray(data.explanation.suggestedQuestions)).toBe(true);
    expect(data.explanation.suggestedQuestions.length).toBeGreaterThan(0);
    expect(data.explanation.seniorMessage).toBeDefined();

    // Verify Database state
    const savedAssessment = await prisma.riskAssessment.findUnique({
      where: { id: data.assessmentId },
    });
    expect(savedAssessment).not.toBeNull();
    expect(savedAssessment?.classification).toBe('UNUSUAL');

    const savedApproval = await prisma.approvalRequest.findUnique({
      where: {
        paymentRequestId_elderId: {
          paymentRequestId: data.paymentRequestId,
          elderId: thomasId,
        },
      },
    });
    expect(savedApproval).not.toBeNull();
    expect(savedApproval?.status).toBe('PENDING');

    const savedReservation = await prisma.spendingReservation.findUnique({
      where: {
        paymentRequestId_elderId: {
          paymentRequestId: data.paymentRequestId,
          elderId: thomasId,
        },
      },
    });
    expect(savedReservation).not.toBeNull();
    expect(savedReservation?.status).toBe('ACTIVE');
    expect(Number(savedReservation?.amount.toString())).toBe(185.0);
  });

  it('allows Sarah (View-Only Caregiver) to query the created risk assessment', async () => {
    // 1. Get Maya to evaluate a transaction
    const { token: mayaToken } = await createDemoPersonaToken('maya');
    const evalReq = new NextRequest('http://localhost:3000/api/risk/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${mayaToken}`,
      },
      body: JSON.stringify({
        elderId: thomasId,
        amount: 120.0,
        merchantName: 'Department Store',
      }),
    });
    const evalRes = await evaluateRiskPost(evalReq);
    const evalData = await evalRes.json();
    const assessmentId = evalData.assessmentId;

    // 2. Sarah queries the assessment
    const { token: sarahToken } = await createDemoPersonaToken('sarah');
    const getReq = new NextRequest(`http://localhost:3000/api/risk/assessments/${assessmentId}`, {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sarahToken}`,
      },
    });

    const getRes = await getAssessmentById(getReq, { params: Promise.resolve({ id: assessmentId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.assessment.id).toBe(assessmentId);
    expect(getData.assessment.paymentRequest.elderId).toBe(thomasId);
  });

  it('auto-approves low-risk routine purchases within baseline without triggering holds', async () => {
    const { token } = await createDemoPersonaToken('thomas');

    // Clean up recent test transactions for Thomas so velocity check doesn't flag
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.paymentRequest.updateMany({
      where: { elderId: thomasId, createdAt: { gte: fifteenMinutesAgo } },
      data: { currentRiskAssessmentId: null },
    });
    await prisma.spendingReservation.deleteMany({
      where: { elderId: thomasId, createdAt: { gte: fifteenMinutesAgo } },
    });
    await prisma.approvalRequest.deleteMany({
      where: { elderId: thomasId, createdAt: { gte: fifteenMinutesAgo } },
    });
    await prisma.riskAssessment.deleteMany({
      where: { paymentRequest: { elderId: thomasId } },
    });
    await prisma.paymentRequest.deleteMany({
      where: { elderId: thomasId, createdAt: { gte: fifteenMinutesAgo } },
    });

    // Mark merchant as trusted to simulate routine grocery
    const recipient = await prisma.recipient.upsert({
      where: {
        elderId_merchantCode: {
          elderId: thomasId,
          merchantCode: 'local-market',
        },
      },
      update: { isTrusted: true, lastPaidAt: new Date() },
      create: {
        elderId: thomasId,
        merchantCode: 'local-market',
        merchantName: 'Local Market',
        category: 'Groceries',
        isTrusted: true,
        lastPaidAt: new Date(),
      },
    });

    // Midday transaction time within Thomas's regular active hours (8:00 - 21:00)
    const midday = new Date();
    midday.setHours(14, 0, 0, 0);

    const req = new NextRequest('http://localhost:3000/api/risk/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        elderId: thomasId,
        amount: 28.5, // Well below $100 threshold
        merchantCode: recipient.merchantCode,
        merchantName: recipient.merchantName,
        category: recipient.category,
        transactionTime: midday.toISOString(),
      }),
    });

    const res = await evaluateRiskPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.requiresFamilyApproval).toBe(false);
    expect(data.status).toBe('READY_FOR_CHECKOUT');
    expect(data.classification).toBe('NORMAL');

    // Verify NO approval request was created
    const savedApproval = await prisma.approvalRequest.findUnique({
      where: {
        paymentRequestId_elderId: {
          paymentRequestId: data.paymentRequestId,
          elderId: thomasId,
        },
      },
    });
    expect(savedApproval).toBeNull();
  });

  it('deterministic explanation fallback produces empathetic copy when LLM is unavailable', () => {
    const fallback = generateDeterministicFallback({
      amount: 185.0,
      currency: 'USD',
      merchantName: 'Gadget Store',
      category: 'Electronics',
      elderName: 'Thomas Sterling',
      classification: RiskClassification.UNUSUAL,
      signals: [
        { code: 'NEW_RECIPIENT', severity: 'MEDIUM', message: 'First purchase with merchant' },
        { code: 'EXCEEDS_FAMILY_THRESHOLD', severity: 'MEDIUM', message: 'Exceeds $100 threshold' },
      ],
      medianSpend: 45.0,
    });

    expect(fallback.headline).toContain('Gadget Store');
    expect(fallback.plainEnglishSummary).toContain('Thomas');
    expect(fallback.suggestedQuestions.length).toBeGreaterThan(0);
    expect(fallback.seniorMessage).toContain('Maya & David');
    expect(fallback.modelUsed).toBe('deterministic-fallback');
  });
});

