import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { Role, FamilyLinkStatus } from '@prisma/client';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { Decimal } from '@prisma/client/runtime/library';

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

    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(friendlyMessage)}`);
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
          `${origin}/signin?error=${encodeURIComponent('The email verification link has expired or was already used.')}`
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
        `${origin}/signin?error=${encodeURIComponent('Could not verify email. Please try signing in or requesting a new confirmation link.')}`
      );
    }

    const userEmail = authUser.email.toLowerCase();
    const userName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email.split('@')[0];

    // 4. Locate or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    // Check if user is linked as an elder
    const isLinkedAsElder = await prisma.familyLink.findFirst({
      where: {
        OR: [
          { elder: { email: userEmail } },
          ...(dbUser?.id ? [{ elderId: dbUser.id }] : []),
        ],
      },
    });
    const hasCaregiverLinks = dbUser?.id
      ? await prisma.familyLink.findFirst({ where: { caregiverId: dbUser.id } })
      : null;

    // Strict role determination: preserve PROTECTED_USER or detect elder linkage
    let determinedRole: Role = Role.CAREGIVER;
    if (dbUser?.roleDefault === Role.PROTECTED_USER || (isLinkedAsElder && !hasCaregiverLinks)) {
      determinedRole = Role.PROTECTED_USER;
    } else if (
      authUser.user_metadata?.role === 'PROTECTED_USER' ||
      authUser.user_metadata?.is_elder
    ) {
      determinedRole = Role.PROTECTED_USER;
    } else if (dbUser?.roleDefault) {
      determinedRole = dbUser.roleDefault;
    }

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: userEmail,
          fullName: userName,
          roleDefault: determinedRole,
          isActive: true,
          isSynthetic: false,
          supabaseId: authUser.id,
        },
      });

      if (determinedRole === Role.PROTECTED_USER) {
        await prisma.protectionSettings.upsert({
          where: { elderId: dbUser.id },
          create: {
            elderId: dbUser.id,
            currency: 'USD',
            familyApprovalThreshold: new Decimal(100),
            absoluteDailyCap: new Decimal(1000),
            absoluteTransactionCap: new Decimal(500),
            monthlyBudget: new Decimal(2000),
            requireFamilyForNewRecipient: true,
            requireFamilyForUnusual: true,
            approvalTimeoutMinutes: 30,
          },
          update: {},
        });
      }

      // Audit Event
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: dbUser.id,
            eventType: determinedRole === Role.PROTECTED_USER ? 'ELDER_EMAIL_VERIFIED' : 'CAREGIVER_EMAIL_VERIFIED',
            metadata: {
              email: userEmail,
              supabaseId: authUser.id,
              authFlow: code ? 'pkce_code' : tokenHash ? 'token_hash' : 'session_fallback',
              role: determinedRole,
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit event failed on email verification callback:', e);
      }
    } else {
      // User exists in PostgreSQL:
      // Guarantee that authenticating maintains their genuine role and activates them
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          supabaseId: authUser.id,
          roleDefault: determinedRole,
          isActive: true,
          ...(userName && (!dbUser.fullName || dbUser.fullName.includes('Father') || dbUser.fullName.includes('Dad') || dbUser.fullName.includes('Thomas'))
            ? { fullName: userName }
            : {}),
        },
      });

      // If elder, activate their family link and permissions
      if (determinedRole === Role.PROTECTED_USER) {
        try {
          await prisma.familyLink.updateMany({
            where: { elderId: dbUser.id },
            data: { status: FamilyLinkStatus.ACTIVE, consentedAt: new Date() },
          });
          await prisma.caregiverPermission.updateMany({
            where: { familyLink: { elderId: dbUser.id } },
            data: { canViewTransactions: true, canApprovePayments: true },
          });
        } catch (e) {
          console.warn('Notice activating elder links:', e);
        }
      }
    }

    // Keep Supabase user metadata in sync with true role
    try {
      const adminSb = createAdminClient();
      await adminSb.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          role: determinedRole,
          is_elder: determinedRole === Role.PROTECTED_USER,
        },
      });
    } catch (syncErr) {
      console.warn('Supabase metadata sync notice on callback:', syncErr);
    }

    // 5. Determine destination:
    // Protected elders go straight to /dashboard (Senior Shield).
    // Caregivers with 0 linked elders go to /onboarding.
    let targetUrl = `${origin}/dashboard`;
    if (determinedRole === Role.CAREGIVER) {
      const linkedEldersCount = await prisma.familyLink.count({
        where: { caregiverId: dbUser.id },
      });
      targetUrl = linkedEldersCount === 0 ? `${origin}/onboarding` : `${origin}/dashboard`;
    }
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
    return NextResponse.redirect(`${origin}/signin?error=Failed to process authentication`);
  }
}
