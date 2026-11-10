import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, generateSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
    }

    if (targetUserId === session.id) {
      return NextResponse.json({ ok: true, user: session });
    }

    // STRICT SECURITY POLICY:
    // Protected senior members can NEVER switch into a caregiver's account or approve transactions.
    if (session.roleDefault === 'PROTECTED_USER') {
      return NextResponse.json(
        { error: 'Security Violation: Senior member accounts cannot access caregiver accounts or approve payments.' },
        { status: 403 }
      );
    }

    // Verify active family relationship: Caregiver can only access their linked elders
    const link = await prisma.familyLink.findFirst({
      where: {
        status: 'ACTIVE',
        caregiverId: session.id,
        elderId: targetUserId,
      },
    });

    if (!link) {
      return NextResponse.json(
        { error: 'You do not have an active family link with this senior member' },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleDefault: true,
        isSynthetic: true,
        isActive: true,
      },
    });

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json({ error: 'Target user account not found or inactive' }, { status: 404 });
    }

    // Issue session token for the target family user
    const token = await generateSessionToken(targetUser.id, targetUser.email);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
        roleDefault: targetUser.roleDefault,
        isSynthetic: targetUser.isSynthetic,
      },
      message: `Switched session to ${targetUser.fullName}`,
    });
  } catch (error: unknown) {
    console.error('Error switching family account:', error);
    return NextResponse.json({ error: 'Failed to switch family account' }, { status: 500 });
  }
}
