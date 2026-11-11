import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeCaregiverForElder } from '@/lib/auth';
import { capturePayPalOrder } from '@/lib/paypal/client';
import {
  ApprovalDecision,
  ApprovalRequestStatus,
  PaymentRequestStatus,
  ReservationStatus,
  PayPalOrderStatus,
  AuditActorType,
} from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: approvalRequestId } = await params;
    const body = await req.json();
    const { decision, reason } = body;

    if (!decision || (decision !== 'APPROVED' && decision !== 'DECLINED')) {
      return NextResponse.json(
        { error: 'Valid decision ("APPROVED" or "DECLINED") is required' },
        { status: 400 }
      );
    }

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
      include: {
        paymentRequest: {
          include: {
            reservation: true,
            paypalOrder: true,
          },
        },
      },
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    if (approvalRequest.status !== ApprovalRequestStatus.PENDING) {
      return NextResponse.json(
        { error: `Approval request is already ${approvalRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Role-Independent authorization: strictly check if caregiver has payment approval authority
    const authResult = await authorizeCaregiverForElder(
      session.id,
      approvalRequest.elderId,
      'approve'
    );

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.reason || 'Caregiver lacks payment approval authority' },
        { status: 403 }
      );
    }

    const now = new Date();

    if (decision === 'APPROVED') {
      const existingPaypalOrder = approvalRequest.paymentRequest.paypalOrder;
      let isSettled = false;
      let captureId: string | undefined;

      // If PayPal order exists and was waiting for caregiver authorization
      if (existingPaypalOrder?.paypalOrderId) {
        try {
          const captureResult = await capturePayPalOrder(
            existingPaypalOrder.paypalOrderId,
            existingPaypalOrder.captureRequestId
          );
          captureId = captureResult.captureId;
          isSettled = true;
        } catch (captureErr) {
          console.error('Error capturing approved PayPal order:', captureErr);
          // Still grant approval even if capture requires async retry
        }
      }

      // Execute approval update
      await prisma.$transaction(async (tx) => {
        // 1. Update ApprovalRequest
        await tx.approvalRequest.update({
          where: { id: approvalRequestId },
          data: {
            status: ApprovalRequestStatus.APPROVED,
            respondedById: session.id,
            respondedAt: now,
          },
        });

        // 2. Record ApprovalResponse
        await tx.approvalResponse.upsert({
          where: {
            approvalRequestId_caregiverId: {
              approvalRequestId,
              caregiverId: session.id,
            },
          },
          update: {
            decision: ApprovalDecision.APPROVED,
            reason: reason || null,
          },
          create: {
            approvalRequestId,
            caregiverId: session.id,
            decision: ApprovalDecision.APPROVED,
            reason: reason || null,
          },
        });

        // 3. Update PaymentRequest to SETTLED so it decreases spending caps immediately
        await tx.paymentRequest.update({
          where: { id: approvalRequest.paymentRequestId },
          data: {
            status: PaymentRequestStatus.SETTLED,
            settledAt: now,
          },
        });

        // 4. Update SpendingReservation if present
        if (approvalRequest.paymentRequest.reservation) {
          await tx.spendingReservation.update({
            where: { paymentRequestId: approvalRequest.paymentRequestId },
            data: { status: ReservationStatus.CONVERTED_TO_SETTLED },
          });
        }

        // 5. Update PayPalOrder if captured
        if (existingPaypalOrder) {
          await tx.payPalOrder.update({
            where: { id: existingPaypalOrder.id },
            data: {
              status: PayPalOrderStatus.COMPLETED,
              paypalCaptureId: captureId || existingPaypalOrder.paypalCaptureId || 'SIMULATED_CAPTURE',
            },
          });
        }

        // 6. Record AuditEvent
        await tx.auditEvent.create({
          data: {
            paymentRequestId: approvalRequest.paymentRequestId,
            actorId: session.id,
            actorType: AuditActorType.USER,
            eventType: 'CAREGIVER_APPROVAL_GRANTED',
            oldState: approvalRequest.paymentRequest.status,
            newState: PaymentRequestStatus.SETTLED,
            metadata: {
              reason,
              approverName: session.fullName,
              approverEmail: session.email,
              isSettled,
              captureId,
            },
          },
        });
      });

      return NextResponse.json({
        success: true,
        decision: 'APPROVED',
        paymentRequestId: approvalRequest.paymentRequestId,
        status: isSettled ? 'SETTLED' : 'APPROVED_FOR_CHECKOUT',
        captureId,
      });
    } else {
      // Decision is DECLINED
      await prisma.$transaction(async (tx) => {
        // 1. Update ApprovalRequest
        await tx.approvalRequest.update({
          where: { id: approvalRequestId },
          data: {
            status: ApprovalRequestStatus.DECLINED,
            respondedById: session.id,
            respondedAt: now,
          },
        });

        // 2. Record ApprovalResponse
        await tx.approvalResponse.upsert({
          where: {
            approvalRequestId_caregiverId: {
              approvalRequestId,
              caregiverId: session.id,
            },
          },
          update: {
            decision: ApprovalDecision.DECLINED,
            reason: reason || 'Declined by caregiver review',
          },
          create: {
            approvalRequestId,
            caregiverId: session.id,
            decision: ApprovalDecision.DECLINED,
            reason: reason || 'Declined by caregiver review',
          },
        });

        // 3. Update PaymentRequest
        await tx.paymentRequest.update({
          where: { id: approvalRequest.paymentRequestId },
          data: {
            status: PaymentRequestStatus.DECLINED_BY_FAMILY,
          },
        });

        // 4. Release SpendingReservation back to senior's budget
        if (approvalRequest.paymentRequest.reservation) {
          await tx.spendingReservation.update({
            where: { paymentRequestId: approvalRequest.paymentRequestId },
            data: { status: ReservationStatus.RELEASED },
          });
        }

        // 5. Cancel PayPalOrder if exists
        if (approvalRequest.paymentRequest.paypalOrder) {
          await tx.payPalOrder.update({
            where: { id: approvalRequest.paymentRequest.paypalOrder.id },
            data: { status: PayPalOrderStatus.CANCELLED_BY_USER },
          });
        }

        // 6. Record AuditEvent
        await tx.auditEvent.create({
          data: {
            paymentRequestId: approvalRequest.paymentRequestId,
            actorId: session.id,
            actorType: AuditActorType.USER,
            eventType: 'CAREGIVER_APPROVAL_DECLINED',
            oldState: approvalRequest.paymentRequest.status,
            newState: PaymentRequestStatus.DECLINED_BY_FAMILY,
            metadata: {
              reason: reason || 'Declined by caregiver review',
              declinedByName: session.fullName,
              declinedByEmail: session.email,
            },
          },
        });
      });

      return NextResponse.json({
        success: true,
        decision: 'DECLINED',
        paymentRequestId: approvalRequest.paymentRequestId,
        status: 'DECLINED_BY_FAMILY',
      });
    }
  } catch (error: unknown) {
    console.error('Error processing caregiver decision:', error);
    return NextResponse.json(
      { error: 'Internal server error processing decision' },
      { status: 500 }
    );
  }
}
