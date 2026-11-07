import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';
import { createPayPalOrder } from '@/lib/paypal/client';
import { Prisma, PaymentRequestStatus, PayPalOrderStatus, AuditActorType } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { paymentRequestId, returnUrl, cancelUrl } = body;

    if (!paymentRequestId) {
      return NextResponse.json({ error: 'paymentRequestId is required' }, { status: 400 });
    }

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: {
        recipient: true,
        paypalOrder: true,
      },
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
    }

    // Authorize elder data scope
    const authResult = await authorizeElderDataScope(session, paymentRequest.elderId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason || 'Forbidden' }, { status: 403 });
    }

    // Check payment safety status
    if (paymentRequest.status === PaymentRequestStatus.AWAITING_FAMILY) {
      return NextResponse.json(
        {
          error: 'Transaction is currently awaiting family caregiver review.',
          code: 'REQUIRES_APPROVAL',
          status: paymentRequest.status,
        },
        { status: 403 }
      );
    }

    if (paymentRequest.status === PaymentRequestStatus.BLOCKED_BY_POLICY) {
      return NextResponse.json(
        {
          error: 'Transaction exceeds absolute safety caps and cannot proceed.',
          code: 'POLICY_BLOCKED',
          status: paymentRequest.status,
        },
        { status: 400 }
      );
    }

    if (paymentRequest.status === PaymentRequestStatus.DECLINED_BY_FAMILY) {
      return NextResponse.json(
        {
          error: 'Transaction was declined by family review.',
          code: 'DECLINED_BY_FAMILY',
          status: paymentRequest.status,
        },
        { status: 400 }
      );
    }

    // If a PayPal order already exists and is created/pending
    if (paymentRequest.paypalOrder?.paypalOrderId) {
      return NextResponse.json({
        success: true,
        orderId: paymentRequest.paypalOrder.paypalOrderId,
        status: paymentRequest.paypalOrder.status,
        reused: true,
      });
    }

    const amount = Number(paymentRequest.amount.toString());
    const referenceId = paymentRequest.merchantOrderReference;
    const description = `SafePay: Order at ${paymentRequest.recipient.merchantName}`;

    // Call PayPal Orders API to create live sandbox order
    const orderResult = await createPayPalOrder({
      paymentRequestId,
      amount,
      currency: paymentRequest.currency,
      referenceId,
      description,
      returnUrl,
      cancelUrl,
    });

    const createRequestId = crypto.randomUUID();
    const captureRequestId = crypto.randomUUID();

    // Persist PayPalOrder and update PaymentRequest atomically
    const [savedOrder] = await prisma.$transaction([
      prisma.payPalOrder.create({
        data: {
          paymentRequestId,
          paypalOrderId: orderResult.id,
          status: PayPalOrderStatus.ORDER_CREATED,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          createRequestId,
          captureRequestId,
          rawResponse: orderResult.rawResponse as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.paymentRequest.update({
        where: { id: paymentRequestId },
        data: {
          status: PaymentRequestStatus.CHECKOUT_IN_PROGRESS,
        },
      }),
      prisma.auditEvent.create({
        data: {
          paymentRequestId,
          actorId: session.id,
          actorType: AuditActorType.USER,
          eventType: 'PAYPAL_ORDER_CREATED',
          oldState: paymentRequest.status,
          newState: PaymentRequestStatus.CHECKOUT_IN_PROGRESS,
          metadata: {
            paypalOrderId: orderResult.id,
            amount,
            merchant: paymentRequest.recipient.merchantName,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      orderId: savedOrder.paypalOrderId,
      approveUrl: orderResult.approveUrl,
      status: 'ORDER_CREATED',
    });
  } catch (error: unknown) {
    console.error('Error creating PayPal order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error creating PayPal order' },
      { status: 500 }
    );
  }
}

