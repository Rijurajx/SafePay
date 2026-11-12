import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeCaregiverForElder } from '@/lib/auth';
import { Decimal } from '@prisma/client/runtime/library';

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

    const { id: requestId } = await params;
    const body = await req.json();
    const { decision, reason = '' } = body;

    if (!decision || (decision !== 'APPROVED' && decision !== 'DECLINED')) {
      return NextResponse.json({ error: 'Valid decision ("APPROVED" or "DECLINED") is required' }, { status: 400 });
    }

    // 1. Fetch the limit request event
    const requestEvent = await prisma.auditEvent.findUnique({
      where: { id: requestId },
    });

    if (!requestEvent || requestEvent.eventType !== 'LIMIT_INCREASE_REQUESTED') {
      return NextResponse.json({ error: 'Limit increase request not found' }, { status: 404 });
    }

    if (requestEvent.oldState !== 'PENDING') {
      return NextResponse.json(
        { error: `This limit request has already been ${(requestEvent.oldState || 'processed').toLowerCase()}` },
        { status: 400 }
      );
    }

    const metadata = (requestEvent.metadata || {}) as Record<string, unknown>;
    const elderId = metadata.elderId as string;
    const limitType = (metadata.limitType as string) || 'DAILY';
    const requestedAmount = Number(metadata.requestedAmount || 0);

    if (!elderId || requestedAmount <= 0) {
      return NextResponse.json({ error: 'Malformed limit request data' }, { status: 400 });
    }

    // 2. Authorize that this caregiver is permitted to manage settings or approve payments for this elder
    let authResult = await authorizeCaregiverForElder(session.id, elderId, 'manage');
    if (!authResult.authorized) {
      authResult = await authorizeCaregiverForElder(session.id, elderId, 'approve');
    }
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.reason || 'Caregiver does not have permission to manage protection settings' },
        { status: 403 }
      );
    }

    // 3. Process Decision
    const now = new Date();

    if (decision === 'APPROVED') {
      const currentSettings = await prisma.protectionSettings.findUnique({
        where: { elderId },
      });

      let updatedDailyCap = currentSettings ? Number(currentSettings.absoluteDailyCap.toString()) : 1000;
      let updatedMonthlyBudget = currentSettings?.monthlyBudget ? Number(currentSettings.monthlyBudget.toString()) : 2000;

      if (limitType === 'DAILY') {
        updatedDailyCap += requestedAmount;
        await prisma.protectionSettings.upsert({
          where: { elderId },
          update: {
            absoluteDailyCap: new Decimal(updatedDailyCap),
            version: { increment: 1 },
          },
          create: {
            elderId,
            absoluteTransactionCap: new Decimal(500),
            absoluteDailyCap: new Decimal(updatedDailyCap),
            familyApprovalThreshold: new Decimal(100),
            monthlyBudget: new Decimal(updatedMonthlyBudget),
            requireFamilyForNewRecipient: true,
            requireFamilyForUnusual: true,
          },
        });
      } else {
        updatedMonthlyBudget += requestedAmount;
        await prisma.protectionSettings.upsert({
          where: { elderId },
          update: {
            monthlyBudget: new Decimal(updatedMonthlyBudget),
            version: { increment: 1 },
          },
          create: {
            elderId,
            absoluteTransactionCap: new Decimal(500),
            absoluteDailyCap: new Decimal(updatedDailyCap),
            familyApprovalThreshold: new Decimal(100),
            monthlyBudget: new Decimal(updatedMonthlyBudget),
            requireFamilyForNewRecipient: true,
            requireFamilyForUnusual: true,
          },
        });
      }

      // Mark original request as APPROVED
      await prisma.auditEvent.update({
        where: { id: requestId },
        data: {
          oldState: 'APPROVED',
          newState: String(limitType === 'DAILY' ? updatedDailyCap : updatedMonthlyBudget),
          metadata: {
            ...metadata,
            status: 'APPROVED',
            decidedAt: now.toISOString(),
            decidedById: session.id,
            decidedByName: session.fullName,
            approvalNote: reason || 'Approved by family guardian',
          },
        },
      });

      // Record audit event for limit increase applied
      await prisma.auditEvent.create({
        data: {
          actorId: session.id,
          actorType: 'USER',
          eventType: 'LIMIT_INCREASE_APPROVED',
          oldState: String(metadata.currentDailyCap || metadata.currentMonthlyBudget),
          newState: String(limitType === 'DAILY' ? updatedDailyCap : updatedMonthlyBudget),
          metadata: {
            elderId,
            limitType,
            requestedAmount,
            updatedDailyCap,
            updatedMonthlyBudget,
            decidedBy: session.fullName,
            timestamp: now.toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully approved limit increase of $${requestedAmount.toFixed(2)}. New ${limitType.toLowerCase()} limit is $${(limitType === 'DAILY' ? updatedDailyCap : updatedMonthlyBudget).toFixed(2)}.`,
        newLimit: limitType === 'DAILY' ? updatedDailyCap : updatedMonthlyBudget,
        limitType,
      });
    } else {
      // DECLINED
      await prisma.auditEvent.update({
        where: { id: requestId },
        data: {
          oldState: 'DECLINED',
          metadata: {
            ...metadata,
            status: 'DECLINED',
            decidedAt: now.toISOString(),
            decidedById: session.id,
            decidedByName: session.fullName,
            declineReason: reason || 'Declined by family guardian',
          },
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: session.id,
          actorType: 'USER',
          eventType: 'LIMIT_INCREASE_DECLINED',
          oldState: 'PENDING',
          newState: 'DECLINED',
          metadata: {
            elderId,
            limitType,
            requestedAmount,
            declineReason: reason,
            decidedBy: session.fullName,
            timestamp: now.toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Limit increase request declined.',
      });
    }
  } catch (error: unknown) {
    console.error('Decide limit request error:', error);
    return NextResponse.json({ error: 'Failed to process limit decision' }, { status: 500 });
  }
}
