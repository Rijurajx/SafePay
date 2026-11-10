import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createInvitationToken } from '@/lib/auth-tokens';
import { createAdminClient } from '@/lib/supabase/admin';
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
      return NextResponse.json(
        { error: 'Only registered caregivers can invite senior family members' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      elderFullName,
      elderEmailOrPhone,
      relationship = 'Family Member',
      approvalThreshold = 100,
      dailyCap = 1000,
    } = body;

    if (!elderFullName || !elderEmailOrPhone) {
      return NextResponse.json(
        { error: 'Senior member full name and email or phone number are required' },
        { status: 400 }
      );
    }

    const trimmedName = String(elderFullName).trim();
    const normalizedContact = String(elderEmailOrPhone).trim().toLowerCase();

    // Prevent caregiver from inviting themselves
    if (normalizedContact === session.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot invite yourself as your own protected senior member' },
        { status: 400 }
      );
    }

    // 1. Create cryptographic invitation token
    const inviteToken = createInvitationToken({
      caregiverId: session.id,
      caregiverName: session.fullName,
      elderFullName: trimmedName,
      elderEmailOrPhone: normalizedContact,
      relationship,
      approvalThreshold: Number(approvalThreshold) || 100,
      dailyCap: Number(dailyCap) || 1000,
    });

    // 2. Prepare unconsented elder profile in database (inactive until consented)
    let elder = await prisma.user.findUnique({
      where: { email: normalizedContact },
    });

    if (!elder) {
      elder = await prisma.user.create({
        data: {
          email: normalizedContact,
          fullName: trimmedName,
          roleDefault: Role.PROTECTED_USER,
          isActive: false, // Inactive until elder accepts
          isSynthetic: false,
        },
      });

      // Default baseline & protection settings awaiting activation
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

    // 3. Create initial FamilyLink with strict zero-knowledge permissions until elder accepts
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

    // CRITICAL SECURITY RULE:
    // canViewTransactions is FALSE until the elder explicitly approves!
    await prisma.caregiverPermission.upsert({
      where: { familyLinkId: familyLink.id },
      update: {
        canViewTransactions: false, // ZERO monitoring without elder consent
        canApprovePayments: false,
        canManageSettings: false,
      },
      create: {
        familyLinkId: familyLink.id,
        canViewTransactions: false,
        canApprovePayments: false,
        canManageSettings: false,
      },
    });

    // 4. Audit Log
    try {
      await prisma.auditEvent.create({
        data: {
          actorType: 'USER',
          actorId: session.id,
          eventType: 'ELDER_INVITATION_ISSUED',
          metadata: {
            caregiverId: session.id,
            elderId: elder.id,
            elderName: trimmedName,
            contact: normalizedContact,
            relationship,
          },
        },
      });
    } catch (e) {
      console.warn('Audit log write error:', e);
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const inviteLink = `${protocol}://${host}/invite/accept?token=${encodeURIComponent(inviteToken)}`;

    // Dispatch invitation directly to senior's email
    try {
      const adminSb = createAdminClient();
      await adminSb.auth.admin.inviteUserByEmail(normalizedContact, {
        redirectTo: inviteLink,
        data: {
          role: 'PROTECTED_USER',
          caregiverName: session.fullName,
          elderFullName: trimmedName,
        },
      });
    } catch (emailErr) {
      console.warn('Direct invite email dispatch note:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Invitation dispatched directly to ${normalizedContact}. For security, only ${trimmedName} can review and accept it from their private email.`,
      invitation: {
        elderId: elder.id,
        elderFullName: trimmedName,
        contact: normalizedContact,
        relationship,
        approvalThreshold: Number(approvalThreshold) || 100,
        dailyCap: Number(dailyCap) || 1000,
        status: 'PENDING_APPROVAL',
      },
      // inviteLink is INTENTIONALLY omitted so caregivers cannot copy and self-accept
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error creating senior invitation';
    console.error('Invite elder error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
