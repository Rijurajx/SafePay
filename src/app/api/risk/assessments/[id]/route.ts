import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, authorizeElderDataScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const assessment = await prisma.riskAssessment.findUnique({
      where: { id },
      include: {
        paymentRequest: {
          include: {
            recipient: true,
            elder: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Authorize access to elder scope
    const authResult = await authorizeElderDataScope(session, assessment.paymentRequest.elderId);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason || 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

