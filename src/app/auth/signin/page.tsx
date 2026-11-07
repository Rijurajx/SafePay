'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Lock, Mail, Sparkles } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        router.push('/dashboard');
      }
    } catch {
      setError('Network error signing in. Please check your connection.');
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
        router.push('/dashboard');
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
