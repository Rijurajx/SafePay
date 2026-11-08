import { NextRequest, NextResponse } from 'next/server';
import { generateVerificationCode, createVerificationTicket, verifyToken, PendingCaregiverRegistration } from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { verificationTicket } = body;

    if (!verificationTicket) {
      return NextResponse.json({ error: 'Verification ticket is required' }, { status: 400 });
    }

    const payload = verifyToken<PendingCaregiverRegistration>(verificationTicket);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired ticket' }, { status: 400 });
    }

    const newCode = generateVerificationCode();
    const newTicket = createVerificationTicket(
      payload.email,
      payload.fullName,
      payload.passwordHash,
      newCode
    );

    return NextResponse.json({
      success: true,
      message: `A fresh 6-digit verification code has been dispatched to ${payload.email}`,
      verificationTicket: newTicket,
      demoCode: newCode,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error resending verification code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

