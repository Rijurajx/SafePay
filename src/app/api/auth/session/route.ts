import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Auto-heal check: if user was created or linked as an elder and has 0 elders as caregiver:
  if (user.roleDefault === 'CAREGIVER') {
    const isLinkedAsElder = await prisma.familyLink.findFirst({
      where: { elderId: user.id },
    });
    const hasCaregiverLinks = await prisma.familyLink.findFirst({
      where: { caregiverId: user.id },
    });

    if (isLinkedAsElder && !hasCaregiverLinks) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleDefault: Role.PROTECTED_USER },
      });
      user.roleDefault = Role.PROTECTED_USER;
      try {
        const adminSb = createAdminClient();
        await adminSb.auth.admin.updateUserById(user.id, {
          user_metadata: { role: 'PROTECTED_USER', is_elder: true },
        });
      } catch {}
    }
  }

  // Fetch active family links
  const elderLinks = await prisma.familyLink.findMany({
    where: { elderId: user.id, status: 'ACTIVE' },
    include: { caregiver: { select: { id: true, fullName: true, email: true } }, permission: true },
  });

  const caregiverLinks = await prisma.familyLink.findMany({
    where: { caregiverId: user.id, status: 'ACTIVE' },
    include: { elder: { select: { id: true, fullName: true, email: true } }, permission: true },
  });

  return NextResponse.json({
    authenticated: true,
    user,
    elderLinks,
    caregiverLinks,
  });
}
