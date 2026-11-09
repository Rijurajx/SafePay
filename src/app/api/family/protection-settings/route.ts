import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const elderId = searchParams.get('elderId');

    if (!elderId) {
      return NextResponse.json({ error: 'elderId query parameter is required' }, { status: 400 });
    }

    // Verify permission: caregiver must be linked or user is the elder themselves
    if (session.roleDefault === Role.CAREGIVER) {
      const link = await prisma.familyLink.findFirst({
        where: { caregiverId: session.id, elderId },
      });
      if (!link) {
        return NextResponse.json({ error: 'Not authorized for this senior member' }, { status: 403 });
      }
    } else if (session.id !== elderId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const settings = await prisma.protectionSettings.findUnique({
      where: { elderId },
    });

    return NextResponse.json({
      success: true,
      protectionSettings: settings
        ? {
            id: settings.id,
            elderId: settings.elderId,
            familyApprovalThreshold: Number(settings.familyApprovalThreshold.toString()),
            absoluteDailyCap: Number(settings.absoluteDailyCap.toString()),
            absoluteTransactionCap: Number(settings.absoluteTransactionCap.toString()),
            monthlyBudget: settings.monthlyBudget ? Number(settings.monthlyBudget.toString()) : null,
            requireFamilyForNewRecipient: settings.requireFamilyForNewRecipient,
            requireFamilyForUnusual: settings.requireFamilyForUnusual,
            approvalTimeoutMinutes: settings.approvalTimeoutMinutes,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error('Fetch protection settings error:', error);
    return NextResponse.json({ error: 'Failed to retrieve protection settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.roleDefault !== Role.CAREGIVER) {
      return NextResponse.json({ error: 'Only caregivers can adjust safety limits' }, { status: 403 });
    }

    const body = await req.json();
    const {
      elderId,
      familyApprovalThreshold,
      absoluteDailyCap,
      absoluteTransactionCap,
      monthlyBudget,
      requireFamilyForNewRecipient,
      requireFamilyForUnusual,
      approvalTimeoutMinutes,
    } = body;

    if (!elderId) {
      return NextResponse.json({ error: 'elderId is required' }, { status: 400 });
    }

    // Verify caregiver has a link to this elder
    const link = await prisma.familyLink.findFirst({
      where: { caregiverId: session.id, elderId },
    });

    if (!link) {
      return NextResponse.json({ error: 'Not authorized for this senior member' }, { status: 403 });
    }

    // Fetch existing settings or create if not present
    const existing = await prisma.protectionSettings.findUnique({
      where: { elderId },
    });

    const thresholdNum = familyApprovalThreshold !== undefined ? Number(familyApprovalThreshold) : Number(existing?.familyApprovalThreshold || 100);
    const dailyCapNum = absoluteDailyCap !== undefined ? Number(absoluteDailyCap) : Number(existing?.absoluteDailyCap || 1000);
    const transCapNum = absoluteTransactionCap !== undefined ? Number(absoluteTransactionCap) : Number(existing?.absoluteTransactionCap || 500);

    if (thresholdNum <= 0 || dailyCapNum <= 0) {
      return NextResponse.json({ error: 'Limits must be positive values' }, { status: 400 });
    }

    if (thresholdNum > dailyCapNum) {
      return NextResponse.json(
        { error: 'Auto-approval threshold cannot be greater than the daily cap limit' },
        { status: 400 }
      );
    }

    const updated = await prisma.protectionSettings.upsert({
      where: { elderId },
      create: {
        elderId,
        familyApprovalThreshold: new Decimal(thresholdNum),
        absoluteDailyCap: new Decimal(dailyCapNum),
        absoluteTransactionCap: new Decimal(transCapNum),
        monthlyBudget: monthlyBudget ? new Decimal(Number(monthlyBudget)) : null,
        requireFamilyForNewRecipient: requireFamilyForNewRecipient !== undefined ? Boolean(requireFamilyForNewRecipient) : true,
        requireFamilyForUnusual: requireFamilyForUnusual !== undefined ? Boolean(requireFamilyForUnusual) : true,
        approvalTimeoutMinutes: approvalTimeoutMinutes !== undefined ? Number(approvalTimeoutMinutes) : 30,
        version: 1,
      },
      update: {
        familyApprovalThreshold: new Decimal(thresholdNum),
        absoluteDailyCap: new Decimal(dailyCapNum),
        absoluteTransactionCap: new Decimal(transCapNum),
        ...(monthlyBudget !== undefined ? { monthlyBudget: monthlyBudget ? new Decimal(Number(monthlyBudget)) : null } : {}),
        ...(requireFamilyForNewRecipient !== undefined ? { requireFamilyForNewRecipient: Boolean(requireFamilyForNewRecipient) } : {}),
        ...(requireFamilyForUnusual !== undefined ? { requireFamilyForUnusual: Boolean(requireFamilyForUnusual) } : {}),
        ...(approvalTimeoutMinutes !== undefined ? { approvalTimeoutMinutes: Number(approvalTimeoutMinutes) } : {}),
        version: { increment: 1 },
      },
    });

    // Audit event
    try {
      await prisma.auditEvent.create({
        data: {
          actorType: 'USER',
          actorId: session.id,
          eventType: 'PROTECTION_SETTINGS_UPDATED',
          metadata: {
            caregiverId: session.id,
            elderId,
            threshold: thresholdNum,
            dailyCap: dailyCapNum,
            transactionCap: transCapNum,
            monthlyBudget: updated.monthlyBudget ? Number(updated.monthlyBudget.toString()) : null,
            requireFamilyForNewRecipient: updated.requireFamilyForNewRecipient,
            requireFamilyForUnusual: updated.requireFamilyForUnusual,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (auditErr) {
      console.warn('Audit event failed on protection settings update:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Safety limits updated successfully',
      protectionSettings: {
        id: updated.id,
        elderId: updated.elderId,
        familyApprovalThreshold: Number(updated.familyApprovalThreshold.toString()),
        absoluteDailyCap: Number(updated.absoluteDailyCap.toString()),
        absoluteTransactionCap: Number(updated.absoluteTransactionCap.toString()),
        monthlyBudget: updated.monthlyBudget ? Number(updated.monthlyBudget.toString()) : null,
        requireFamilyForNewRecipient: updated.requireFamilyForNewRecipient,
        requireFamilyForUnusual: updated.requireFamilyForUnusual,
        approvalTimeoutMinutes: updated.approvalTimeoutMinutes,
      },
    });
  } catch (error: unknown) {
    console.error('Update protection settings error:', error);
    return NextResponse.json({ error: 'Failed to update protection settings' }, { status: 500 });
  }
}
