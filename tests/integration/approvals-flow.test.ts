import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPendingApprovals } from '@/app/api/approvals/pending/route';
import { POST as decideApproval } from '@/app/api/approvals/[id]/decide/route';
import { POST as createCheckoutOrder } from '@/app/api/checkout/create-order/route';
import { POST as handlePayPalWebhook } from '@/app/api/webhooks/paypal/route';
import { DEMO_PERSONAS, createDemoPersonaToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  PaymentRequestStatus,
  ApprovalRequestStatus,
  ReservationStatus,
  PayPalOrderStatus,
  DataProvenance,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Milestone 3: Caregiver Approval Execution & PayPal Sandbox Integration', { timeout: 35000 }, () => {
  const thomasId = DEMO_PERSONAS.thomas.id;
  let testPaymentRequestId: string;
  let testApprovalRequestId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Create a known recipient for test
    const recipient = await prisma.recipient.upsert({
      where: {
        elderId_merchantCode: {
          elderId: thomasId,
          merchantCode: 'test-electronics-store',
        },
      },
      update: {},
      create: {
        elderId: thomasId,
        merchantCode: 'test-electronics-store',
        merchantName: 'Test Electronics Store',
        category: 'Consumer Electronics',
        isTrusted: false,
      },
    });

    // Create a test PaymentRequest awaiting family approval
    const payment = await prisma.paymentRequest.create({
      data: {
        elderId: thomasId,
        recipientId: recipient.id,
        merchantOrderReference: `TEST-REF-${Date.now()}`,
        amount: new Decimal(220.0),
        status: PaymentRequestStatus.AWAITING_FAMILY,
        requiresFamilyApproval: true,
        provenance: DataProvenance.PAYPAL_SANDBOX_VERIFIED,
      },
    });
    testPaymentRequestId = payment.id;

    // Create active spending reservation
    await prisma.spendingReservation.create({
      data: {
        paymentRequestId: payment.id,
        elderId: thomasId,
        amount: new Decimal(220.0),
        status: ReservationStatus.ACTIVE,
      },
    });

    // Create pending approval request
    const approval = await prisma.approvalRequest.create({
      data: {
        paymentRequestId: payment.id,
        elderId: thomasId,
        status: ApprovalRequestStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    testApprovalRequestId = approval.id;
  });

  afterAll(async () => {
    // Cleanup test artifacts
    if (testApprovalRequestId) {
      await prisma.approvalResponse.deleteMany({ where: { approvalRequestId: testApprovalRequestId } });
      await prisma.approvalRequest.deleteMany({ where: { id: testApprovalRequestId } });
    }
    if (testPaymentRequestId) {
      await prisma.payPalOrder.deleteMany({ where: { paymentRequestId: testPaymentRequestId } });
      await prisma.spendingReservation.deleteMany({ where: { paymentRequestId: testPaymentRequestId } });
      await prisma.auditEvent.deleteMany({ where: { paymentRequestId: testPaymentRequestId } });
      await prisma.riskAssessment.deleteMany({ where: { paymentRequestId: testPaymentRequestId } });
      await prisma.paymentRequest.deleteMany({ where: { id: testPaymentRequestId } });
    }
    await prisma.$disconnect();
  });

  it('allows Maya to fetch pending approvals for Thomas and returns full details', async () => {
    const { token } = await createDemoPersonaToken('maya');

    const req = new NextRequest('http://localhost:3000/api/approvals/pending', {
      method: 'GET',
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await getPendingApprovals(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.pendingApprovals)).toBe(true);

    const match = data.pendingApprovals.find((a: any) => a.id === testApprovalRequestId);
    expect(match).toBeDefined();
    expect(match.amount).toBe(220.0);
    expect(match.elder.fullName).toBe('Thomas Sterling');
    expect(match.status).toBe('PENDING');
  });

  it('strictly rejects Sarah (View-Only Caregiver) with HTTP 403 when trying to decide an approval', async () => {
    const { token } = await createDemoPersonaToken('sarah');

    const req = new NextRequest(`http://localhost:3000/api/approvals/${testApprovalRequestId}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        decision: 'APPROVED',
        reason: 'Attempting approval from view-only persona',
      }),
    });

    const res = await decideApproval(req, {
      params: Promise.resolve({ id: testApprovalRequestId }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('payment approval');

    // Confirm DB status is still PENDING
    const checkReq = await prisma.approvalRequest.findUnique({
      where: { id: testApprovalRequestId },
    });
    expect(checkReq?.status).toBe(ApprovalRequestStatus.PENDING);
  });

  it('allows David (Co-Caregiver with approval rights) to approve a hold and logs audit event', async () => {
    const { token } = await createDemoPersonaToken('david');

    const req = new NextRequest(`http://localhost:3000/api/approvals/${testApprovalRequestId}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        decision: 'APPROVED',
        reason: 'Discussed with Dad, he needs new noise-cancelling headphones for travel',
      }),
    });

    const res = await decideApproval(req, {
      params: Promise.resolve({ id: testApprovalRequestId }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.decision).toBe('APPROVED');
    expect(data.status).toBe('APPROVED_FOR_CHECKOUT');

    // Verify DB state
    const updatedApproval = await prisma.approvalRequest.findUnique({
      where: { id: testApprovalRequestId },
      include: { responses: true },
    });
    expect(updatedApproval?.status).toBe(ApprovalRequestStatus.APPROVED);
    expect(updatedApproval?.respondedById).toBe(DEMO_PERSONAS.david.id);
    expect(updatedApproval?.responses.length).toBe(1);
    expect(updatedApproval?.responses[0].decision).toBe('APPROVED');

    const updatedPayment = await prisma.paymentRequest.findUnique({
      where: { id: testPaymentRequestId },
    });
    expect(updatedPayment?.status).toBe(PaymentRequestStatus.APPROVED_FOR_CHECKOUT);

    // Verify Audit Event
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        paymentRequestId: testPaymentRequestId,
        eventType: 'CAREGIVER_APPROVAL_GRANTED',
      },
    });
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.actorId).toBe(DEMO_PERSONAS.david.id);
  });

  it('allows Maya to decline an anomalous transaction, releasing spending reservation', async () => {
    // Create another payment request for decline testing
    const recipient = await prisma.recipient.findFirst({
      where: { elderId: thomasId },
    });

    const declinePayment = await prisma.paymentRequest.create({
      data: {
        elderId: thomasId,
        recipientId: recipient!.id,
        merchantOrderReference: `DECLINE-REF-${Date.now()}`,
        amount: new Decimal(350.0),
        status: PaymentRequestStatus.AWAITING_FAMILY,
        requiresFamilyApproval: true,
      },
    });

    const reservation = await prisma.spendingReservation.create({
      data: {
        paymentRequestId: declinePayment.id,
        elderId: thomasId,
        amount: new Decimal(350.0),
        status: ReservationStatus.ACTIVE,
      },
    });

    const declineApproval = await prisma.approvalRequest.create({
      data: {
        paymentRequestId: declinePayment.id,
        elderId: thomasId,
        status: ApprovalRequestStatus.PENDING,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const { token } = await createDemoPersonaToken('maya');

    const req = new NextRequest(`http://localhost:3000/api/approvals/${declineApproval.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        decision: 'DECLINED',
        reason: 'Unrecognized software subscription phone call. Advised Dad to ignore.',
      }),
    });

    const res = await decideApproval(req, {
      params: Promise.resolve({ id: declineApproval.id }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.decision).toBe('DECLINED');
    expect(data.status).toBe('DECLINED_BY_FAMILY');

    // Verify reservation is released
    const updatedRes = await prisma.spendingReservation.findUnique({
      where: { id: reservation.id },
    });
    expect(updatedRes?.status).toBe(ReservationStatus.RELEASED);

    // Verify PaymentRequest status is DECLINED_BY_FAMILY
    const updatedPayment = await prisma.paymentRequest.findUnique({
      where: { id: declinePayment.id },
    });
    expect(updatedPayment?.status).toBe(PaymentRequestStatus.DECLINED_BY_FAMILY);

    // Clean up
    await prisma.approvalResponse.deleteMany({ where: { approvalRequestId: declineApproval.id } });
    await prisma.approvalRequest.deleteMany({ where: { id: declineApproval.id } });
    await prisma.spendingReservation.deleteMany({ where: { id: reservation.id } });
    await prisma.auditEvent.deleteMany({ where: { paymentRequestId: declinePayment.id } });
    await prisma.paymentRequest.deleteMany({ where: { id: declinePayment.id } });
  });

  it('allows Thomas to create a live PayPal sandbox order on an approved payment request', async () => {
    const { token } = await createDemoPersonaToken('thomas');

    const req = new NextRequest('http://localhost:3000/api/checkout/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        paymentRequestId: testPaymentRequestId,
        returnUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
      }),
    });

    const res = await createCheckoutOrder(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.orderId).toBeDefined();
    expect(data.status).toBe('ORDER_CREATED');

    // Confirm PayPalOrder created in DB
    const orderInDb = await prisma.payPalOrder.findUnique({
      where: { paymentRequestId: testPaymentRequestId },
    });
    expect(orderInDb).toBeDefined();
    expect(orderInDb?.paypalOrderId).toBe(data.orderId);
  });

  it('idempotently processes PayPal webhook PAYMENT.CAPTURE.COMPLETED, settling payment request', async () => {
    const paypalOrder = await prisma.payPalOrder.findUnique({
      where: { paymentRequestId: testPaymentRequestId },
    });
    expect(paypalOrder?.paypalOrderId).toBeDefined();

    const mockCaptureEventId = `WH-TEST-${Date.now()}`;
    const webhookPayload = {
      id: mockCaptureEventId,
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: `CAP-${Date.now()}`,
        status: 'COMPLETED',
        custom_id: testPaymentRequestId,
        amount: { currency_code: 'USD', value: '220.00' },
        supplementary_data: {
          related_ids: {
            order_id: paypalOrder!.paypalOrderId,
          },
        },
      },
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const res = await handlePayPalWebhook(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.processed).toBe(true);

    // Verify PaymentRequest status is SETTLED
    const settledPayment = await prisma.paymentRequest.findUnique({
      where: { id: testPaymentRequestId },
    });
    expect(settledPayment?.status).toBe(PaymentRequestStatus.SETTLED);
    expect(settledPayment?.settledAt).toBeDefined();

    // Verify duplicate delivery is handled idempotently
    const duplicateReq = new NextRequest('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    const duplicateRes = await handlePayPalWebhook(duplicateReq);
    expect(duplicateRes.status).toBe(200);
    const duplicateData = await duplicateRes.json();
    expect(duplicateData.idempotent).toBe(true);

    // Clean up webhook event
    await prisma.payPalWebhookEvent.deleteMany({ where: { paypalEventId: mockCaptureEventId } });
  });
});

