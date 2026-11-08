'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Lock, Mail, Sparkles, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<{ dashboardUrl: string; callbackUrl: string } | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network error signing in. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(decodeURIComponent(err));
    }
  }, [searchParams]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setOauthNotice(null);
    try {
      // 1. Check if Google provider is enabled on Supabase
      const checkRes = await fetch('/api/auth/google/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectOrigin: window.location.origin }),
      });
      const checkData = await checkRes.json();

      if (checkData.providerEnabled === false) {
        setOauthNotice({
          dashboardUrl: checkData.supabaseDashboardUrl,
          callbackUrl: checkData.callbackUrl,
        });
        setLoading(false);
        return;
      }

      // 2. Clear any stale client session & launch Supabase OAuth
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => {});

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('not enabled') ||
          error.message?.toLowerCase().includes('unsupported')
        ) {
          setOauthNotice({
            dashboardUrl: checkData.supabaseDashboardUrl || 'https://supabase.com/dashboard',
            callbackUrl: checkData.callbackUrl || `${window.location.origin}/auth/callback`,
          });
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error launching Google OAuth';
      setError(msg);
      setLoading(false);
    }
  };

  const handleDemoGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'caregiver.google@safepay-family.org',
          fullName: 'Maya Sterling (Google Verified)',
        }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to sign in with sandbox Google account');
      }
    } catch {
      setError('Network error signing in with sandbox Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersona = async (personaKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: personaKey }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to switch persona');
      }
    } catch {
      setError('Network error switching persona');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen soft-mesh-bg text-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative">
      {/* Brand Header */}
      <Link href="/" className="mb-8 flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="font-bold tracking-tight text-lg text-slate-900">SafePay</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
          Protected Money
        </span>
      </Link>

      {/* Main Glass Card */}
      <div className="w-full max-w-md liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)] space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Welcome back</h1>
          <p className="text-xs text-slate-600">
            Sign in to manage protected payments and family oversight.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium animate-in fade-in">
            {error}
          </div>
        )}

        {/* Google OAuth Quick Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2.5 shadow-2xs active:scale-[0.98] transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {oauthNotice && (
            <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-slate-950">Google OAuth Provider Not Enabled in Supabase</div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    To enable real Google login, toggle Google to <b>Enabled</b> in your{' '}
                    <a
                      href={oauthNotice.dashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-600 underline"
                    >
                      Supabase Dashboard
                    </a>{' '}
                    with your Google Cloud OAuth Client ID & Secret.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-200/60 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleDemoGoogleLogin}
                  disabled={loading}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Continue with Sandbox Google Account (1-Click)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOauthNotice(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 text-center py-0.5"
                >
                  Dismiss & use password
                </button>
              </div>
            </div>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-transparent">
              <span className="bg-[#f8f9fc] px-2">Or continue with email</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maya@example.com"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/90 border border-black/10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/90 border border-black/10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/10"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Testing Personas */}
        <div className="pt-4 border-t border-black/5 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>1-Click Hackathon Personas</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              onClick={() => handleQuickPersona('thomas')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-black/5 text-xs transition-all active:scale-[0.97]"
            >
              <div className="font-bold text-slate-900">Mr. Thomas</div>
              <div className="text-[10px] text-purple-700 font-medium">Protected Elder</div>
            </button>
            <button
              onClick={() => handleQuickPersona('maya')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-black/5 text-xs transition-all active:scale-[0.97]"
            >
              <div className="font-bold text-slate-900">Maya Sterling</div>
              <div className="text-[10px] text-blue-700 font-medium">Caregiver (Approver)</div>
            </button>
            <button
              onClick={() => handleQuickPersona('david')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-black/5 text-xs transition-all active:scale-[0.97]"
            >
              <div className="font-bold text-slate-900">David Sterling</div>
              <div className="text-[10px] text-indigo-700 font-medium">Caregiver (Approver)</div>
            </button>
            <button
              onClick={() => handleQuickPersona('sarah')}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/60 hover:bg-white border border-black/5 text-xs transition-all active:scale-[0.97]"
            >
              <div className="font-bold text-slate-900">Sarah Sterling</div>
              <div className="text-[10px] text-amber-700 font-medium">Caregiver (View-Only)</div>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-600 pt-2">
          New to SafePay?{' '}
          <Link href="/auth/signup" className="font-semibold text-slate-950 hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-800">
          <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
