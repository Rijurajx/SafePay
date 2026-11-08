import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { verifyVerificationTicket } from '@/lib/auth-tokens';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { verificationTicket, code, email: directEmail, fullName: directFullName, password: directPassword, supabaseId } = body;

    let verifiedEmail = '';
    let verifiedFullName = '';
    let userPasswordHash: string | undefined;

    if (supabaseId && directEmail) {
      // Real Supabase OTP Verified Flow
      verifiedEmail = directEmail.trim().toLowerCase();
      verifiedFullName = (directFullName || verifiedEmail.split('@')[0]).trim();
      if (directPassword) {
        userPasswordHash = await bcrypt.hash(directPassword, 10);
      }
    } else {
      // Cryptographic Ticket Flow
      if (!verificationTicket || !code) {
        return NextResponse.json(
          { error: 'Verification ticket and 6-digit confirmation code are required' },
          { status: 400 }
        );
      }

      const trimmedCode = String(code).trim();
      if (!/^\d{6}$/.test(trimmedCode)) {
        return NextResponse.json(
          { error: 'Verification code must be exactly 6 digits' },
          { status: 400 }
        );
      }

      const result = verifyVerificationTicket(verificationTicket, trimmedCode);

      if (!result.success || !result.payload) {
        return NextResponse.json(
          {
            error: result.error || 'Verification failed. Please try again.',
            nextTicket: result.nextTicket,
          },
          { status: 400 }
        );
      }

      verifiedEmail = result.payload.email;
      verifiedFullName = result.payload.fullName;
      userPasswordHash = result.payload.passwordHash;
    }

    // 2. Check if user already exists (idempotency guard)
    let user = await prisma.user.findUnique({
      where: { email: verifiedEmail },
    });

    if (!user) {
      // 3. Persist verified Caregiver account into database
      user = await prisma.user.create({
        data: {
          email: verifiedEmail,
          fullName: verifiedFullName,
          passwordHash: userPasswordHash,
          supabaseId: supabaseId || null,
          roleDefault: Role.CAREGIVER,
          isActive: true,
          isSynthetic: false,
        },
      });

      // 4. Record Audit Event
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: user.id,
            eventType: 'CAREGIVER_EMAIL_VERIFIED',
            metadata: {
              email: verifiedEmail,
              fullName: verifiedFullName,
              supabaseId: supabaseId || null,
              verifiedAt: new Date().toISOString(),
            },
          },
        });
      } catch (auditErr) {
        console.warn('Audit event creation failed:', auditErr);
      }
    } else {
      // Update existing record to guarantee CAREGIVER role & active status
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          roleDefault: Role.CAREGIVER,
          isActive: true,
          ...(supabaseId ? { supabaseId } : {}),
          ...(userPasswordHash ? { passwordHash: userPasswordHash } : {}),
          ...(verifiedFullName ? { fullName: verifiedFullName } : {}),
        },
      });
    }

    // 5. Generate signed HTTP-only session token
    const token = await generateSessionToken(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      message: 'Email successfully verified! Your caregiver account is active.',
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
    const message = error instanceof Error ? error.message : 'Internal error verifying confirmation code';
    console.error('Email verification error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
