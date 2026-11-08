import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { redirectOrigin } = await req.json().catch(() => ({}));
    const origin = redirectOrigin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'your-project';

    const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
      `${origin}/auth/callback`
    )}`;

    // Probe the Supabase authorize endpoint
    try {
      const probeRes = await fetch(authorizeUrl, {
        method: 'GET',
        redirect: 'manual',
      });

      // If Supabase returns 400, provider is not enabled
      if (probeRes.status === 400) {
        const bodyText = await probeRes.text();
        if (bodyText.includes('provider is not enabled') || bodyText.includes('Unsupported provider')) {
          return NextResponse.json({
            providerEnabled: false,
            projectRef,
            supabaseDashboardUrl: `https://supabase.com/dashboard/project/${projectRef}/auth/providers`,
            callbackUrl: `${supabaseUrl}/auth/v1/callback`,
            message: 'Google Sign-In is not enabled yet in your Supabase Auth dashboard.',
          });
        }
      }

      // If status is 302 / 303 / 307 or successful redirect
      return NextResponse.json({
        providerEnabled: true,
        authUrl: authorizeUrl,
      });
    } catch {
      // If server-side probe cannot reach the endpoint, fallback to standard authorizeUrl
      return NextResponse.json({
        providerEnabled: true,
        authUrl: authorizeUrl,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error checking OAuth provider';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
