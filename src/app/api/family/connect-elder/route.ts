import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Role, FamilyLinkStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      elderEmail,
      elderFullName,
      relationship = 'Family Member',
      canApprove = true,
      canManage = true,
      approvalThreshold = 100,
      dailyCap = 1000,
    } = body;

    if (!elderEmail || !elderFullName) {
      return NextResponse.json(
        { error: 'Elder email and full name are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = elderEmail.trim().toLowerCase();

    if (normalizedEmail === session.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot connect yourself as your own protected elder' },
        { status: 400 }
      );
    }

    // Check if elder user already exists
    let elder = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!elder) {
      // Create new elder account
      elder = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: elderFullName.trim(),
          roleDefault: Role.PROTECTED_USER,
          isSynthetic: false,
          isActive: true,
        },
      });

      // Initialize default protection settings
      await prisma.protectionSettings.create({
        data: {
          elderId: elder.id,
          absoluteTransactionCap: new Decimal(500.0),
          absoluteDailyCap: new Decimal(Number(dailyCap) || 1000.0),
          familyApprovalThreshold: new Decimal(Number(approvalThreshold) || 100.0),
          requireFamilyForNewRecipient: true,
          requireFamilyForUnusual: true,
          approvalTimeoutMinutes: 30,
        },
      });

      // Initialize spending baseline
      await prisma.spendingBaseline.create({
        data: {
          elderId: elder.id,
          version: 1,
          sampleSize: 10,
          medianTransaction: new Decimal(25.0),
          madTransaction: new Decimal(6.0),
          usualStartHour: 8,
          usualEndHour: 21,
          monthlyAverage: new Decimal(350.0),
          recipientStatistics: { familiarMerchants: [] },
        },
      });
    }

    // Create or update family link between caregiver and elder
    const familyLink = await prisma.familyLink.upsert({
      where: {
        elderId_caregiverId: {
          elderId: elder.id,
          caregiverId: session.id,
        },
      },
      update: {
        relationship,
        status: FamilyLinkStatus.ACTIVE,
      },
      create: {
        elderId: elder.id,
        caregiverId: session.id,
        relationship,
        status: FamilyLinkStatus.ACTIVE,
      },
    });

    // Create or update caregiver permissions
    await prisma.caregiverPermission.upsert({
      where: { familyLinkId: familyLink.id },
      update: {
        canViewTransactions: true,
        canApprovePayments: Boolean(canApprove),
        canManageSettings: Boolean(canManage),
      },
      create: {
        familyLinkId: familyLink.id,
        canViewTransactions: true,
        canApprovePayments: Boolean(canApprove),
        canManageSettings: Boolean(canManage),
      },
    });

    return NextResponse.json({
      success: true,
      elder: {
        id: elder.id,
        fullName: elder.fullName,
        email: elder.email,
      },
      link: {
        id: familyLink.id,
        relationship: familyLink.relationship,
        status: familyLink.status,
      },
    });
  } catch (error: unknown) {
    console.error('Error connecting elder:', error);
    return NextResponse.json(
      { error: 'Internal error connecting elder profile' },
      { status: 500 }
    );
  }
}

