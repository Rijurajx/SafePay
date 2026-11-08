import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    console.error('OAuth error from provider:', errorDescription);
    return NextResponse.redirect(`${origin}/auth/signin?error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/signin?error=Missing authorization code`);
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Supabase code exchange error:', error);
      return NextResponse.redirect(`${origin}/auth/signin?error=${encodeURIComponent(error.message)}`);
    }

    if (!data?.user?.email) {
      return NextResponse.redirect(`${origin}/auth/signin?error=Google account has no associated email`);
    }

    const userEmail = data.user.email.toLowerCase();
    const userName =
      data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      data.user.email.split('@')[0];

    // 1. Locate or create caregiver in database
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
          supabaseId: data.user.id,
        },
      });

      // Audit Event
      try {
        await prisma.auditEvent.create({
          data: {
            actorType: 'USER',
            actorId: dbUser.id,
            eventType: 'CAREGIVER_GOOGLE_OAUTH_REGISTERED',
            metadata: {
              email: userEmail,
              provider: 'google',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        console.warn('Audit event failed on Google callback:', e);
      }
    } else {
      // User already exists in PostgreSQL:
      // Guarantee that authenticating via Caregiver OAuth establishes them as a CAREGIVER,
      // never leaving them in an elder state from a previous test invite!
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          supabaseId: data.user.id,
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

    // 2. Issue SafePay session cookie directly on the redirect response!
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
    return NextResponse.redirect(`${origin}/auth/signin?error=Failed to process Google login`);
  }
}
