import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoPersonaToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const demoSwitchSchema = z.object({
  persona: z.enum(['thomas', 'maya', 'david', 'sarah']),
});

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !env.ENABLE_DEMO_PERSONAS) {
    return NextResponse.json(
      { error: 'Demo persona switching is disabled in production environments' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = demoSwitchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid persona selected', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { user, token } = await createDemoPersonaToken(parsed.data.persona);

    const response = NextResponse.json({
      ok: true,
      user,
      message: `Authenticated as ${user.fullName} (${parsed.data.persona})`,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to switch demo persona';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
