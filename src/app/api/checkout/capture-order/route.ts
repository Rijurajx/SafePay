import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';
import { capturePayPalOrder } from '@/lib/paypal/client';
import {
  Prisma,
  PaymentRequestStatus,
  PayPalOrderStatus,
  ReservationStatus,
  AuditActorType,
} from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { paypalOrderId, paymentRequestId } = body;

    if (!paypalOrderId && !paymentRequestId) {
      return NextResponse.json(
        { error: 'Either paypalOrderId or paymentRequestId is required' },
        { status: 400 }
      );
    }

    const paypalOrder = await prisma.payPalOrder.findFirst({
      where: {
        OR: [
          ...(paypalOrderId ? [{ paypalOrderId }] : []),
          ...(paymentRequestId ? [{ paymentRequestId }] : []),
        ],
      },
      include: {
        paymentRequest: {
          include: {
            recipient: true,
            reservation: true,
          },
        },
      },
    });

    if (!paypalOrder || !paypalOrder.paypalOrderId) {
      return NextResponse.json({ error: 'PayPal order record not found' }, { status: 404 });
    }

    // Authorize elder data scope
    const authResult = await authorizeElderDataScope(session, paypalOrder.paymentRequest.elderId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason || 'Forbidden' }, { status: 403 });
    }

    if (paypalOrder.status === PayPalOrderStatus.COMPLETED) {
      return NextResponse.json({
        success: true,
        status: 'SETTLED',
        captureId: paypalOrder.paypalCaptureId,
        alreadyCaptured: true,
      });
    }

    // Execute capture against PayPal Sandbox API
    const captureResult = await capturePayPalOrder(
      paypalOrder.paypalOrderId,
      paypalOrder.captureRequestId
    );

    const now = new Date();

    // Update database atomically
    await prisma.$transaction(async (tx) => {
      // 1. Update PayPalOrder
      await tx.payPalOrder.update({
        where: { id: paypalOrder.id },
        data: {
          status: PayPalOrderStatus.COMPLETED,
          paypalCaptureId: captureResult.captureId,
          rawResponse: captureResult.rawResponse as unknown as Prisma.InputJsonValue,
        },
      });

      // 2. Update PaymentRequest
      await tx.paymentRequest.update({
        where: { id: paypalOrder.paymentRequestId },
        data: {
          status: PaymentRequestStatus.SETTLED,
          settledAt: now,
        },
      });

      // 3. Convert SpendingReservation to settled
      if (paypalOrder.paymentRequest.reservation) {
        await tx.spendingReservation.update({
          where: { paymentRequestId: paypalOrder.paymentRequestId },
          data: { status: ReservationStatus.CONVERTED_TO_SETTLED },
        });
      }

      // 4. Update recipient's lastPaidAt timestamp
      await tx.recipient.update({
        where: { id: paypalOrder.paymentRequest.recipientId },
        data: { lastPaidAt: now },
      });

      // 5. Record AuditEvent
      await tx.auditEvent.create({
        data: {
          paymentRequestId: paypalOrder.paymentRequestId,
          actorId: session.id,
          actorType: AuditActorType.USER,
          eventType: 'PAYPAL_CAPTURE_COMPLETED',
          oldState: paypalOrder.paymentRequest.status,
          newState: PaymentRequestStatus.SETTLED,
          metadata: {
            paypalOrderId: paypalOrder.paypalOrderId,
            paypalCaptureId: captureResult.captureId,
            amount: Number(paypalOrder.amount.toString()),
            currency: paypalOrder.currency,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      status: 'SETTLED',
      captureId: captureResult.captureId,
      settledAt: now.toISOString(),
    });
  } catch (error: unknown) {
    console.error('Error capturing PayPal order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error capturing PayPal order' },
      { status: 500 }
    );
  }
}

