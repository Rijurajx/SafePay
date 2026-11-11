import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { FamilyLinkStatus, ApprovalRequestStatus, PaymentRequestStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    if (session.roleDefault === 'CAREGIVER') {
      // Find all elders linked to this caregiver
      const links = await prisma.familyLink.findMany({
        where: {
          caregiverId: session.id,
          status: FamilyLinkStatus.ACTIVE,
        },
        include: {
          elder: {
            include: {
              protectionSettings: true,
            },
          },
          permission: true,
        },
      });

      const elderIds = links.map((l) => l.elderId);

      // Pending approvals across all linked elders
      const pendingApprovals = await prisma.approvalRequest.findMany({
        where: {
          elderId: { in: elderIds },
          status: ApprovalRequestStatus.PENDING,
        },
        include: {
          elder: { select: { id: true, fullName: true } },
          paymentRequest: {
            include: {
              recipient: true,
              currentRiskAssessment: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Start of day and start of month
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Today's total spending by elders
      const spendingByElder: Record<string, number> = {};
      const monthlySpendingByElder: Record<string, number> = {};

      for (const eId of elderIds) {
        const sumToday = await prisma.paymentRequest.aggregate({
          where: {
            elderId: eId,
            status: { in: [PaymentRequestStatus.SETTLED, PaymentRequestStatus.APPROVED_FOR_CHECKOUT] },
            OR: [
              { settledAt: { gte: startOfDay } },
              { AND: [{ settledAt: null }, { createdAt: { gte: startOfDay } }] },
            ],
          },
          _sum: { amount: true },
        });
        spendingByElder[eId] = Number(sumToday._sum.amount?.toString() || 0);

        const sumMonth = await prisma.paymentRequest.aggregate({
          where: {
            elderId: eId,
            status: { in: [PaymentRequestStatus.SETTLED, PaymentRequestStatus.APPROVED_FOR_CHECKOUT] },
            OR: [
              { settledAt: { gte: startOfMonth } },
              { AND: [{ settledAt: null }, { createdAt: { gte: startOfMonth } }] },
            ],
          },
          _sum: { amount: true },
        });
        monthlySpendingByElder[eId] = Number(sumMonth._sum.amount?.toString() || 0);
      }

      // Pending Limit Increase Requests
      const limitRequestEvents = await prisma.auditEvent.findMany({
        where: {
          eventType: 'LIMIT_INCREASE_REQUESTED',
          oldState: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const pendingLimitRequests = limitRequestEvents
        .filter((ev) => {
          const meta = ev.metadata as Record<string, unknown> | null;
          return meta && typeof meta.elderId === 'string' && elderIds.includes(meta.elderId);
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
            status: 'PENDING',
            createdAt: ev.createdAt.toISOString(),
          };
        });

      return NextResponse.json({
        role: 'CAREGIVER',
        user: session,
        linkedElders: links.map((l) => {
          const dailyCap = Number(l.elder.protectionSettings?.absoluteDailyCap?.toString() || 1000);
          const monthlyBudget = Number(l.elder.protectionSettings?.monthlyBudget?.toString() || 2000);
          const todaySpend = spendingByElder[l.elder.id] || 0;
          const monthSpend = monthlySpendingByElder[l.elder.id] || 0;

          return {
            id: l.elder.id,
            fullName: l.elder.fullName,
            email: l.elder.email,
            phoneNumber: l.elder.phoneNumber,
            city: l.elder.city,
            primaryZipCode: l.elder.primaryZipCode,
            emergencyContactName: l.elder.emergencyContactName,
            emergencyContactPhone: l.elder.emergencyContactPhone,
            relationship: l.relationship,
            permission: {
              canView: l.permission?.canViewTransactions ?? true,
              canApprove: l.permission?.canApprovePayments ?? false,
              canManage: l.permission?.canManageSettings ?? false,
            },
            protectionSettings: l.elder.protectionSettings
              ? {
                  familyApprovalThreshold: Number(l.elder.protectionSettings.familyApprovalThreshold.toString()),
                  absoluteDailyCap: dailyCap,
                  absoluteTransactionCap: Number(l.elder.protectionSettings.absoluteTransactionCap.toString()),
                  monthlyBudget,
                  requireFamilyForNewRecipient: l.elder.protectionSettings.requireFamilyForNewRecipient,
                  requireFamilyForUnusual: l.elder.protectionSettings.requireFamilyForUnusual,
                }
              : {
                  familyApprovalThreshold: 100,
                  absoluteDailyCap: 1000,
                  absoluteTransactionCap: 500,
                  monthlyBudget: 2000,
                  requireFamilyForNewRecipient: true,
                  requireFamilyForUnusual: true,
                },
            todaySpend,
            monthSpend,
            remainingDailyCap: Math.max(0, dailyCap - todaySpend),
            remainingMonthlyBudget: Math.max(0, monthlyBudget - monthSpend),
          };
        }),
        pendingApprovalsCount: pendingApprovals.length,
        pendingApprovals: pendingApprovals.map((a) => ({
          id: a.id,
          paymentRequestId: a.paymentRequestId,
          elderName: a.elder.fullName,
          amount: Number(a.paymentRequest.amount.toString()),
          currency: a.paymentRequest.currency,
          merchantName: a.paymentRequest.recipient.merchantName,
          category: a.paymentRequest.recipient.category,
          expiresAt: a.expiresAt.toISOString(),
          riskScore: a.paymentRequest.currentRiskAssessment?.riskScore || 75,
          explanation: a.paymentRequest.currentRiskAssessment?.explanationContext
            ? (a.paymentRequest.currentRiskAssessment.explanationContext as {
                summary?: string;
                caregiverExplanation?: string;
                seniorExplanation?: string;
                suggestedQuestionsForSenior?: string[];
                riskFactors?: string[];
              })
            : null,
        })),
        pendingLimitRequests,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    } else {
      // Current user is a PROTECTED_USER (Senior)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const elder = await prisma.user.findUnique({
        where: { id: session.id },
        include: {
          protectionSettings: true,
          elderLinks: {
            where: { status: FamilyLinkStatus.ACTIVE },
            include: {
              caregiver: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phoneNumber: true,
                  preferredNotification: true,
                },
              },
              permission: true,
            },
          },
        },
      });

      const todaySum = await prisma.paymentRequest.aggregate({
        where: {
          elderId: session.id,
          status: { in: [PaymentRequestStatus.SETTLED, PaymentRequestStatus.APPROVED_FOR_CHECKOUT] },
          OR: [
            { settledAt: { gte: startOfDay } },
            { AND: [{ settledAt: null }, { createdAt: { gte: startOfDay } }] },
          ],
        },
        _sum: { amount: true },
      });

      const monthSum = await prisma.paymentRequest.aggregate({
        where: {
          elderId: session.id,
          status: { in: [PaymentRequestStatus.SETTLED, PaymentRequestStatus.APPROVED_FOR_CHECKOUT] },
          OR: [
            { settledAt: { gte: startOfMonth } },
            { AND: [{ settledAt: null }, { createdAt: { gte: startOfMonth } }] },
          ],
        },
        _sum: { amount: true },
      });

      const activeHolds = await prisma.paymentRequest.findMany({
        where: {
          elderId: session.id,
          status: PaymentRequestStatus.AWAITING_FAMILY,
        },
        include: {
          recipient: true,
          currentRiskAssessment: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const recentPayments = await prisma.paymentRequest.findMany({
        where: { elderId: session.id },
        include: {
          recipient: true,
          currentRiskAssessment: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Fetch pending limit increase requests for this senior
      const seniorLimitEvents = await prisma.auditEvent.findMany({
        where: {
          eventType: 'LIMIT_INCREASE_REQUESTED',
          oldState: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const seniorPendingLimitRequests = seniorLimitEvents
        .filter((ev) => {
          const meta = ev.metadata as Record<string, unknown> | null;
          return meta && meta.elderId === session.id;
        })
        .map((ev) => {
          const meta = (ev.metadata || {}) as Record<string, unknown>;
          return {
            id: ev.id,
            limitType: (meta.limitType as string) || 'DAILY',
            requestedAmount: Number(meta.requestedAmount || 0),
            reason: (meta.reason as string) || '',
            status: 'PENDING',
            createdAt: ev.createdAt.toISOString(),
          };
        });

      const dailyCap = Number(elder?.protectionSettings?.absoluteDailyCap?.toString() || 1000);
      const monthlyBudget = Number(elder?.protectionSettings?.monthlyBudget?.toString() || 2000);
      const todaySpend = Number(todaySum._sum.amount?.toString() || 0);
      const monthSpend = Number(monthSum._sum.amount?.toString() || 0);

      return NextResponse.json({
        role: 'PROTECTED_USER',
        user: session,
        todaySpend,
        monthSpend,
        dailyCap,
        monthlyBudget,
        remainingDailyCap: Math.max(0, dailyCap - todaySpend),
        remainingMonthlyBudget: Math.max(0, monthlyBudget - monthSpend),
        pendingLimitRequests: seniorPendingLimitRequests,
        familyThreshold: Number(elder?.protectionSettings?.familyApprovalThreshold?.toString() || 100),
        guardians: elder?.elderLinks
          ? elder.elderLinks.map((l) => ({
              id: l.caregiver.id,
              fullName: l.caregiver.fullName,
              email: l.caregiver.email,
              phoneNumber: l.caregiver.phoneNumber,
              preferredNotification: l.caregiver.preferredNotification,
              relationship: l.relationship,
              canApprove: l.permission?.canApprovePayments ?? false,
            }))
          : [],
        activeHolds: activeHolds.map((h) => ({
          id: h.id,
          amount: Number(h.amount.toString()),
          currency: h.currency,
          merchantName: h.recipient.merchantName,
          category: h.recipient.category,
          seniorMessage:
            (h.currentRiskAssessment?.explanationContext as { seniorMessage?: string; seniorExplanation?: string } | null)?.seniorMessage ||
            (h.currentRiskAssessment?.explanationContext as { seniorMessage?: string; seniorExplanation?: string } | null)?.seniorExplanation ||
            "We're checking in with your family to confirm this order.",
          createdAt: h.createdAt.toISOString(),
        })),
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount.toString()),
          currency: p.currency,
          status: p.status,
          merchantName: p.recipient.merchantName,
          category: p.recipient.category,
          createdAt: p.createdAt.toISOString(),
          riskScore: p.currentRiskAssessment?.riskScore || null,
          explanation: (p.currentRiskAssessment?.explanationContext as {
            summary?: string;
            seniorExplanation?: string;
            seniorMessage?: string;
            caregiverExplanation?: string;
          } | null) || null,
        })),
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching dashboard summary:', error);
    return NextResponse.json(
      { error: 'Internal error loading dashboard summary' },
      { status: 500 }
    );
  }
}
