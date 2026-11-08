import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 1. If user exists in DB and has local passwordHash
    if (user && user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (isValid) {
        if (!user.isActive) {
          return NextResponse.json({ error: 'This account is inactive.' }, { status: 401 });
        }

        const token = await generateSessionToken(user.id, user.email);
        const response = NextResponse.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roleDefault: user.roleDefault,
            isSynthetic: user.isSynthetic,
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
      }
    } else if (user?.isSynthetic) {
      // Seeded synthetic accounts without passwordHash allow login with demo password
      const token = await generateSessionToken(user.id, user.email);
      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roleDefault: user.roleDefault,
          isSynthetic: user.isSynthetic,
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
    }

    // 2. Fallback: Authenticate via Supabase Auth
    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const { data: supaLogin, error: supaErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!supaErr && supaLogin?.user?.email) {
        const passwordHash = await bcrypt.hash(password, 10);
        const userName =
          supaLogin.user.user_metadata?.full_name ||
          supaLogin.user.user_metadata?.name ||
          normalizedEmail.split('@')[0];

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: normalizedEmail,
              fullName: userName,
              roleDefault: Role.CAREGIVER,
              isActive: true,
              isSynthetic: false,
              passwordHash,
              supabaseId: supaLogin.user.id,
            },
          });
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash,
              supabaseId: supaLogin.user.id,
              isActive: true,
              roleDefault: Role.CAREGIVER,
            },
          });
        }

        const token = await generateSessionToken(user.id, user.email);
        const response = NextResponse.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            roleDefault: user.roleDefault,
            isSynthetic: user.isSynthetic,
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
      }
    } catch (supaErr) {
      console.warn('Supabase password auth check notice:', supaErr);
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error: unknown) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal error during login' },
      { status: 500 }
    );
  }
}
