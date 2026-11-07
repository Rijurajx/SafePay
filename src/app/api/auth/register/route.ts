import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, role = 'CAREGIVER' } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRole = role === 'PROTECTED_USER' ? Role.PROTECTED_USER : Role.CAREGIVER;

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: fullName.trim(),
        passwordHash,
        roleDefault: assignedRole,
        isSynthetic: false,
        isActive: true,
      },
    });

    // If registered as senior, initialize safe protection settings & spending baseline
    if (assignedRole === Role.PROTECTED_USER) {
      await prisma.protectionSettings.create({
        data: {
          elderId: user.id,
          absoluteTransactionCap: new Decimal(500.0),
          absoluteDailyCap: new Decimal(1000.0),
          familyApprovalThreshold: new Decimal(100.0),
          requireFamilyForNewRecipient: true,
          requireFamilyForUnusual: true,
          approvalTimeoutMinutes: 30,
        },
      });

      await prisma.spendingBaseline.create({
        data: {
          elderId: user.id,
          version: 1,
          sampleSize: 15,
          medianTransaction: new Decimal(30.0),
          madTransaction: new Decimal(8.0),
          usualStartHour: 8,
          usualEndHour: 22,
          monthlyAverage: new Decimal(400.0),
          recipientStatistics: { familiarMerchants: [] },
        },
      });
    }

    // Generate authenticated session token
    const token = await generateSessionToken(user.id, user.email);

    // Set cookie
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
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleDefault: user.roleDefault,
        isSynthetic: user.isSynthetic,
      },
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal error registering account' },
      { status: 500 }
    );
  }
}

