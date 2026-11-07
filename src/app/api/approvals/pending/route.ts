import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { PendingApprovalItem, RiskSignal, GeminiExplanation } from '@/types';
import { ApprovalRequestStatus, FamilyLinkStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let elderIds: string[] = [];

    if (session.roleDefault === 'PROTECTED_USER') {
      elderIds = [session.id];
    } else {
      // Find all elders this caregiver is linked to
      const links = await prisma.familyLink.findMany({
        where: {
          caregiverId: session.id,
          status: FamilyLinkStatus.ACTIVE,
        },
        select: { elderId: true },
      });
      elderIds = links.map((l) => l.elderId);
    }

    if (elderIds.length === 0) {
      return NextResponse.json({ pendingApprovals: [] });
    }

    const approvalRequests = await prisma.approvalRequest.findMany({
      where: {
        elderId: { in: elderIds },
        status: ApprovalRequestStatus.PENDING,
      },
      include: {
        elder: {
          select: { id: true, fullName: true, email: true },
        },
        paymentRequest: {
          include: {
            recipient: true,
            currentRiskAssessment: true,
            paypalOrder: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: PendingApprovalItem[] = approvalRequests.map((req) => {
      const assessment = req.paymentRequest.currentRiskAssessment;
      return {
        id: req.id,
        paymentRequestId: req.paymentRequestId,
        elder: {
          id: req.elder.id,
          fullName: req.elder.fullName,
        },
        amount: Number(req.paymentRequest.amount.toString()),
        currency: req.paymentRequest.currency,
        recipient: {
          merchantName: req.paymentRequest.recipient.merchantName,
          category: req.paymentRequest.recipient.category,
          isTrusted: req.paymentRequest.recipient.isTrusted,
        },
        status: req.status,
        expiresAt: req.expiresAt.toISOString(),
        riskAssessment: assessment
          ? {
              id: assessment.id,
              classification: assessment.classification,
              riskScore: assessment.riskScore,
              signals: (assessment.signals as unknown as RiskSignal[]) || [],
              explanation: assessment.explanationContext as unknown as GeminiExplanation,
            }
          : undefined,
        paypalOrderId: req.paymentRequest.paypalOrder?.paypalOrderId || undefined,
        createdAt: req.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ pendingApprovals: items });
  } catch (error: unknown) {
    console.error('Error fetching pending approvals:', error);
    return NextResponse.json(
      { error: 'Internal server error fetching pending approvals' },
      { status: 500 }
    );
  }
}

