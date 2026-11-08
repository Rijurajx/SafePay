import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyInvitationToken } from '@/lib/auth-tokens';
import { FamilyLinkStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, reason = 'Declined by senior member' } = body;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const verification = verifyInvitationToken(token);
    if (!verification.success || !verification.payload) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    const payload = verification.payload;

    const elder = await prisma.user.findUnique({
      where: { email: payload.elderEmailOrPhone },
      select: { id: true },
    });

    if (elder) {
      const familyLink = await prisma.familyLink.findUnique({
        where: {
          elderId_caregiverId: {
            elderId: elder.id,
            caregiverId: payload.caregiverId,
          },
        },
      });

      if (familyLink) {
        await prisma.familyLink.update({
          where: { id: familyLink.id },
          data: {
            status: FamilyLinkStatus.REVOKED,
            revokedAt: new Date(),
          },
        });

        await prisma.caregiverPermission.updateMany({
          where: { familyLinkId: familyLink.id },
          data: {
            canViewTransactions: false,
            canApprovePayments: false,
            canManageSettings: false,
          },
        });
      }

      // Audit Log
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: elder.id,
            eventType: 'ELDER_CONSENT_DECLINED',
            metadata: {
              elderId: elder.id,
              caregiverId: payload.caregiverId,
              reason,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit write error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation declined. No financial monitoring has been activated.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error declining invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
