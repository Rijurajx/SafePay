import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPayPalWebhookSignature, capturePayPalOrder } from '@/lib/paypal/client';
import {
  Prisma,
  WebhookProcessingStatus,
  PayPalOrderStatus,
  PaymentRequestStatus,
  ReservationStatus,
  AuditActorType,
} from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let event: Record<string, unknown>;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventId = typeof event.id === 'string' ? event.id : undefined;
    const eventType = typeof event.event_type === 'string' ? event.event_type : undefined;

    if (!eventId || !eventType) {
      return NextResponse.json({ error: 'Missing event ID or event_type' }, { status: 400 });
    }

    // Webhook verification headers
    const authAlgo = req.headers.get('paypal-auth-algo') || '';
    const certUrl = req.headers.get('paypal-cert-url') || '';
    const transmissionId = req.headers.get('paypal-transmission-id') || '';
    const transmissionSig = req.headers.get('paypal-transmission-sig') || '';
    const transmissionTime = req.headers.get('paypal-transmission-time') || '';
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || 'placeholder_webhook_id';

    // Verify signature
    const isValidSignature = await verifyPayPalWebhookSignature({
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
      webhookId,
      webhookEvent: event,
    });

    if (!isValidSignature && process.env.NODE_ENV === 'production' && webhookId !== 'placeholder_webhook_id') {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    // Idempotency: check if event has already been recorded
    const existingEvent = await prisma.payPalWebhookEvent.findUnique({
      where: { paypalEventId: eventId },
    });

    if (existingEvent && existingEvent.processingStatus === WebhookProcessingStatus.PROCESSED) {
      return NextResponse.json({ message: 'Event already processed', idempotent: true }, { status: 200 });
    }

    const resource = (event.resource as Record<string, unknown>) || {};
    const supplementaryData = (resource.supplementary_data as Record<string, unknown>) || {};
    const relatedIds = (supplementaryData.related_ids as Record<string, unknown>) || {};

    const paypalOrderId =
      (typeof relatedIds.order_id === 'string' ? relatedIds.order_id : undefined) ||
      (eventType.startsWith('CHECKOUT.ORDER.') && typeof resource.id === 'string' ? resource.id : undefined);
    const paypalCaptureId = eventType.includes('CAPTURE') && typeof resource.id === 'string' ? resource.id : undefined;
    const customPaymentRequestId = typeof resource.custom_id === 'string' ? resource.custom_id : undefined;

    // Record or update webhook event entry
    const recordedEvent = await prisma.payPalWebhookEvent.upsert({
      where: { paypalEventId: eventId },
      update: {
        deliveryCount: { increment: 1 },
        processingStatus: WebhookProcessingStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
      create: {
        paypalEventId: eventId,
        eventType,
        paypalOrderId,
        paypalCaptureId,
        processingStatus: WebhookProcessingStatus.PROCESSING,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });

    // Process specific PayPal events
    if (eventType === 'CHECKOUT.ORDER.APPROVED' && paypalOrderId) {
      const order = await prisma.payPalOrder.findUnique({
        where: { paypalOrderId },
        include: {
          paymentRequest: {
            include: {
              approvalRequest: true,
              reservation: true,
            },
          },
        },
      });

      if (order) {
        const needsHold =
          order.paymentRequest.requiresFamilyApproval &&
          order.paymentRequest.approvalRequest?.status === 'PENDING';

        if (needsHold) {
          // Keep held for caregiver approval
          await prisma.payPalOrder.update({
            where: { id: order.id },
            data: { status: PayPalOrderStatus.BUYER_APPROVED },
          });
        } else if (order.paypalOrderId) {
          // Auto-capture or previously approved by family
          try {
            const captureResult = await capturePayPalOrder(order.paypalOrderId, order.captureRequestId);
            const now = new Date();

            await prisma.$transaction([
              prisma.payPalOrder.update({
                where: { id: order.id },
                data: {
                  status: PayPalOrderStatus.COMPLETED,
                  paypalCaptureId: captureResult.captureId,
                },
              }),
              prisma.paymentRequest.update({
                where: { id: order.paymentRequestId },
                data: {
                  status: PaymentRequestStatus.SETTLED,
                  settledAt: now,
                },
              }),
              ...(order.paymentRequest.reservation
                ? [
                    prisma.spendingReservation.update({
                      where: { paymentRequestId: order.paymentRequestId },
                      data: { status: ReservationStatus.CONVERTED_TO_SETTLED },
                    }),
                  ]
                : []),
              prisma.auditEvent.create({
                data: {
                  paymentRequestId: order.paymentRequestId,
                  actorType: AuditActorType.PAYPAL_WEBHOOK,
                  eventType: 'PAYPAL_WEBHOOK_ORDER_CAPTURED',
                  oldState: order.paymentRequest.status,
                  newState: PaymentRequestStatus.SETTLED,
                  metadata: { eventId, captureId: captureResult.captureId },
                },
              }),
            ]);
          } catch (capErr) {
            console.error('Webhook order auto-capture failed:', capErr);
          }
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && (paypalOrderId || customPaymentRequestId)) {
      const order = await prisma.payPalOrder.findFirst({
        where: {
          OR: [
            ...(paypalOrderId ? [{ paypalOrderId }] : []),
            ...(customPaymentRequestId ? [{ paymentRequestId: customPaymentRequestId }] : []),
          ],
        },
        include: { paymentRequest: { include: { reservation: true } } },
      });

      if (order) {
        const now = new Date();
        await prisma.$transaction([
          prisma.payPalOrder.update({
            where: { id: order.id },
            data: {
              status: PayPalOrderStatus.COMPLETED,
              paypalCaptureId: paypalCaptureId || order.paypalCaptureId,
            },
          }),
          prisma.paymentRequest.update({
            where: { id: order.paymentRequestId },
            data: {
              status: PaymentRequestStatus.SETTLED,
              settledAt: now,
            },
          }),
          ...(order.paymentRequest.reservation
            ? [
                prisma.spendingReservation.update({
                  where: { paymentRequestId: order.paymentRequestId },
                  data: { status: ReservationStatus.CONVERTED_TO_SETTLED },
                }),
              ]
            : []),
          prisma.auditEvent.create({
            data: {
              paymentRequestId: order.paymentRequestId,
              actorType: AuditActorType.PAYPAL_WEBHOOK,
              eventType: 'PAYPAL_WEBHOOK_CAPTURE_COMPLETED',
              newState: PaymentRequestStatus.SETTLED,
              metadata: { eventId, captureId: paypalCaptureId },
            },
          }),
        ]);
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' && (paypalOrderId || customPaymentRequestId)) {
      const order = await prisma.payPalOrder.findFirst({
        where: {
          OR: [
            ...(paypalOrderId ? [{ paypalOrderId }] : []),
            ...(customPaymentRequestId ? [{ paymentRequestId: customPaymentRequestId }] : []),
          ],
        },
        include: { paymentRequest: { include: { reservation: true } } },
      });

      if (order) {
        await prisma.$transaction([
          prisma.payPalOrder.update({
            where: { id: order.id },
            data: { status: PayPalOrderStatus.DENIED },
          }),
          prisma.paymentRequest.update({
            where: { id: order.paymentRequestId },
            data: { status: PaymentRequestStatus.CAPTURE_FAILED },
          }),
          ...(order.paymentRequest.reservation
            ? [
                prisma.spendingReservation.update({
                  where: { paymentRequestId: order.paymentRequestId },
                  data: { status: ReservationStatus.RELEASED },
                }),
              ]
            : []),
          prisma.auditEvent.create({
            data: {
              paymentRequestId: order.paymentRequestId,
              actorType: AuditActorType.PAYPAL_WEBHOOK,
              eventType: 'PAYPAL_WEBHOOK_CAPTURE_DENIED',
              newState: PaymentRequestStatus.CAPTURE_FAILED,
              metadata: { eventId },
            },
          }),
        ]);
      }
    }

    // Mark event as processed
    await prisma.payPalWebhookEvent.update({
      where: { id: recordedEvent.id },
      data: {
        processingStatus: WebhookProcessingStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, eventId, processed: true });
  } catch (error: unknown) {
    console.error('Error handling PayPal webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook' },
      { status: 500 }
    );
  }
}

