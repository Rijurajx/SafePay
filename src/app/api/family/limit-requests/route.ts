import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { limitType, requestedAmount, reason = '' } = body;

    if (!limitType || !['DAILY', 'MONTHLY'].includes(limitType)) {
      return NextResponse.json({ error: 'Valid limitType ("DAILY" or "MONTHLY") is required' }, { status: 400 });
    }

    const amountNum = Number(requestedAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'A positive requested amount is required' }, { status: 400 });
    }

    // 1. Identify if current user is an Elder (protected user) or Caregiver
    const isLinkedAsElder = await prisma.familyLink.findFirst({
      where: { elderId: session.id, status: 'ACTIVE' },
    });
    const hasCaregiverLinks = await prisma.familyLink.findFirst({
      where: { caregiverId: session.id, status: 'ACTIVE' },
    });

    const isElder = session.roleDefault === Role.PROTECTED_USER || (!!isLinkedAsElder && !hasCaregiverLinks);

    let targetElderId = session.id;
    let elderName = session.fullName;

    if (isElder) {
      // User is the senior member making their own limit request
      targetElderId = session.id;
      elderName = session.fullName;

      // Auto-heal session user role in database if out-of-sync
      if (session.roleDefault !== Role.PROTECTED_USER) {
        try {
          await prisma.user.update({
            where: { id: session.id },
            data: { roleDefault: Role.PROTECTED_USER },
          });
        } catch (err) {
          console.warn('Auto-heal elder role warning:', err);
        }
      }
    } else {
      // User is a Caregiver submitting or testing a limit request for an elder
      let elderId = body.elderId;

      // If elderId was not explicitly passed, auto-resolve first active linked elder for this caregiver
      if (!elderId) {
        const firstLink = await prisma.familyLink.findFirst({
          where: { caregiverId: session.id, status: 'ACTIVE' },
          include: { elder: true },
        });

        if (firstLink) {
          elderId = firstLink.elderId;
          elderName = firstLink.elder.fullName;
        } else {
          return NextResponse.json(
            { error: 'No active senior family member found linked to your account' },
            { status: 400 }
          );
        }
      } else {
        const link = await prisma.familyLink.findFirst({
          where: { caregiverId: session.id, elderId, status: 'ACTIVE' },
          include: { elder: true },
        });

        if (!link) {
          return NextResponse.json(
            { error: 'No active family link found for this senior member' },
            { status: 403 }
          );
        }
        elderName = link.elder.fullName;
      }

      targetElderId = elderId;
    }

    let settings = await prisma.protectionSettings.findUnique({
      where: { elderId: targetElderId },
    });

    if (!settings) {
      try {
        settings = await prisma.protectionSettings.create({
          data: {
            elderId: targetElderId,
            currency: 'USD',
            familyApprovalThreshold: 100,
            absoluteDailyCap: 1000,
            absoluteTransactionCap: 500,
            monthlyBudget: 2000,
            requireFamilyForNewRecipient: true,
            requireFamilyForUnusual: true,
            approvalTimeoutMinutes: 30,
          },
        });
      } catch {
        // Handled if concurrent insert
      }
    }

    const currentDailyCap = settings ? Number(settings.absoluteDailyCap.toString()) : 1000;
    const currentMonthlyBudget = settings?.monthlyBudget ? Number(settings.monthlyBudget.toString()) : 2000;

    const requestEvent = await prisma.auditEvent.create({
      data: {
        actorId: session.id,
        actorType: 'USER',
        eventType: 'LIMIT_INCREASE_REQUESTED',
        oldState: 'PENDING',
        newState: String(amountNum),
        metadata: {
          elderId: targetElderId,
          elderName,
          limitType,
          requestedAmount: amountNum,
          currentDailyCap,
          currentMonthlyBudget,
          reason: String(reason).trim() || 'Additional spending allowance requested',
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Limit increase request for $${amountNum.toFixed(2)} submitted to family caregivers.`,
      request: {
        id: requestEvent.id,
        limitType,
        requestedAmount: amountNum,
        reason,
        status: 'PENDING',
        createdAt: requestEvent.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('Create limit request error:', error);
    return NextResponse.json({ error: 'Failed to submit limit increase request' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let targetElderIds: string[] = [];

    const isLinkedAsElder = await prisma.familyLink.findFirst({
      where: { elderId: session.id, status: 'ACTIVE' },
    });
    const hasCaregiverLinks = await prisma.familyLink.findFirst({
      where: { caregiverId: session.id, status: 'ACTIVE' },
    });
    const isElder = session.roleDefault === Role.PROTECTED_USER || (!!isLinkedAsElder && !hasCaregiverLinks);

    if (isElder) {
      targetElderIds = [session.id];
    } else {
      const links = await prisma.familyLink.findMany({
        where: { caregiverId: session.id, status: 'ACTIVE' },
        select: { elderId: true },
      });
      targetElderIds = links.map((l) => l.elderId);
    }

    if (targetElderIds.length === 0) {
      return NextResponse.json({ success: true, requests: [] });
    }

    // Query pending limit increase requests from audit events
    const events = await prisma.auditEvent.findMany({
      where: {
        eventType: 'LIMIT_INCREASE_REQUESTED',
        oldState: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Filter to only events matching relevant elders
    const matchingRequests = events
      .filter((ev) => {
        const meta = ev.metadata as Record<string, unknown> | null;
        return meta && typeof meta.elderId === 'string' && targetElderIds.includes(meta.elderId);
      })
      .map((ev) => {
        const meta = (ev.metadata || {}) as Record<string, unknown>;
        return {
          id: ev.id,
          elderId: meta.elderId as string,
          elderName: (meta.elderName as string) || 'Senior Member',
          limitType: (meta.limitType as string) || 'DAILY',
          requestedAmount: Number(meta.requestedAmount || 0),
          currentDailyCap: Number(meta.currentDailyCap || 0),
          currentMonthlyBudget: Number(meta.currentMonthlyBudget || 0),
          reason: (meta.reason as string) || '',
          status: (meta.status as string) || 'PENDING',
          createdAt: ev.createdAt,
        };
      });

    return NextResponse.json({
      success: true,
      requests: matchingRequests,
    });
  } catch (error: unknown) {
    console.error('Fetch limit requests error:', error);
    return NextResponse.json({ error: 'Failed to retrieve limit requests' }, { status: 500 });
  }
}

