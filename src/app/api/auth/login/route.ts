import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { Decimal } from '@prisma/client/runtime/library';

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

    // Check if this account is actually a protected elder
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

    // 1. If user exists in DB and has local passwordHash
    if (user && user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (isValid) {
        // If inactive but valid credentials, activate user
        if (!user.isActive) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isActive: true },
          });
          user.isActive = true;
        }

        // Auto-heal: Ensure elder is never trapped with CAREGIVER role
        if (isLinkedAsElder && !hasCaregiverLinks && user.roleDefault !== Role.PROTECTED_USER) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { roleDefault: Role.PROTECTED_USER },
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

        // Strict role resolution: preserve PROTECTED_USER or detect elder linkage
        let determinedRole: Role = Role.CAREGIVER;
        if (user?.roleDefault === Role.PROTECTED_USER || (isLinkedAsElder && !hasCaregiverLinks)) {
          determinedRole = Role.PROTECTED_USER;
        } else if (
          supaLogin.user.user_metadata?.role === 'PROTECTED_USER' ||
          supaLogin.user.user_metadata?.is_elder
        ) {
          determinedRole = Role.PROTECTED_USER;
        } else if (user?.roleDefault) {
          determinedRole = user.roleDefault;
        }

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: normalizedEmail,
              fullName: userName,
              roleDefault: determinedRole,
              isActive: true,
              isSynthetic: false,
              passwordHash,
              supabaseId: supaLogin.user.id,
            },
          });

          if (determinedRole === Role.PROTECTED_USER) {
            await prisma.protectionSettings.upsert({
              where: { elderId: user.id },
              create: {
                elderId: user.id,
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
        } else {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash,
              supabaseId: supaLogin.user.id,
              isActive: true,
              roleDefault: determinedRole,
            },
          });
        }

        // Keep Supabase user metadata in sync with correct role
        try {
          const adminSb = createAdminClient();
          await adminSb.auth.admin.updateUserById(supaLogin.user.id, {
            user_metadata: {
              role: determinedRole,
              is_elder: determinedRole === Role.PROTECTED_USER,
            },
          });
        } catch (syncErr) {
          console.warn('Supabase metadata sync notice on login:', syncErr);
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
