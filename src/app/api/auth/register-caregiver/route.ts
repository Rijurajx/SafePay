import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateVerificationCode, createVerificationTicket } from '@/lib/auth-tokens';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, password, confirmPassword } = body;

    // 1. Validate required fields
    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'All fields are required (Full Name, Email, Password, and Confirm Password)' },
        { status: 400 }
      );
    }

    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 3. Confirm password equality
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match. Please re-enter.' }, { status: 400 });
    }

    // 4. Financial-grade password complexity check (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long for financial security' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
        { status: 400 }
      );
    }

    // 5. Verify email uniqueness in database
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please sign in instead.' },
          { status: 409 }
        );
      }
    } catch (dbErr) {
      console.warn('DB check error during pre-registration:', dbErr);
    }

    // Clean up any stale uncompleted Supabase Auth user if not present in PostgreSQL
    try {
      const adminSb = createAdminClient();
      const { data: listData } = await adminSb.auth.admin.listUsers();
      const staleUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (staleUser && staleUser.user_metadata?.role !== 'PROTECTED_USER') {
        await adminSb.auth.admin.deleteUser(staleUser.id);
      }
    } catch (cleanErr) {
      console.warn('Notice cleaning stale Supabase registration user:', cleanErr);
    }

    // 6. Generate cryptographic 6-digit OTP & hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = generateVerificationCode();

    // 7. Create tamper-evident verification ticket (stateless & cryptographically signed)
    const verificationTicket = createVerificationTicket(
      normalizedEmail,
      trimmedName,
      passwordHash,
      otpCode
    );

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${normalizedEmail}`,
      email: normalizedEmail,
      fullName: trimmedName,
      verificationTicket,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error initiating registration';
    console.error('Registration init error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

