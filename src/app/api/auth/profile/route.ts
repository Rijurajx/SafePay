import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const {
      fullName,
      phoneNumber,
      preferredNotification,
      city,
      primaryZipCode,
      emergencyContactName,
      emergencyContactPhone,
      dateOfBirth,
    } = body;

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || !fullName.trim()) {
        return NextResponse.json({ error: 'Valid full name or username is required' }, { status: 400 });
      }
      dataToUpdate.fullName = fullName.trim();
    }

    if (phoneNumber !== undefined) {
      dataToUpdate.phoneNumber = phoneNumber ? String(phoneNumber).trim() : null;
    }

    if (preferredNotification !== undefined) {
      dataToUpdate.preferredNotification = ['SMS', 'EMAIL', 'BOTH'].includes(preferredNotification)
        ? preferredNotification
        : 'BOTH';
    }

    if (city !== undefined) {
      dataToUpdate.city = city ? String(city).trim() : null;
    }

    if (primaryZipCode !== undefined) {
      dataToUpdate.primaryZipCode = primaryZipCode ? String(primaryZipCode).trim() : null;
    }

    if (emergencyContactName !== undefined) {
      dataToUpdate.emergencyContactName = emergencyContactName ? String(emergencyContactName).trim() : null;
    }

    if (emergencyContactPhone !== undefined) {
      dataToUpdate.emergencyContactPhone = emergencyContactPhone ? String(emergencyContactPhone).trim() : null;
    }

    if (dateOfBirth !== undefined) {
      dataToUpdate.dateOfBirth = dateOfBirth ? String(dateOfBirth).trim() : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        city: true,
        primaryZipCode: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        preferredNotification: true,
        roleDefault: true,
        isSynthetic: true,
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
            updatedFields: Object.keys(dataToUpdate),
            timestamp: new Date().toISOString(),
          } as Prisma.InputJsonValue,
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
