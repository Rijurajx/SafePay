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
  RefreshCw,
  Phone,
  Bell,
  MapPin,
  Heart,
  ChevronDown,
} from 'lucide-react';

interface CountryCodeOption {
  code: string;
  flag: string;
  country: string;
  placeholder: string;
}

const COUNTRY_CODES: CountryCodeOption[] = [
  { code: '+1', flag: '🇺🇸', country: 'United States / Canada', placeholder: '(555) 123-4567' },
  { code: '+91', flag: '🇮🇳', country: 'India', placeholder: '98765 43210' },
  { code: '+44', flag: '🇬🇧', country: 'United Kingdom', placeholder: '7911 123456' },
  { code: '+61', flag: '🇦🇺', country: 'Australia', placeholder: '412 345 678' },
  { code: '+49', flag: '🇩🇪', country: 'Germany', placeholder: '1512 3456789' },
  { code: '+33', flag: '🇫🇷', country: 'France', placeholder: '6 12 34 56 78' },
  { code: '+81', flag: '🇯🇵', country: 'Japan', placeholder: '90 1234 5678' },
  { code: '+65', flag: '🇸🇬', country: 'Singapore', placeholder: '9123 4567' },
  { code: '+971', flag: '🇦🇪', country: 'UAE', placeholder: '50 123 4567' },
];

function formatPhoneNumber(value: string, countryCode: string): string {
  const digits = value.replace(/\D/g, '');
  if (countryCode === '+1') {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  } else if (countryCode === '+91') {
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
  } else if (countryCode === '+44') {
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)}`;
  } else {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
}

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caregiver Profile State
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [caregiverCountry, setCaregiverCountry] = useState('+1');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [caregiverNotification, setCaregiverNotification] = useState<'BOTH' | 'SMS' | 'EMAIL'>('BOTH');

  // Elder Profile State
  const [elderFullName, setElderFullName] = useState('');
  const [elderEmailOrPhone, setElderEmailOrPhone] = useState('');
  const [elderCountry, setElderCountry] = useState('+1');
  const [elderPhone, setElderPhone] = useState('');
  const [elderCity, setElderCity] = useState('');
  const [elderZipCode, setElderZipCode] = useState('');
  const [relationship, setRelationship] = useState('Parent');

  // Emergency Backup Contact State
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyCountry, setEmergencyCountry] = useState('+1');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Protection Limits State
  const [familyApprovalThreshold, setFamilyApprovalThreshold] = useState('100');
  const [absoluteDailyCap, setAbsoluteDailyCap] = useState('500');
  const [monthlyBudget, setMonthlyBudget] = useState('2000');
  const [requireNewMerchant, setRequireNewMerchant] = useState(true);
  const [requireUnusual, setRequireUnusual] = useState(true);

  // Success state with generated invite
  const [createdInvite, setCreatedInvite] = useState<{
    elderName: string;
    elderEmail: string;
  } | null>(null);

  // Load current authenticated user session
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) {
          window.location.href = '/signin';
          return;
        }
        const data = await res.json();
        if (data.user) {
          setCaregiverEmail(data.user.email || '');
          setFullName(data.user.fullName || data.user.email?.split('@')[0] || '');
          if (data.user.phoneNumber) {
            const raw = String(data.user.phoneNumber).trim();
            const matched = COUNTRY_CODES.find((c) => raw.startsWith(c.code));
            if (matched) {
              setCaregiverCountry(matched.code);
              setCaregiverPhone(formatPhoneNumber(raw.slice(matched.code.length).trim(), matched.code));
            } else {
              setCaregiverPhone(raw);
            }
          }
          if (data.user.preferredNotification) {
            setCaregiverNotification(data.user.preferredNotification);
          }
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

    const fullCaregiverPhone = caregiverPhone.trim() ? `${caregiverCountry} ${caregiverPhone.trim()}` : undefined;
    const fullElderPhone = elderPhone.trim() ? `${elderCountry} ${elderPhone.trim()}` : undefined;
    const fullEmergencyPhone = emergencyContactPhone.trim()
      ? `${emergencyCountry} ${emergencyContactPhone.trim()}`
      : undefined;

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          caregiverPhone: fullCaregiverPhone,
          caregiverNotification,
          elderFullName: elderFullName.trim() || undefined,
          elderEmailOrPhone: elderEmailOrPhone.trim() || undefined,
          elderPhone: fullElderPhone,
          elderCity: elderCity.trim() || undefined,
          elderZipCode: elderZipCode.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: fullEmergencyPhone,
          relationship,
          familyApprovalThreshold: Number(familyApprovalThreshold) || 100,
          absoluteDailyCap: Number(absoluteDailyCap) || 500,
          absoluteTransactionCap: (Number(familyApprovalThreshold) || 100) * 5,
          monthlyBudget: Number(monthlyBudget) || 2000,
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

      if (data.elderName || data.elderEmail) {
        setCreatedInvite({
          elderName: data.elderName || elderFullName.trim(),
          elderEmail: data.elderEmail || elderEmailOrPhone.trim().toLowerCase(),
        });
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Network error saving onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden soft-mesh-bg text-slate-900 flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-3 lg:py-4 relative selection:bg-purple-100 selection:text-purple-900">
      {/* Brand & Page Header */}
      <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/5">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold tracking-tight text-base text-slate-950">SafePay</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-950 leading-tight">
              Customize Profile &amp; Financial Safeguards
            </h1>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">
              Confirm your identity, add your loved one, and set intelligent spending limits.
            </p>
          </div>
        </div>

        {error && (
          <div className="py-1 px-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-1.5 self-start sm:self-auto">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!createdInvite ? (
        <form
          onSubmit={handleSubmit}
          className="max-w-7xl w-full mx-auto flex-1 flex flex-col my-1.5 lg:my-2 min-h-0"
        >
          {/* Master Common Container wrapping all 3 columns + bottom centered action */}
          <div className="liquid-glass rounded-3xl p-3.5 sm:p-4 lg:p-5 border border-white/80 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08)] flex-1 flex flex-col justify-between min-h-0">
            {/* 3-Column Responsive Grid on Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 lg:gap-4 flex-1 min-h-0 items-stretch">
              {/* =========================================================================
                  COLUMN 1: CAREGIVER IDENTITY
                  ========================================================================= */}
              <div className="bg-white/75 backdrop-blur-xs rounded-2xl p-3.5 sm:p-4 border border-black/5 shadow-2xs flex flex-col justify-between space-y-2.5 min-h-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    <User className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      1. Caregiver Identity
                    </h2>
                    <p className="text-[10px] text-slate-500">Your profile &amp; approval notification channels</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Your Username / Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maya Sterling or Alex"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Displayed on purchase authorization receipts.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Registered Caregiver Email
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/90 border border-slate-200/60 text-slate-600 text-xs font-mono">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{caregiverEmail}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mobile Phone (Fast SMS Approvals)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <select
                        value={caregiverCountry}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setCaregiverCountry(newCode);
                          setCaregiverPhone(formatPhoneNumber(caregiverPhone, newCode));
                        }}
                        className="w-full appearance-none pl-2.5 pr-7 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none cursor-pointer"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.country + c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative flex-1">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={caregiverPhone}
                        onChange={(e) =>
                          setCaregiverPhone(formatPhoneNumber(e.target.value, caregiverCountry))
                        }
                        placeholder={
                          COUNTRY_CODES.find((c) => c.code === caregiverCountry)?.placeholder || 'Phone number'
                        }
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Receive 1-tap SMS links when transactions trigger family review.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Preferred Alerts Channel
                  </label>
                  <div className="relative">
                    <Bell className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={caregiverNotification}
                      onChange={(e) => setCaregiverNotification(e.target.value as 'BOTH' | 'SMS' | 'EMAIL')}
                      className="w-full appearance-none pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all cursor-pointer"
                    >
                      <option value="BOTH">Both SMS &amp; Email (Fastest &amp; Safest)</option>
                      <option value="SMS">SMS Text Alerts Only</option>
                      <option value="EMAIL">Email Notifications Only</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================================
                COLUMN 2: SENIOR LOVED ONE
                ========================================================================= */}
            <div className="bg-white/75 backdrop-blur-xs rounded-2xl p-3.5 sm:p-4 border border-black/5 shadow-2xs flex flex-col justify-between space-y-2.5 min-h-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      2. Add Senior Loved One
                    </h2>
                    <p className="text-[10px] text-slate-500">Contact details &amp; location baseline</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Senior&apos;s Full Name
                    </label>
                    <input
                      type="text"
                      value={elderFullName}
                      onChange={(e) => setElderFullName(e.target.value)}
                      placeholder="e.g. Thomas Sterling"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Relationship
                    </label>
                    <div className="relative">
                      <select
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value)}
                        className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none cursor-pointer"
                      >
                        <option value="Parent">Parent (Father / Mother)</option>
                        <option value="Grandparent">Grandparent</option>
                        <option value="Spouse">Spouse / Partner</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other Family Member">Other Family</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Senior&apos;s Email (Direct Invite Delivered Here)
                  </label>
                  <input
                    type="email"
                    value={elderEmailOrPhone}
                    onChange={(e) => setElderEmailOrPhone(e.target.value)}
                    placeholder="senior.thomas@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Invitation link goes directly to their private inbox for consent.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Senior&apos;s Mobile Phone (Optional)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <select
                        value={elderCountry}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setElderCountry(newCode);
                          setElderPhone(formatPhoneNumber(elderPhone, newCode));
                        }}
                        className="w-full appearance-none pl-2.5 pr-7 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none cursor-pointer"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.country + c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative flex-1">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={elderPhone}
                        onChange={(e) => setElderPhone(formatPhoneNumber(e.target.value, elderCountry))}
                        placeholder={
                          COUNTRY_CODES.find((c) => c.code === elderCountry)?.placeholder || 'Phone number'
                        }
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Home City
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={elderCity}
                        onChange={(e) => setElderCity(e.target.value)}
                        placeholder="e.g. Seattle"
                        className="w-full pl-7 pr-2.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Postal Code / Zip
                    </label>
                    <input
                      type="text"
                      value={elderZipCode}
                      onChange={(e) => setElderZipCode(e.target.value)}
                      placeholder="98101"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 outline-none"
                    />
                  </div>
                </div>

                {/* Emergency Backup Contact */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-slate-700">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Emergency Backup Contact (Optional)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Name (e.g. Aunt Sarah)"
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 outline-none"
                    />
                    <div className="flex gap-1.5">
                      <div className="relative w-22 shrink-0">
                        <select
                          value={emergencyCountry}
                          onChange={(e) => {
                            const newCode = e.target.value;
                            setEmergencyCountry(newCode);
                            setEmergencyContactPhone(formatPhoneNumber(emergencyContactPhone, newCode));
                          }}
                          className="w-full appearance-none pl-2 pr-6 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold focus:border-purple-600 outline-none cursor-pointer"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.country + c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <input
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) =>
                          setEmergencyContactPhone(formatPhoneNumber(e.target.value, emergencyCountry))
                        }
                        placeholder="Phone"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================================================================
                COLUMN 3: SAFETY LIMITS & FINANCIAL GUARDRAILS
                ========================================================================= */}
            <div className="bg-white/75 backdrop-blur-xs rounded-2xl p-3.5 sm:p-4 border border-black/5 shadow-2xs flex flex-col justify-between space-y-2.5 min-h-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-black/5 pb-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      3. Safety Limits &amp; Guardrails
                    </h2>
                    <p className="text-[10px] text-slate-500">Autonomous bounds &amp; proactive scam protection</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                      Auto-Approval
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="10"
                        step="5"
                        value={familyApprovalThreshold}
                        onChange={(e) => setFamilyApprovalThreshold(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Threshold</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                      Daily Spend Cap
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="50"
                        step="25"
                        value={absoluteDailyCap}
                        onChange={(e) => setAbsoluteDailyCap(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Max daily</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">
                      Monthly Budget
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min="100"
                        step="50"
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:border-purple-600 outline-none font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Ceiling</p>
                  </div>
                </div>

                {/* Additional Guardrails */}
                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={requireNewMerchant}
                      onChange={(e) => setRequireNewMerchant(e.target.checked)}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-900 block">
                        Hold First-Time / Unfamiliar Merchants
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Pauses charges with stores your senior has never visited before.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={requireUnusual}
                      onChange={(e) => setRequireUnusual(e.target.checked)}
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-900 block">
                        AI Duplicate &amp; Off-Hours Anomaly Detection
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Flags accidental duplicate charges or late-night transactions automatically.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Common Container Bottom Middle Action Bar */}
          <div className="pt-3 mt-2.5 border-t border-black/5 flex flex-col items-center justify-center gap-1.5 shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto min-w-[280px] py-2.5 px-8 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/15 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Save and Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <Link
              href="/dashboard"
              className="text-[11px] text-slate-500 hover:text-slate-900 font-medium transition-colors"
            >
              Skip setup for now &amp; go to Dashboard &rarr;
            </Link>
          </div>
        </div>
        </form>
      ) : (
        /* =========================================================================
           SUCCESS / INVITATION SCREEN
           ========================================================================= */
        <div className="max-w-md w-full mx-auto my-auto liquid-glass rounded-3xl p-8 border border-white shadow-2xl text-center space-y-6 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Setup Complete &amp; Protected!
            </h1>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Your caregiver profile and custom spending limits for{' '}
              <strong className="text-slate-900">{createdInvite.elderName}</strong> have been saved.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 border border-purple-200/80 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-900">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Invitation Dispatched Directly
              </span>
              <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                Sent to Senior&apos;s Inbox
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              SafePay has dispatched a secure single-use invitation link directly to{' '}
              <strong className="text-slate-900 font-mono">{createdInvite.elderEmail}</strong>.
            </p>
            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 text-[11px] text-purple-900 space-y-1">
              <span className="font-bold block">🔒 Privacy &amp; Senior Consent Protected</span>
              <p className="text-purple-800 text-[10px] leading-relaxed">
                For security and elder autonomy, the invite link is never displayed in the caregiver portal.
                {' '}{createdInvite.elderName} must open and confirm the invitation from their private email inbox.
              </p>
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

      {/* Footer copyright */}
      <footer className="text-center text-[10px] text-slate-400 py-1">
        SafePay Financial Guardian &bull; Powered by PayPal Sandbox &amp; Gemini AI
      </footer>
    </div>
  );
}
