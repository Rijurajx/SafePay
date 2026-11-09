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

      // Today's total spending by elders
      const spendingByElder: Record<string, number> = {};
      for (const eId of elderIds) {
        const sum = await prisma.paymentRequest.aggregate({
          where: {
            elderId: eId,
            status: PaymentRequestStatus.SETTLED,
            settledAt: { gte: startOfDay },
          },
          _sum: { amount: true },
        });
        spendingByElder[eId] = Number(sum._sum.amount?.toString() || 0);
      }

      return NextResponse.json({
        role: 'CAREGIVER',
        user: session,
        linkedElders: links.map((l) => ({
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
                absoluteDailyCap: Number(l.elder.protectionSettings.absoluteDailyCap.toString()),
                absoluteTransactionCap: Number(l.elder.protectionSettings.absoluteTransactionCap.toString()),
                monthlyBudget: l.elder.protectionSettings.monthlyBudget ? Number(l.elder.protectionSettings.monthlyBudget.toString()) : null,
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
          todaySpend: spendingByElder[l.elder.id] || 0,
        })),
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
          explanation: a.paymentRequest.currentRiskAssessment?.explanationContext,
        })),
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    } else {
      // Current user is a PROTECTED_USER (Senior)
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
          status: PaymentRequestStatus.SETTLED,
          settledAt: { gte: startOfDay },
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
        include: { recipient: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });

      return NextResponse.json({
        role: 'PROTECTED_USER',
        user: session,
        todaySpend: Number(todaySum._sum.amount?.toString() || 0),
        dailyCap: Number(elder?.protectionSettings?.absoluteDailyCap?.toString() || 1000),
        familyThreshold: Number(elder?.protectionSettings?.familyApprovalThreshold?.toString() || 100),
        monthlyBudget: Number(elder?.protectionSettings?.monthlyBudget?.toString() || 2000),
        guardians: elder?.elderLinks.map((l) => ({
          id: l.caregiver.id,
          fullName: l.caregiver.fullName,
          email: l.caregiver.email,
          phoneNumber: l.caregiver.phoneNumber,
          preferredNotification: l.caregiver.preferredNotification,
          relationship: l.relationship,
          canApprove: l.permission?.canApprovePayments ?? false,
        })) || [],
        activeHolds: activeHolds.map((h) => ({
          id: h.id,
          amount: Number(h.amount.toString()),
          currency: h.currency,
          merchantName: h.recipient.merchantName,
          category: h.recipient.category,
          seniorMessage: (h.currentRiskAssessment?.explanationContext as { seniorMessage?: string } | null)?.seniorMessage ||
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
