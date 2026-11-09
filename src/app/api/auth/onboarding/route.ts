import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createInvitationToken } from '@/lib/auth-tokens';
import { Role, FamilyLinkStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.roleDefault !== Role.CAREGIVER) {
      return NextResponse.json({ error: 'Only caregivers can complete caregiver onboarding' }, { status: 403 });
    }

    const body = await req.json();
    const {
      fullName,
      caregiverPhone,
      caregiverNotification = 'BOTH',
      elderFullName,
      elderEmailOrPhone,
      elderPhone,
      elderCity,
      elderZipCode,
      relationship = 'Parent',
      familyApprovalThreshold = 100,
      absoluteDailyCap = 500,
      absoluteTransactionCap = 1000,
      monthlyBudget = 2000,
      requireFamilyForNewRecipient = true,
      requireFamilyForUnusual = true,
      emergencyContactName,
      emergencyContactPhone,
    } = body;

    let caregiverName = session.fullName;

    // 1. Update Caregiver's customized profile data
    const caregiverData: Record<string, unknown> = {};
    if (fullName && typeof fullName === 'string' && fullName.trim()) {
      caregiverName = fullName.trim();
      caregiverData.fullName = caregiverName;
    }
    if (caregiverPhone) {
      caregiverData.phoneNumber = String(caregiverPhone).trim();
    }
    if (caregiverNotification) {
      caregiverData.preferredNotification = caregiverNotification;
    }

    if (Object.keys(caregiverData).length > 0) {
      await prisma.user.update({
        where: { id: session.id },
        data: caregiverData,
      });
    }

    let inviteLink: string | null = null;
    let elderId: string | null = null;

    // 2. If elder details provided, create elder and customized protection settings
    if (elderFullName && elderEmailOrPhone) {
      const trimmedElderName = String(elderFullName).trim();
      const normalizedContact = String(elderEmailOrPhone).trim().toLowerCase();

      if (normalizedContact === session.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'You cannot invite yourself as your own senior member' },
          { status: 400 }
        );
      }

      const thresholdNum = Number(familyApprovalThreshold) || 100;
      const dailyCapNum = Number(absoluteDailyCap) || 500;
      const transCapNum = Number(absoluteTransactionCap) || 1000;
      const monthlyBudgetNum = Number(monthlyBudget) || 2000;

      // 2a. Find or create elder user
      let elder = await prisma.user.findUnique({
        where: { email: normalizedContact },
      });

      const elderDataToSave = {
        fullName: trimmedElderName,
        ...(elderPhone ? { phoneNumber: String(elderPhone).trim() } : {}),
        ...(elderCity ? { city: String(elderCity).trim() } : {}),
        ...(elderZipCode ? { primaryZipCode: String(elderZipCode).trim() } : {}),
        ...(emergencyContactName ? { emergencyContactName: String(emergencyContactName).trim() } : {}),
        ...(emergencyContactPhone ? { emergencyContactPhone: String(emergencyContactPhone).trim() } : {}),
      };

      if (!elder) {
        elder = await prisma.user.create({
          data: {
            email: normalizedContact,
            ...elderDataToSave,
            roleDefault: Role.PROTECTED_USER,
            isActive: false, // Inactive until elder accepts invite
            isSynthetic: false,
          },
        });
      } else {
        elder = await prisma.user.update({
          where: { id: elder.id },
          data: elderDataToSave,
        });
      }

      elderId = elder.id;

      // 2b. Configure customized protection settings
      await prisma.protectionSettings.upsert({
        where: { elderId: elder.id },
        create: {
          elderId: elder.id,
          currency: 'USD',
          familyApprovalThreshold: new Decimal(thresholdNum),
          absoluteDailyCap: new Decimal(dailyCapNum),
          absoluteTransactionCap: new Decimal(transCapNum),
          monthlyBudget: new Decimal(monthlyBudgetNum),
          requireFamilyForNewRecipient: Boolean(requireFamilyForNewRecipient),
          requireFamilyForUnusual: Boolean(requireFamilyForUnusual),
          approvalTimeoutMinutes: 30,
        },
        update: {
          familyApprovalThreshold: new Decimal(thresholdNum),
          absoluteDailyCap: new Decimal(dailyCapNum),
          absoluteTransactionCap: new Decimal(transCapNum),
          monthlyBudget: new Decimal(monthlyBudgetNum),
          requireFamilyForNewRecipient: Boolean(requireFamilyForNewRecipient),
          requireFamilyForUnusual: Boolean(requireFamilyForUnusual),
          version: { increment: 1 },
        },
      });

      // 2c. Upsert default baseline
      const existingBaseline = await prisma.spendingBaseline.findUnique({
        where: { elderId_version: { elderId: elder.id, version: 1 } },
      });
      if (!existingBaseline) {
        await prisma.spendingBaseline.create({
          data: {
            elderId: elder.id,
            version: 1,
            sampleSize: 10,
            medianTransaction: new Decimal(Math.min(25, thresholdNum * 0.25)),
            madTransaction: new Decimal(6.0),
            usualStartHour: 8,
            usualEndHour: 21,
            monthlyAverage: new Decimal(dailyCapNum * 0.4),
            recipientStatistics: {},
          },
        });
      }

      // 2d. Link Caregiver and Senior Member
      const familyLink = await prisma.familyLink.upsert({
        where: {
          elderId_caregiverId: {
            elderId: elder.id,
            caregiverId: session.id,
          },
        },
        create: {
          elderId: elder.id,
          caregiverId: session.id,
          relationship: relationship || 'Family Member',
          status: FamilyLinkStatus.ACTIVE,
        },
        update: {
          relationship: relationship || 'Family Member',
          status: FamilyLinkStatus.ACTIVE,
        },
      });

      // Grant permissions awaiting elder's consent
      await prisma.caregiverPermission.upsert({
        where: { familyLinkId: familyLink.id },
        create: {
          familyLinkId: familyLink.id,
          canViewTransactions: true,
          canApprovePayments: true,
          canManageSettings: true,
        },
        update: {
          canViewTransactions: true,
          canApprovePayments: true,
          canManageSettings: true,
        },
      });

      // 2e. Generate cryptographic invitation token
      const token = createInvitationToken({
        caregiverId: session.id,
        caregiverName: caregiverName,
        elderFullName: trimmedElderName,
        elderEmailOrPhone: normalizedContact,
        relationship: relationship || 'Family Member',
        approvalThreshold: thresholdNum,
        dailyCap: dailyCapNum,
      });

      const host = req.headers.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      inviteLink = `${protocol}://${host}/invite/accept?token=${encodeURIComponent(token)}`;
    }

    // 3. Audit Event
    try {
      await prisma.auditEvent.create({
        data: {
          actorType: 'USER',
          actorId: session.id,
          eventType: 'CAREGIVER_ONBOARDING_COMPLETED',
          metadata: {
            caregiverName,
            elderId,
            hasElderConfigured: !!elderId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.warn('Audit event failed on onboarding:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Caregiver profile and protection settings configured successfully',
      caregiverName,
      elderId,
      inviteLink,
    });
  } catch (error: unknown) {
    console.error('Onboarding setup error:', error);
    return NextResponse.json({ error: 'Failed to complete profile onboarding' }, { status: 500 });
  }
}
