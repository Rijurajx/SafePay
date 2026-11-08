import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { fullName } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return NextResponse.json({ error: 'Valid full name or username is required' }, { status: 400 });
    }

    const trimmedName = fullName.trim();

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: {
        fullName: trimmedName,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleDefault: true,
        isActive: true,
      },
    });

    // Audit event
    try {
      await prisma.auditEvent.create({
        data: {
          actorType: 'USER',
          actorId: session.id,
          eventType: 'USER_PROFILE_UPDATED',
          metadata: {
            oldName: session.fullName,
            newName: trimmedName,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.warn('Audit event failed on profile update:', e);
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error: unknown) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
