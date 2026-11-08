'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  User,
  Mail,
  UserPlus,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caregiver Profile State
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [fullName, setFullName] = useState('');

  // Elder Profile State
  const [elderFullName, setElderFullName] = useState('');
  const [elderEmailOrPhone, setElderEmailOrPhone] = useState('');
  const [relationship, setRelationship] = useState('Parent');

  // Protection Limits State
  const [familyApprovalThreshold, setFamilyApprovalThreshold] = useState('100');
  const [absoluteDailyCap, setAbsoluteDailyCap] = useState('500');
  const [monthlyBudget, setMonthlyBudget] = useState('2000');
  const [requireNewMerchant, setRequireNewMerchant] = useState(true);
  const [requireUnusual, setRequireUnusual] = useState(true);

  // Success state with generated invite
  const [createdInvite, setCreatedInvite] = useState<{
    elderName: string;
    inviteLink: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load current authenticated user session
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
          window.location.href = '/auth/signin';
          return;
        }
        const data = await res.json();
        if (data.user) {
          setCaregiverEmail(data.user.email || '');
          // Prefill with Google OAuth name or existing name
          setFullName(data.user.fullName || data.user.email?.split('@')[0] || '');
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please provide your caregiver username or display name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          elderFullName: elderFullName.trim() || undefined,
          elderEmailOrPhone: elderEmailOrPhone.trim() || undefined,
          relationship,
          familyApprovalThreshold: Number(familyApprovalThreshold) || 100,
          absoluteDailyCap: Number(absoluteDailyCap) || 500,
          absoluteTransactionCap: (Number(familyApprovalThreshold) || 100) * 5,
          requireFamilyForNewRecipient: requireNewMerchant,
          requireFamilyForUnusual: requireUnusual,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save setup');
        setSubmitting(false);
        return;
      }

      if (data.inviteLink) {
        setCreatedInvite({
          elderName: elderFullName.trim(),
          inviteLink: data.inviteLink,
        });
      } else {
        // Direct to dashboard immediately
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network error saving onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (!createdInvite?.inviteLink) return;
    navigator.clipboard.writeText(createdInvite.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-700 font-medium text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
          <span>Setting up your personalized profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen soft-mesh-bg text-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative">
      {/* Brand Header */}
      <Link href="/" className="mb-6 flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="font-bold tracking-tight text-lg text-slate-950">SafePay</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-800 border border-purple-500/20">
          Caregiver Onboarding
        </span>
      </Link>

      {/* Main Glass Form Container */}
      <div className="w-full max-w-xl liquid-glass rounded-3xl p-7 sm:p-9 border border-white/80 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.14)] space-y-7">
        {!createdInvite ? (
          <>
            {/* Header copy */}
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/70 text-purple-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>One-Time Initial Setup</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Customize Profile &amp; Financial Safeguards
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Confirm your display name and set financial protection limits for your senior family member. You can change any of these settings anytime from your dashboard.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* =========================================================================
                  SECTION 1: CAREGIVER IDENTITY
                  ========================================================================= */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-white/70 border border-black/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      1. Caregiver Identity
                    </h2>
                  </div>
                  <span className="text-[11px] text-purple-700 font-medium bg-purple-100/70 px-2 py-0.5 rounded-md">
                    Pre-filled from OAuth
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Username / Display Name:
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rijuraj Datta or Alex"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      This name will appear on transaction authorizations and senior notifications.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Email:
                    </label>
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100/80 border border-slate-200/60 text-slate-600 text-xs font-mono">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{caregiverEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================================
                  SECTION 2: SENIOR FAMILY MEMBER DETAILS
                  ========================================================================= */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-white/70 border border-black/5">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    2. Add Senior Loved One
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senior&apos;s Full Name:
                    </label>
                    <input
                      type="text"
                      value={elderFullName}
                      onChange={(e) => setElderFullName(e.target.value)}
                      placeholder="e.g. Eleanor Vance or Dad"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Relationship:
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                    >
                      <option value="Parent">Parent (Father / Mother)</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Spouse">Spouse / Partner</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other Family Member">Other Family Member</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senior&apos;s Email or Phone Number:
                  </label>
                  <input
                    type="text"
                    value={elderEmailOrPhone}
                    onChange={(e) => setElderEmailOrPhone(e.target.value)}
                    placeholder="e.g. senior@gmail.com or +1 (555) 234-5678"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    An invitation link will be generated for the senior to accept monitoring.
                  </p>
                </div>
              </div>

              {/* =========================================================================
                  SECTION 3: FINANCIAL SAFETY LIMITS & GUARDRAILS
                  ========================================================================= */}
              <div className="space-y-3.5 p-4 rounded-2xl bg-white/70 border border-black/5">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    3. Safety Limits &amp; Financial Guardrails
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Auto-Approval Limit:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="10"
                        step="5"
                        value={familyApprovalThreshold}
                        onChange={(e) => setFamilyApprovalThreshold(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Charges above this hold for approval.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Daily Spend Cap:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="50"
                        step="25"
                        value={absoluteDailyCap}
                        onChange={(e) => setAbsoluteDailyCap(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Maximum allowed spend per day.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly Budget:
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="100"
                        step="50"
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Target monthly spending ceiling.
                    </p>
                  </div>
                </div>

                {/* Additional Guardrails */}
                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireNewMerchant}
                      onChange={(e) => setRequireNewMerchant(e.target.checked)}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-800">
                        Require approval for unfamiliar or first-time merchants
                      </span>
                      <p className="text-slate-500 text-[10px]">
                        Holds transactions if the senior has never shopped with the merchant before.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireUnusual}
                      onChange={(e) => setRequireUnusual(e.target.checked)}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-800">
                        AI Scam &amp; Off-Hours Anomaly Detection
                      </span>
                      <p className="text-slate-500 text-[10px]">
                        Automatically pauses transactions detected during unusual late-night hours or with high fraud scores.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-950/15"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Save Profile &amp; Launch Caregiver Shield</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <Link
                    href="/dashboard"
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
                  >
                    Skip setup for now &amp; go to Dashboard &rarr;
                  </Link>
                </div>
              </div>
            </form>
          </>
        ) : (
          /* =========================================================================
             SUCCESS / INVITATION SCREEN
             ========================================================================= */
          <div className="space-y-6 text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Setup Complete &amp; Protected!
              </h1>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Your caregiver profile and custom spending limits for{' '}
                <strong className="text-slate-900">{createdInvite.elderName}</strong> have been configured.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-purple-200/80 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Senior Invitation Link:
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                  Single-Use Secure Token
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Send this link to {createdInvite.elderName}. Once they accept, your oversight shield will immediately be active:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdInvite.inviteLink}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-800 outline-none select-all"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 flex items-center gap-1 transition-all active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="w-full py-3 px-6 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 inline-flex items-center justify-center gap-2 shadow-lg shadow-slate-950/15 active:scale-95 transition-all"
              >
                <span>Enter Caregiver Dashboard</span>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
