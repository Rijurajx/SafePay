import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyInvitationToken } from '@/lib/auth-tokens';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { Role, FamilyLinkStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Invitation token and chosen account password are required' },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // 1. Verify invitation token
    const verification = verifyInvitationToken(token);
    if (!verification.success || !verification.payload) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    const payload = verification.payload;
    const passwordHash = await bcrypt.hash(password, 10);

    // 2. Locate or create elder account
    let elder = await prisma.user.findUnique({
      where: { email: payload.elderEmailOrPhone },
    });

    if (!elder) {
      elder = await prisma.user.create({
        data: {
          email: payload.elderEmailOrPhone,
          fullName: payload.elderFullName,
          passwordHash,
          roleDefault: Role.PROTECTED_USER,
          isActive: true,
          isSynthetic: false,
        },
      });
    } else {
      elder = await prisma.user.update({
        where: { id: elder.id },
        data: {
          passwordHash,
          isActive: true,
          fullName: payload.elderFullName,
        },
      });
    }

    // 3. Grant active FamilyLink with recorded consent timestamp
    const familyLink = await prisma.familyLink.upsert({
      where: {
        elderId_caregiverId: {
          elderId: elder.id,
          caregiverId: payload.caregiverId,
        },
      },
      update: {
        status: FamilyLinkStatus.ACTIVE,
        consentedAt: new Date(),
        revokedAt: null,
      },
      create: {
        elderId: elder.id,
        caregiverId: payload.caregiverId,
        relationship: payload.relationship,
        status: FamilyLinkStatus.ACTIVE,
        consentedAt: new Date(),
      },
    });

    // 4. NOW AND ONLY NOW: Grant transaction monitoring permissions
    await prisma.caregiverPermission.upsert({
      where: { familyLinkId: familyLink.id },
      update: {
        canViewTransactions: true,
        canApprovePayments: true,
      },
      create: {
        familyLinkId: familyLink.id,
        canViewTransactions: true,
        canApprovePayments: true,
      },
    });

    // 5. Audit Logging
    try {
      await prisma.auditEvent.create({
        data: {
          actorType: 'USER',
          actorId: elder.id,
          eventType: 'ELDER_CONSENT_GRANTED',
          metadata: {
            elderId: elder.id,
            caregiverId: payload.caregiverId,
            relationship: payload.relationship,
            consentedAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.warn('Audit log write error:', e);
    }

    // 6. Sign in senior member directly
    const sessionToken = await generateSessionToken(elder.id, elder.email);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted! Your SafePay protection circle is now active.',
      elder: {
        id: elder.id,
        fullName: elder.fullName,
        email: elder.email,
        role: Role.PROTECTED_USER,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error accepting invitation';
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
