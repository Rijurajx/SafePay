import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { Role } from '@prisma/client';
import { type EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription || errorParam) {
    const rawError = errorDescription || errorParam || 'Authentication verification failed';
    console.error('Supabase callback error param:', rawError);

    let friendlyMessage = rawError;
    if (
      rawError.toLowerCase().includes('expired') ||
      rawError.toLowerCase().includes('invalid') ||
      rawError.toLowerCase().includes('otp_expired')
    ) {
      friendlyMessage =
        'This verification link is invalid or has expired. If you already verified, please sign in. Otherwise, please sign up again to receive a fresh verification link.';
    }

    return NextResponse.redirect(`${origin}/auth/signin?error=${encodeURIComponent(friendlyMessage)}`);
  }

  // Pre-create the redirect response so all cookies (both Supabase and SafePay) are explicitly stamped onto it
  const response = NextResponse.redirect(`${origin}/dashboard`);

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
            });
          },
        },
      }
    );

    let authUser = null;

    // 1. PKCE Code Exchange Flow (Google OAuth or PKCE Email Confirmation)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn('Code exchange error, attempting OTP or session lookup:', error.message);
      } else {
        authUser = data?.user;
      }
    }

    // 2. Token Hash OTP Verification Flow (Supabase Email Confirmation Links)
    if (!authUser && tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      if (error) {
        console.error('Supabase token verification error:', error);
        return NextResponse.redirect(
          `${origin}/auth/signin?error=${encodeURIComponent('The email verification link has expired or was already used.')}`
        );
      }
      authUser = data?.user;
    }

    // 3. Fallback to existing active session if available
    if (!authUser) {
      const { data } = await supabase.auth.getUser();
      authUser = data?.user;
    }

    if (!authUser?.email) {
      return NextResponse.redirect(
        `${origin}/auth/signin?error=${encodeURIComponent('Could not verify email. Please try signing in or requesting a new confirmation link.')}`
      );
    }

    const userEmail = authUser.email.toLowerCase();
    const userName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email.split('@')[0];

    // 4. Locate or create caregiver in database
    let dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: userEmail,
          fullName: userName,
          roleDefault: Role.CAREGIVER,
          isActive: true,
          isSynthetic: false,
          supabaseId: authUser.id,
        },
      });

      // Audit Event
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: dbUser.id,
            eventType: 'CAREGIVER_EMAIL_VERIFIED',
            metadata: {
              email: userEmail,
              supabaseId: authUser.id,
              authFlow: code ? 'pkce_code' : tokenHash ? 'token_hash' : 'session_fallback',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit event failed on email verification callback:', e);
      }
    } else {
      // User exists in PostgreSQL:
      // Guarantee that authenticating establishes them as an active CAREGIVER
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          supabaseId: authUser.id,
          roleDefault: Role.CAREGIVER,
          isActive: true,
          ...(userName && (!dbUser.fullName || dbUser.fullName.includes('Father') || dbUser.fullName.includes('Dad') || dbUser.fullName.includes('Thomas'))
            ? { fullName: userName }
            : {}),
        },
      });

      // Clear any pending/unconsented elder invitations where this email was entered
      try {
        await prisma.familyLink.deleteMany({
          where: {
            elderId: dbUser.id,
            permission: {
              canViewTransactions: false,
            },
          },
        });
      } catch (e) {
        console.warn('Notice cleaning unconsented elder links:', e);
      }
    }

    // 5. Determine destination: If caregiver has 0 linked elders, route to onboarding for profile & limits customization
    const linkedEldersCount = await prisma.familyLink.count({
      where: {
        caregiverId: dbUser.id,
      },
    });

    const targetUrl = linkedEldersCount === 0 ? `${origin}/auth/onboarding` : `${origin}/dashboard`;
    response.headers.set('Location', targetUrl);

    // Issue SafePay session cookie directly on the redirect response!
    const token = await generateSessionToken(dbUser.id, dbUser.email);
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err) {
    console.error('Callback unexpected error:', err);
    return NextResponse.redirect(`${origin}/auth/signin?error=Failed to process authentication`);
  }
}
