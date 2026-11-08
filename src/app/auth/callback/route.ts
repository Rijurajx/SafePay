import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { cookies } from 'next/headers';
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

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Supabase code exchange error:', error);
        return NextResponse.redirect(`${origin}/auth/signin?error=${encodeURIComponent(error.message)}`);
      }

      if (data?.user?.email) {
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
        }

        // 2. Issue SafePay session cookie
        const token = await generateSessionToken(dbUser.id, dbUser.email);
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
        });

        return NextResponse.redirect(`${origin}/dashboard`);
      }
    } catch (err) {
      console.error('Callback unexpected error:', err);
      return NextResponse.redirect(`${origin}/auth/signin?error=Failed to process Google login`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/signin?error=Missing authorization code`);
}
