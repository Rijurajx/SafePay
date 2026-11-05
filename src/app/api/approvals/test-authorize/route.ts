import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, authorizeCaregiverForElder } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const testAuthorizeSchema = z.object({
  elderId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = testAuthorizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid elderId UUID' }, { status: 400 });
    }

    // Role-independent authorization check
    const authResult = await authorizeCaregiverForElder(user.id, parsed.data.elderId, 'approve');

    if (!authResult.authorized) {
      return NextResponse.json(
        {
          authorized: false,
          error: 'Forbidden: Approval authority denied',
          reason: authResult.reason,
          caregiver: {
            id: user.id,
            name: user.fullName,
            email: user.email,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      authorized: true,
      message: `Caregiver ${user.fullName} is authorized to approve payments for elder ${parsed.data.elderId}`,
      context: authResult.context,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authorization check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
