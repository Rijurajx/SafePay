import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const elderId = searchParams.get('elderId');

  if (!elderId) {
    return NextResponse.json({ error: 'Missing required parameter: elderId' }, { status: 400 });
  }

  // Enforce role-independent data isolation
  const authCheck = await authorizeElderDataScope(user, elderId);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { error: 'Forbidden: You do not have permission to access this elder profile', reason: authCheck.reason },
      { status: 403 }
    );
  }

  const links = await prisma.familyLink.findMany({
    where: { elderId, status: 'ACTIVE' },
    include: {
      caregiver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          roleDefault: true,
        },
      },
      permission: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    elderId,
    caregivers: links.map((l) => ({
      familyLinkId: l.id,
      caregiverId: l.caregiverId,
      name: l.caregiver.fullName,
      email: l.caregiver.email,
      relationship: l.relationship,
      status: l.status,
      permissions: {
        canViewTransactions: l.permission?.canViewTransactions ?? false,
        canApprovePayments: l.permission?.canApprovePayments ?? false,
        canManageSettings: l.permission?.canManageSettings ?? false,
      },
    })),
  });
}
