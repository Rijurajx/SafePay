import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
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
