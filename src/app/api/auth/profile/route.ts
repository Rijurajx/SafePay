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
      paypalEmail,
      paypalAccountId,
      disconnectPaypal,
    } = body;

    const dataToUpdate: Prisma.UserUpdateInput & {
      phoneNumber?: string | null;
      preferredNotification?: string | null;
      city?: string | null;
      primaryZipCode?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      dateOfBirth?: string | null;
      paypalEmail?: string | null;
      paypalAccountId?: string | null;
      paypalConnectedAt?: Date | null;
    } = {};

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

    if (disconnectPaypal) {
      dataToUpdate.paypalEmail = null;
      dataToUpdate.paypalAccountId = null;
      dataToUpdate.paypalConnectedAt = null;
    } else if (paypalEmail !== undefined) {
      if (paypalEmail && String(paypalEmail).trim()) {
        dataToUpdate.paypalEmail = String(paypalEmail).trim();
        dataToUpdate.paypalAccountId = paypalAccountId
          ? String(paypalAccountId).trim()
          : `PP-WAL-${Math.floor(100000 + Math.random() * 900000)}`;
        dataToUpdate.paypalConnectedAt = new Date();
      } else {
        dataToUpdate.paypalEmail = null;
        dataToUpdate.paypalAccountId = null;
        dataToUpdate.paypalConnectedAt = null;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: dataToUpdate as Prisma.UserUpdateInput,
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
        paypalEmail: true,
        paypalAccountId: true,
        paypalConnectedAt: true,
        roleDefault: true,
        isSynthetic: true,
        isActive: true,
      },
    });

    // If caregiver connected/updated PayPal, also sync to their linked active elders for purchases
    if (paypalEmail !== undefined || disconnectPaypal) {
      try {
        const elderLinks = await prisma.familyLink.findMany({
          where: { caregiverId: session.id, status: 'ACTIVE' },
          select: { elderId: true },
        });

        for (const link of elderLinks) {
          await prisma.user.update({
            where: { id: link.elderId },
            data: {
              paypalEmail: disconnectPaypal ? null : dataToUpdate.paypalEmail,
              paypalAccountId: disconnectPaypal ? null : dataToUpdate.paypalAccountId,
              paypalConnectedAt: disconnectPaypal ? null : dataToUpdate.paypalConnectedAt,
            },
          });
        }
      } catch (err) {
        console.warn('Failed to sync PayPal account to elder users:', err);
      }
    }

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
