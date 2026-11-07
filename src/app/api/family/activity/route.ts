import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let requestedElderId = searchParams.get('elderId');
    if (!requestedElderId) {
      if (session.roleDefault === 'PROTECTED_USER') {
        requestedElderId = session.id;
      } else {
        const activeLink = await prisma.familyLink.findFirst({
          where: { caregiverId: session.id, status: 'ACTIVE' },
          select: { elderId: true },
        });
        requestedElderId = activeLink?.elderId || '11111111-1111-4111-a111-111111111111';
      }
    }

    const authResult = await authorizeElderDataScope(session, requestedElderId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason || 'Forbidden' }, { status: 403 });
    }

    // Fetch recent payment requests with recipient, risk assessment, and approval details
    const recentPayments = await prisma.paymentRequest.findMany({
      where: { elderId: requestedElderId },
      include: {
        recipient: true,
        currentRiskAssessment: true,
        approvalRequest: {
          include: {
            responses: {
              include: {
                caregiver: { select: { fullName: true, email: true } },
              },
            },
          },
        },
        paypalOrder: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // Fetch recent audit events
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        paymentRequest: {
          elderId: requestedElderId,
        },
      },
      include: {
        actor: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Calculate today's spending usage vs cap
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySettled = await prisma.paymentRequest.aggregate({
      where: {
        elderId: requestedElderId,
        status: 'SETTLED',
        settledAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const elder = await prisma.user.findUnique({
      where: { id: requestedElderId },
      include: { protectionSettings: true },
    });

    return NextResponse.json({
      payments: recentPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount.toString()),
        currency: p.currency,
        status: p.status,
        merchantName: p.recipient.merchantName,
        category: p.recipient.category,
        isTrusted: p.recipient.isTrusted,
        requiresFamilyApproval: p.requiresFamilyApproval,
        createdAt: p.createdAt.toISOString(),
        settledAt: p.settledAt?.toISOString(),
        riskAssessment: p.currentRiskAssessment
          ? {
              score: p.currentRiskAssessment.riskScore,
              classification: p.currentRiskAssessment.classification,
              explanation: p.currentRiskAssessment.explanationContext,
            }
          : null,
        approval: p.approvalRequest
          ? {
              id: p.approvalRequest.id,
              status: p.approvalRequest.status,
              expiresAt: p.approvalRequest.expiresAt.toISOString(),
              respondedAt: p.approvalRequest.respondedAt?.toISOString(),
              responses: p.approvalRequest.responses,
            }
          : null,
        paypalOrderId: p.paypalOrder?.paypalOrderId,
      })),
      auditLogs: auditEvents.map((a) => ({
        id: a.id,
        eventType: a.eventType,
        actorType: a.actorType,
        actorName: a.actor?.fullName || a.actorType,
        oldState: a.oldState,
        newState: a.newState,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
      spendingToday: Number(todaySettled._sum.amount?.toString() || 0),
      dailyCap: Number(elder?.protectionSettings?.absoluteDailyCap?.toString() || 1000),
      familyThreshold: Number(elder?.protectionSettings?.familyApprovalThreshold?.toString() || 100),
    });
  } catch (error: unknown) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

