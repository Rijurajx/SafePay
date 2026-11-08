'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Heart,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

interface InvitationDetails {
  caregiverId: string;
  caregiverName: string;
  elderFullName: string;
  elderEmailOrPhone: string;
  relationship: string;
  approvalThreshold: number;
  dailyCap: number;
  expiresAt: string;
}

function InvitationAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Elder password setup
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token. Please check your invitation link.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch('/api/family/invitations/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Invalid or expired invitation link');
        } else {
          setInvitation(data.invitation);
        }
      } catch {
        setError('Network error verifying invitation. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;

    if (password.length < 6) {
      setError('Please choose a password with at least 6 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/family/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
      } else {
        // Redirect senior directly to their simplified companion experience
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network error accepting invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!confirm('Are you sure you want to decline this family protection invitation?')) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/family/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setDeclined(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to decline invitation');
      }
    } catch {
      setError('Network error declining invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-800">
        <div className="liquid-glass rounded-3xl p-8 flex flex-col items-center gap-4 shadow-xl border border-white/80">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-slate-700">Verifying your family invitation...</p>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Invitation Declined</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            You have declined the family protection invitation. No monitoring has been enabled on your account.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-6 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-950">Invitation Invalid or Expired</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || 'This invitation link could not be verified. Please ask your family member to send a new invitation.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-6 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Return to SafePay
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen soft-mesh-bg text-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative">
      {/* Brand Header */}
      <Link href="/" className="mb-6 flex items-center gap-2 group">
        <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="font-bold tracking-tight text-lg text-slate-900">SafePay</span>
      </Link>

      <div className="w-full max-w-lg liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)] space-y-6">
        {/* Warm Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold mb-1">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>Family Protection Invitation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
            Welcome, {invitation.elderFullName}
          </h1>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong className="text-slate-950">{invitation.caregiverName}</strong> ({invitation.relationship}) has
            invited you to connect through SafePay so you can pay online safely without worry.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        {/* Clear Dignity & Transparency Matrix */}
        <div className="space-y-3 pt-2">
          <div className="p-4 rounded-2xl bg-white/90 border border-emerald-100 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>What {invitation.caregiverName} will help you with:</span>
            </div>
            <ul className="text-xs text-slate-700 space-y-1.5 pl-6 list-disc">
              <li>
                Unusual payments over <strong>${invitation.approvalThreshold.toFixed(0)}</strong> are held safely until {invitation.caregiverName} confirms.
              </li>
              <li>
                Soft alerts if an unfamiliar seller or ad looks high-priced or suspicious.
              </li>
              <li>
                You can buy online independently with complete peace of mind.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 border border-black/5 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-purple-600" />
              <span>What stays private and protected:</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pl-6 list-disc">
              <li>Everyday groceries, pharmacy, and small purchases process quietly with no alerts.</li>
              <li>{invitation.caregiverName} cannot see your bank passwords or personal logins.</li>
              <li>No money ever moves without you deciding to buy something first.</li>
            </ul>
          </div>
        </div>

        {/* Password Setup Form */}
        <form onSubmit={handleAccept} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Choose a Password or PIN for Your Account:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-purple-600 outline-none transition-all shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              You will use this password to sign in to your SafePay companion app.
            </p>
          </div>

          {/* Big Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={submitting || password.length < 6}
              className="w-full py-3.5 rounded-full bg-slate-950 text-white font-bold text-sm hover:bg-slate-800 disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/15"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Accept Protection & Join Family Circle</span>
                  <ArrowRight className="w-4 h-4 text-purple-300" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDecline}
              disabled={submitting}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
            >
              Decline Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvitationAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-800">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      }
    >
      <InvitationAcceptContent />
    </Suspense>
  );
}

