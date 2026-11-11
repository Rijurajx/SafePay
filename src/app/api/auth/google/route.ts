import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email = 'maya.google@family-safepay.org', fullName = 'Maya Sterling-Lin (Google Verified)' } = body;

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Find or create user via Google OAuth profile
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const isLinkedAsElder = await prisma.familyLink.findFirst({
      where: {
        OR: [
          { elder: { email: normalizedEmail } },
          ...(user?.id ? [{ elderId: user.id }] : []),
        ],
      },
    });
    const hasCaregiverLinks = user?.id
      ? await prisma.familyLink.findFirst({ where: { caregiverId: user.id } })
      : null;

    let determinedRole: Role = Role.CAREGIVER;
    if (user?.roleDefault === Role.PROTECTED_USER || (isLinkedAsElder && !hasCaregiverLinks)) {
      determinedRole = Role.PROTECTED_USER;
    } else if (user?.roleDefault) {
      determinedRole = user.roleDefault;
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: String(fullName).trim(),
          roleDefault: determinedRole,
          isActive: true,
          isSynthetic: false,
        },
      });

      // Audit event
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: user.id,
            eventType: determinedRole === Role.PROTECTED_USER ? 'ELDER_GOOGLE_OAUTH_REGISTERED' : 'CAREGIVER_GOOGLE_OAUTH_REGISTERED',
            metadata: {
              email: normalizedEmail,
              provider: 'google',
              role: determinedRole,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit log write error:', e);
      }
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          roleDefault: determinedRole,
          isActive: true,
        },
      });
    }

    // 2. Issue session token
    const token = await generateSessionToken(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      message: 'Google authentication successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleDefault,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error processing Google OAuth';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
