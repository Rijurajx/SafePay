import { NextResponse } from 'next/server';
import { clearSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await clearSession();
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
