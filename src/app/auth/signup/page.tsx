'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Lock, Mail, User } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CAREGIVER' | 'PROTECTED_USER'>('CAREGIVER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Network error registering account. Please try again.');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Create your account</h1>
          <p className="text-xs text-slate-600">
            Set up role-based protection for everyday PayPal purchases.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          {/* Role Choice Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">I am registering as:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('CAREGIVER')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  role === 'CAREGIVER'
                    ? 'bg-white shadow-sm border-purple-500/30 ring-2 ring-purple-500/15'
                    : 'bg-white/50 border-black/5 hover:bg-white/80'
                }`}
              >
                <div className="text-base mb-1">🛡️</div>
                <div className="font-bold text-xs text-slate-900">Caregiver</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Protect & review an elderly family member
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('PROTECTED_USER')}
                className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  role === 'PROTECTED_USER'
                    ? 'bg-white shadow-sm border-purple-500/30 ring-2 ring-purple-500/15'
                    : 'bg-white/50 border-black/5 hover:bg-white/80'
                }`}
              >
                <div className="text-base mb-1">👤</div>
                <div className="font-bold text-xs text-slate-900">Senior User</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Shop online with family safety guardrails
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={role === 'CAREGIVER' ? 'Maya Sterling' : 'Thomas Sterling'}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/90 border border-black/10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Create password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
                <span>Get started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-600 pt-2 border-t border-black/5">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-semibold text-slate-950 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
