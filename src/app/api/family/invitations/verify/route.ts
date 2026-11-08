import { NextRequest, NextResponse } from 'next/server';
import { verifyInvitationToken } from '@/lib/auth-tokens';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const verification = verifyInvitationToken(token);
    if (!verification.success || !verification.payload) {
      return NextResponse.json({ error: verification.error || 'Invalid invitation link' }, { status: 400 });
    }

    const payload = verification.payload;

    // Check if caregiver exists and is active
    let caregiverName = payload.caregiverName;
    try {
      const caregiver = await prisma.user.findUnique({
        where: { id: payload.caregiverId },
        select: { fullName: true, email: true },
      });
      if (caregiver) {
        caregiverName = caregiver.fullName;
      }
    } catch (e) {
      console.warn('DB check for caregiver:', e);
    }

    return NextResponse.json({
      success: true,
      invitation: {
        caregiverId: payload.caregiverId,
        caregiverName,
        elderFullName: payload.elderFullName,
        elderEmailOrPhone: payload.elderEmailOrPhone,
        relationship: payload.relationship,
        approvalThreshold: payload.approvalThreshold,
        dailyCap: payload.dailyCap,
        expiresAt: new Date(payload.expiresAt).toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error verifying invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
