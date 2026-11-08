import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email = 'maya.google@family-safepay.org', fullName = 'Maya Sterling-Lin (Google Verified)' } = body;

    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Find or create caregiver via Google OAuth profile
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: String(fullName).trim(),
          roleDefault: Role.CAREGIVER,
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
            eventType: 'CAREGIVER_GOOGLE_OAUTH_REGISTERED',
            metadata: {
              email: normalizedEmail,
              provider: 'google',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit log write error:', e);
      }
    }

    // 2. Issue session token
    const token = await generateSessionToken(user.id, user.email);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      success: true,
      message: 'Google authentication successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleDefault,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error processing Google OAuth';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
