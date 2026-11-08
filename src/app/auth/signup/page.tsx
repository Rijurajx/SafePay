'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();

  // Step 1: Caregiver Details State
  const [step, setStep] = useState<'DETAILS' | 'VERIFY'>('DETAILS');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Verification State
  const [verificationTicket, setVerificationTicket] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Status & Validation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid =
    fullName.trim().length > 0 &&
    email.includes('@') &&
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    passwordsMatch;

  // Countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1: Submit Details & Request OTP Code
  const handleInitiateSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/auth/register-caregiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
      } else {
        setVerificationTicket(data.verificationTicket);
        setDemoCode(data.demoCode || null);
        setStep('VERIFY');
        setResendCooldown(30);
        setSuccessNotice(`Confirmation code sent to ${data.email}`);
      }
    } catch {
      setError('Network error initiating registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle segmented OTP digit typing
  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    // Support copy-paste of all 6 digits into any field
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 6).split('');
      const updated = [...otpDigits];
      pasteDigits.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setOtpDigits(updated);
      digitRefs.current[Math.min(pasteDigits.length, 5)]?.focus();
      return;
    }

    const updated = [...otpDigits];
    updated[index] = cleaned[0];
    setOtpDigits(updated);

    // Auto-advance to next digit
    if (index < 5 && cleaned[0]) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Confirm 6-Digit Code
  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6 || !verificationTicket) {
      setError('Please enter all 6 digits of the confirmation code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationTicket,
          code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        if (data.nextTicket) {
          setVerificationTicket(data.nextTicket);
        }
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Network error verifying code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill for sandbox demo
  const handleUseDemoCode = () => {
    if (demoCode && demoCode.length === 6) {
      setOtpDigits(demoCode.split(''));
    }
  };

  // Resend code
  const handleResend = async () => {
    if (resendCooldown > 0 || !verificationTicket) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationTicket }),
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationTicket(data.verificationTicket);
        setDemoCode(data.demoCode || null);
        setResendCooldown(30);
        setSuccessNotice('A new code has been sent.');
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('Network error resending code');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth registration via Supabase Auth
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('not enabled') ||
          error.message?.toLowerCase().includes('unsupported')
        ) {
          setError(
            'Google Sign-In is not enabled yet in your Supabase Auth dashboard. Please enable the Google provider in Supabase (Authentication > Providers > Google) or register using the 6-digit confirmation code below.'
          );
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

  return (
    <div className="min-h-screen soft-mesh-bg text-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 py-12 relative">
      {/* Brand Header */}
      <Link href="/" className="mb-8 flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="font-bold tracking-tight text-lg text-slate-900">SafePay</span>
        <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
          Caregiver Portal
        </span>
      </Link>

      {/* Main Glass Card */}
      <div className="w-full max-w-md liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)] space-y-6">
        {step === 'DETAILS' ? (
          /* =========================================================================
             STEP 1: CAREGIVER ACCOUNT DETAILS
             ========================================================================= */
          <>
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Family Caregiver Registration</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Create Caregiver Account</h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Set up protection for your elderly loved ones. Seniors are connected via invite after registration.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
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

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/60" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-slate-400 font-bold bg-transparent">
                  <span className="bg-[#f8f9fc] px-2">Or register with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleInitiateSignUp} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Maya Sterling-Lin"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email */}
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Create Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Strength Checklist */}
              {password.length > 0 && (
                <div className="p-3 bg-white/60 rounded-xl border border-black/5 space-y-1.5 text-[11px]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Security Requirements:
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-slate-600">
                    <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-semibold' : ''}`}>
                      <CheckCircle2 className={`w-3 h-3 ${hasMinLength ? 'text-emerald-500' : 'text-slate-300'}`} />
                      8+ characters
                    </span>
                    <span className={`flex items-center gap-1 ${hasUppercase ? 'text-emerald-700 font-semibold' : ''}`}>
                      <CheckCircle2 className={`w-3 h-3 ${hasUppercase ? 'text-emerald-500' : 'text-slate-300'}`} />
                      1 uppercase
                    </span>
                    <span className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-semibold' : ''}`}>
                      <CheckCircle2 className={`w-3 h-3 ${hasNumber ? 'text-emerald-500' : 'text-slate-300'}`} />
                      1 number
                    </span>
                    <span className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-700 font-semibold' : ''}`}>
                      <CheckCircle2 className={`w-3 h-3 ${passwordsMatch ? 'text-emerald-500' : 'text-slate-300'}`} />
                      Passwords match
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full py-3 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/10"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                ) : (
                  <>
                    <span>Proceed to Email Verification</span>
                    <ArrowRight className="w-4 h-4 text-purple-400" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          /* =========================================================================
             STEP 2: CONFIRM EMAIL VIA 6-DIGIT VERIFICATION CODE
             ========================================================================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            <button
              onClick={() => setStep('DETAILS')}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change email or details</span>
            </button>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Confirm Your Email</h1>
              <p className="text-xs text-slate-600">
                We sent a 6-digit confirmation code to:
              </p>
              <div className="font-bold text-xs text-slate-950 bg-white/70 py-1 px-3 rounded-full inline-block border border-black/5">
                {email}
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Demo Helper Banner for Testing */}
            {demoCode && (
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Sandbox Demo Code:
                  </span>
                  <button
                    onClick={handleUseDemoCode}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 hover:bg-amber-300 transition-colors"
                  >
                    Auto-Fill
                  </button>
                </div>
                <div className="font-mono font-extrabold text-base tracking-widest text-slate-900">
                  {demoCode}
                </div>
              </div>
            )}

            {/* 6 Segmented Digit Inputs */}
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div>
                <label className="block text-center text-xs font-semibold text-slate-700 mb-3">
                  Enter the 6-digit confirmation code:
                </label>
                <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        digitRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono rounded-xl bg-white border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full py-3 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/10"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Verify Code & Activate Account</span>
                  </>
                )}
              </button>

              {/* Resend Code Options */}
              <div className="text-center space-y-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="text-xs text-purple-700 hover:text-purple-900 font-semibold disabled:text-slate-400 transition-colors"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Did not receive code? Resend'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Toggle to Sign In */}
        <div className="text-center pt-2 border-t border-black/5">
          <p className="text-xs text-slate-500">
            Already have a Caregiver account?{' '}
            <Link href="/auth/signin" className="font-bold text-slate-900 hover:underline">
              Sign In &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
