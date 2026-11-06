'use client';

import React, { useEffect, useState } from 'react';
import { DemoPersonaBar } from '@/components/shared/DemoPersonaBar';
import { Navbar } from '@/components/shared/Navbar';
import { CaregiverAIChatDrawer } from '@/components/caregiver/CaregiverAIChatDrawer';
import { SessionUser } from '@/types';
import {
  Shield,
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
  Sparkles,
  HeartHandshake,
  Smartphone,
  ChevronRight,
  Check,
  Building2,
  Scale,
  RefreshCw,
} from 'lucide-react';

interface FamilyLinkData {
  id: string;
  relationship: string;
  status: string;
  elder?: { id: string; fullName: string; email: string };
  caregiver?: { id: string; fullName: string; email: string };
  permission?: {
    canViewTransactions: boolean;
    canApprovePayments: boolean;
    canManageSettings: boolean;
  };
}

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [caregiverLinks, setCaregiverLinks] = useState<FamilyLinkData[]>([]);
  const [elderLinks, setElderLinks] = useState<FamilyLinkData[]>([]);
  const [activeTab, setActiveTab] = useState<'elder' | 'caregiver'>('elder');
  const [selectedScenario, setSelectedScenario] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    authorized: boolean;
    status: number;
    message: string;
    reason?: string;
  } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Fetch session on mount
  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
        setCaregiverLinks(data.caregiverLinks || []);
        setElderLinks(data.elderLinks || []);
      } else {
        setUser(null);
        setCaregiverLinks([]);
        setElderLinks([]);
      }
    } catch {
      setUser(null);
    } finally {
      setTestResult(null);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const handleTestApprovalPermission = async () => {
    if (!user) return;
    setTestLoading(true);
    setTestResult(null);

    const targetElderId = '11111111-1111-4111-a111-111111111111'; // Mr. Thomas
    try {
      const res = await fetch('/api/approvals/test-authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elderId: targetElderId }),
      });
      const data = await res.json();
      setTestResult({
        tested: true,
        authorized: res.ok && data.authorized,
        status: res.status,
        message: data.message || data.error || 'Server responded',
        reason: data.reason,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setTestResult({
        tested: true,
        authorized: false,
        status: 500,
        message: `Network error: ${msg}`,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const switchPersona = async (personaKey: 'thomas' | 'maya' | 'david' | 'sarah') => {
    try {
      await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: personaKey }),
      });
      await refreshSession();
    } catch (e) {
      console.error(e);
    }
  };

  const isThomas = user?.email.includes('thomas');
  const isMaya = user?.email.includes('maya');
  const isDavid = user?.email.includes('david');
  const isSarah = user?.email.includes('sarah');

  // Realistic Scenarios for the Interactive Demo
  const scenarios = [
    {
      title: 'Routine Pharmacy Prescription',
      merchant: 'Walgreens Pharmacy #4102',
      amount: '$34.20',
      category: 'Medical & Healthcare',
      isAnomaly: false,
      outcome: 'Auto-Approved Immediately',
      outcomeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      aiSummary: 'Known recurring pharmacy visit. Amount matches 6-month historical baseline. Approved without family interruption.',
      elderStatus: 'Purchase Completed • Receipt saved',
      familyNotified: false,
    },
    {
      title: 'Unsolicited Tech Support Tool',
      merchant: 'Global PC Tech Care LLC',
      amount: '$489.00',
      category: 'Unverified Overseas Merchant',
      isAnomaly: true,
      outcome: 'Family Review Requested',
      outcomeColor: 'text-amber-800 bg-amber-50 border-amber-200',
      aiSummary: 'High-risk pattern: Merchant incorporated 12 days ago in foreign jurisdiction. Amount exceeds $100 new-merchant threshold.',
      elderStatus: 'Family is checking this purchase with you. No action needed.',
      familyNotified: true,
    },
    {
      title: 'Weekend Gardening Supplies',
      merchant: 'The Home Depot #0612',
      amount: '$162.45',
      category: 'Home & Garden',
      isAnomaly: true,
      outcome: 'Approved by Daughter (Maya)',
      outcomeColor: 'text-blue-800 bg-blue-50 border-blue-200',
      aiSummary: 'Trusted merchant, but order exceeds $100 single-item threshold. Push alert sent to Maya; authorized with 1 tap.',
      elderStatus: 'Maya approved this purchase • Payment confirmed',
      familyNotified: true,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hackathon Demo Persona Top Bar */}
      <DemoPersonaBar currentUser={user} onPersonaSwitched={() => refreshSession()} />

      {/* Main Navbar */}
      <Navbar user={user} onLogout={() => refreshSession()} />

      <main className="flex-1">
        {/* If user is logged into a persona, show their active role dashboard panel at the top */}
        {user && (
          <section className="bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-6 shadow-xs">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                        Active Session: {user.fullName}
                      </h1>
                      <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        {isThomas ? 'Protected Elder' : isSarah ? 'Caregiver (View-Only)' : 'Caregiver (Approver)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Session UUID: <code className="font-mono text-slate-600">{user.id}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>PostgreSQL & Prisma 6 Connected</span>
                  </div>
                </div>
              </div>

              {/* Persona Specific Workbench */}
              <div className="mt-6">
                {isThomas ? (
                  /* Mr. Thomas - Elder Accessible View */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50/50 rounded-2xl p-6 border-2 border-emerald-500/80 shadow-xs">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                          <ShieldCheck className="w-7 h-7" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">Your Account is Guarded</h2>
                          <p className="text-sm text-emerald-800 font-medium">Independent Spending Enabled</p>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm mb-6 leading-relaxed">
                        You can make everyday purchases independently without interruptions. Unusual transactions or new
                        merchants will be reviewed with your trusted family for your safety.
                      </p>
                      <div className="bg-white rounded-xl p-4 border border-emerald-200/80 space-y-2.5 text-sm">
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Daily Independent Allowance:</span>
                          <span className="font-bold text-slate-900">$2,500.00 USD</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Family Consultation Threshold:</span>
                          <span className="font-bold text-slate-900">&gt; $100.00 USD</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Unverified Merchants:</span>
                          <span className="font-bold text-emerald-800">Quiet Family Review Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">Your Family Circle</h2>
                          <p className="text-sm text-slate-500">Caregivers with designated permissions</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {elderLinks.map((link) => (
                          <div
                            key={link.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{link.caregiver?.fullName}</div>
                              <div className="text-xs text-slate-500">{link.relationship}</div>
                            </div>
                            <div>
                              {link.permission?.canApprovePayments ? (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approver
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> View Only
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Caregiver View (Maya, David, Sarah) */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                          <Lock className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">Caregiver Authority</h2>
                          <p className="text-sm text-slate-500">Enforced by relational links, not static roles</p>
                        </div>
                      </div>
                      {caregiverLinks.length > 0 ? (
                        <div className="space-y-3">
                          {caregiverLinks.map((link) => (
                            <div key={link.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Protected Parent
                                  </div>
                                  <div className="font-bold text-slate-900 text-base">{link.elder?.fullName}</div>
                                  <div className="text-xs text-slate-500">{link.relationship}</div>
                                </div>
                                <span className="text-xs px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                                  Active Link
                                </span>
                              </div>
                              <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">View Transactions:</span>
                                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600">Payment Approvals:</span>
                                  {link.permission?.canApprovePayments ? (
                                    <span className="font-semibold text-blue-700 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Authorized
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-amber-700 flex items-center gap-1">
                                      <Eye className="w-3.5 h-3.5" /> View-Only (No Approvals)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No linked elders found.</p>
                      )}
                    </div>

                    {/* Server Authorization Sandbox */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                            <Scale className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900">Live Server-Side Auth Check</h2>
                            <p className="text-sm text-slate-500">Testing role-independent permission enforcement</p>
                          </div>
                        </div>

                        {isSarah ? (
                          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-semibold">Sarah is View-Only:</strong> The server will reject this
                              request with <strong className="font-semibold">HTTP 403 Forbidden</strong>.
                            </div>
                          </div>
                        ) : (
                          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-semibold">Authorized Approver:</strong> The server verifies your
                              active link and grants <strong className="font-semibold">HTTP 200 OK</strong>.
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <button
                          onClick={handleTestApprovalPermission}
                          disabled={testLoading}
                          className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                        >
                          {testLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Validating PostgreSQL Relations...</span>
                            </>
                          ) : (
                            <>
                              <span>Test Payment Approval Permission</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>

                        {testResult && (
                          <div
                            className={`mt-4 p-3.5 rounded-xl border text-xs space-y-1 ${
                              testResult.authorized
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50 border-rose-200 text-rose-900'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1.5">
                              {testResult.authorized ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>HTTP {testResult.status} — Authorization Succeeded</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                  <span>HTTP {testResult.status} — Access Denied Server-Side</span>
                                </>
                              )}
                            </div>
                            <div>{testResult.message}</div>
                            {testResult.reason && (
                              <div className="font-medium text-slate-600 pt-1">Reason: {testResult.reason}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Caregiver AI Assistant Quick Bar */}
                  <div className="mt-6 bg-slate-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm">SafePay Caregiver AI Assistant</h3>
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                            🎙️ Voice & Chat
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Ask about Dad&apos;s spending patterns, investigate unfamiliar merchants, or draft a gentle text message.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xs shrink-0"
                    >
                      <span>Open Assistant</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </section>
        )}

        {/* HERO SECTION */}
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              {/* Intentional Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Protected Money Companion for PayPal</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                Dignity for aging parents.{' '}
                <span className="text-slate-600 font-normal block sm:inline">Certainty for their families.</span>
              </h1>

              {/* Body Text grounded in reality */}
              <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
                SafePay acts as a gentle, invisible safety companion between PayPal checkouts and your family care
                circle. Elders spend freely and independently, while suspicious charges and aggressive subscriptions are
                quietly reviewed by trusted loved ones.
              </p>

              {/* Action Buttons with physical active states */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="#demo-section"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Experience Interactive Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 active:scale-[0.98] transition-all shadow-2xs flex items-center justify-center gap-2"
                >
                  <span>See How the Safety Net Works</span>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="pt-8 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60">
                  <div className="text-xs text-slate-500 font-medium">Core Principle</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">Rules Decide First</div>
                </div>
                <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60">
                  <div className="text-xs text-slate-500 font-medium">Explainability</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">Gemini Plain Context</div>
                </div>
                <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60">
                  <div className="text-xs text-slate-500 font-medium">Governance</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">People Hold Control</div>
                </div>
                <div className="p-3 bg-white/60 rounded-xl border border-slate-200/60">
                  <div className="text-xs text-slate-500 font-medium">Checkout Flow</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">PayPal Enterprise V2</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: THE TWO PERSPECTIVES (Emil Kowalski Apple Design + Distill) */}
        <section id="two-perspectives" className="py-16 sm:py-24 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                Designed for Two Different Needs
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                An interface of quiet dignity for parents.{' '}
                <span className="text-slate-500 font-normal">A workbench of clarity for caregivers.</span>
              </p>
              <p className="mt-4 text-slate-600 text-base leading-relaxed">
                Most protective tools feel like surveillance. SafePay replaces friction and shame with two carefully
                tailored perspectives.
              </p>

              {/* Segmented Controller Tab */}
              <div className="mt-8 inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setActiveTab('elder')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'elder'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👴 Elder View (Mr. Thomas)
                </button>
                <button
                  onClick={() => setActiveTab('caregiver')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'caregiver'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  👩‍👧 Caregiver View (Maya & David)
                </button>
              </div>
            </div>

            {/* Interactive Showcase Box */}
            <div className="max-w-4xl mx-auto">
              {activeTab === 'elder' ? (
                /* Elder Experience Showcase */
                <div className="bg-[#FCFCFA] rounded-3xl p-8 sm:p-12 border-2 border-emerald-500/30 shadow-sm transition-all duration-300">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-200/80">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm">
                        🛡️
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
                          Quiet Simplicity
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">Mr. Thomas&apos;s Protected Screen</h3>
                        <p className="text-sm text-slate-500">Zero panic, 18px+ readable text, 48px touch targets</p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300">
                      WCAG AAA Accessible
                    </span>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Simulated Elder Phone Screen */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs text-slate-400 font-medium">SafePay Companion</span>
                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Protected
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 uppercase tracking-wide">Purchase Review</div>
                        <div className="text-xl font-bold text-slate-900">New Hardware Order</div>
                        <div className="text-2xl font-extrabold text-slate-900">$162.45</div>
                      </div>

                      {/* Dignified reassurance message */}
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-slate-800 space-y-2">
                        <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                          <HeartHandshake className="w-4 h-4 text-amber-700" />
                          <span>Family Consultation</span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700">
                          Because this is a new purchase over $100, we sent a quick confirmation note to Maya. You do
                          not need to do anything.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-medium text-sm text-center"
                      >
                        Got it, thank you
                      </button>
                    </div>

                    {/* Architectural Principles Callout */}
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-900">Why this matters:</h4>
                      <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">No scary red alerts:</strong> Aggressive warning banners
                            cause panic or avoidance. SafePay uses reassuring, natural language.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">No confusing error codes:</strong> Never shows technical
                            jargon like &quot;CAPTURE_REJECTED&quot; or &quot;403 FORBIDDEN&quot;.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">Independent daily living:</strong> Everyday groceries,
                            pharmacies, and recurring bills process automatically with zero family friction.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                /* Caregiver Experience Showcase */
                <div className="bg-[#F8FAFC] rounded-3xl p-8 sm:p-12 border-2 border-blue-500/30 shadow-sm transition-all duration-300">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl shadow-sm">
                        📊
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-800 tracking-wider uppercase">
                          Caregiver Workbench
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">Maya & David&apos;s Review Drawer</h3>
                        <p className="text-sm text-slate-500">
                          Instant context, Gemini plain-English risk explanation, 1-click decision
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">
                      First-Response Concurrency
                    </span>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Simulated Caregiver Card */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-500">Pending Review for Mr. Thomas</span>
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          Requires Approval
                        </span>
                      </div>

                      <div>
                        <div className="text-lg font-bold text-slate-900">$399.00 — Cloud Defense Registry</div>
                        <div className="text-xs text-slate-500">Unknown Merchant • Registered 14 days ago</div>
                      </div>

                      {/* Gemini Explanation Box */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Gemini Safety Context</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          &quot;This charge matches known high-pressure telemarketing software campaigns. Mr. Thomas has
                          never transacted with this merchant. A pending spending reservation is held safely.&quot;
                        </p>
                      </div>

                      {/* Decision Buttons */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          className="py-2.5 px-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-xs hover:bg-rose-100 active:scale-[0.98] transition-all"
                        >
                          Decline & Hold
                        </button>
                        <button
                          type="button"
                          className="py-2.5 px-3 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xs"
                        >
                          Approve Purchase
                        </button>
                      </div>
                    </div>

                    {/* Architectural Principles Callout */}
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-900">Why this matters:</h4>
                      <ul className="space-y-3 text-sm text-slate-600">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">First-Response Concurrency:</strong> Maya or David can
                            act; atomic PostgreSQL locks prevent confusing duplicate approvals or double-spend races.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">Contextual Explanations:</strong> Caregivers don&apos;t
                            have to decipher cryptic PayPal merchant IDs. AI explains the real situation immediately.
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-slate-900">Auditable Security:</strong> Granddaughter Sarah has
                            view-only visibility; every single action creates an immutable cryptographic audit record.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION: HOW IT WORKS (The 4 Pillars) */}
        <section id="how-it-works" className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Architectural Rigor</h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                How SafePay protects every dollar
              </p>
              <p className="mt-4 text-slate-600 text-base">
                No black-box guesses. Deterministic rules decide, AI explains in human words, and family stays in
                control.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm mb-4 border border-emerald-200">
                    01
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Everyday Autonomy</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Routine merchants like grocery stores and pharmacies clear in under 120ms without any interruption
                    to the elder.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Zero Friction
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-sm mb-4 border border-blue-200">
                    02
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Deterministic Evaluation</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    PostgreSQL checks daily velocity, unusual transaction spikes, and merchant reputation before capture
                    is attempted.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Exact Database Rules
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 flex items-center justify-center font-bold text-sm mb-4 border border-indigo-200">
                    03
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Gemini Context Engine</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI translates cryptic statement descriptors into human context for family members without technical
                    jargon.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Plain-Language Clarity
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm mb-4">
                    04
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Durable Concurrency</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    No database lock is held during external PayPal HTTP calls. Capture claims are serialized
                    durably.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Zero Race Conditions
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: INTERACTIVE SCENARIO SIMULATOR */}
        <section className="py-16 sm:py-24 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                Live Interactive Simulator
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Experience real-world checkout scenarios
              </p>
              <p className="mt-4 text-slate-600 text-base">
                Click a scenario below to see how SafePay evaluates transactions, preserves dignity, and coordinates
                with family.
              </p>
            </div>

            {/* Scenario Selector Pills */}
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 mb-8">
              {scenarios.map((sc, idx) => (
                <button
                  key={sc.title}
                  onClick={() => setSelectedScenario(idx)}
                  className={`flex-1 p-4 rounded-xl text-left border transition-all text-sm ${
                    selectedScenario === idx
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-[11px] opacity-75 font-medium mb-1">Scenario {idx + 1}</div>
                  <div className="font-bold text-sm">{sc.title}</div>
                  <div className="text-xs opacity-80 mt-1">{sc.amount}</div>
                </button>
              ))}
            </div>

            {/* Scenario Detail Box */}
            <div className="max-w-3xl mx-auto bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Merchant & Category</div>
                  <div className="text-lg font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <Building2 className="w-5 h-5 text-slate-500" />
                    <span>{scenarios[selectedScenario].merchant}</span>
                  </div>
                  <div className="text-xs text-slate-500">{scenarios[selectedScenario].category}</div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">{scenarios[selectedScenario].amount}</div>
                  <span
                    className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${scenarios[selectedScenario].outcomeColor}`}
                  >
                    {scenarios[selectedScenario].outcome}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>What Mr. Thomas Sees</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {scenarios[selectedScenario].elderStatus}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Gemini AI Safety Analysis</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {scenarios[selectedScenario].aiSummary}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: LIVE DEMO PERSONA LAUNCHER */}
        <section id="demo-section" className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                Live Sandbox Ready
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Try SafePay right now as any family member
              </p>
              <p className="mt-4 text-slate-600 text-base">
                Click below to launch an authentic, cryptographically-signed session as any seeded persona. No
                sign-up, credit card, or setup required.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Persona 1: Thomas */}
              <div
                onClick={() => switchPersona('thomas')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isThomas
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
                      👴
                    </div>
                    {isThomas && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                        Active Now
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                    Mr. Thomas
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">Protected Elder (Parent)</div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    Spends independently up to $100. Dignified, simple interface with large touch targets and zero
                    technical error alerts.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>Switch to Mr. Thomas</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Persona 2: Maya */}
              <div
                onClick={() => switchPersona('maya')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isMaya
                    ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xl">
                      👩
                    </div>
                    {isMaya && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white">
                        Active Now
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-800 transition-colors">Maya</h3>
                  <div className="text-xs text-slate-500 font-medium">Daughter (Primary Caregiver)</div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    Full approval authority and settings control. Receives real-time alerts for unverified merchants and
                    unusual charges.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700">
                  <span>Switch to Maya</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Persona 3: David */}
              <div
                onClick={() => switchPersona('david')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isDavid
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xl">
                      👨
                    </div>
                    {isDavid && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                        Active Now
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-800 transition-colors">
                    David
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">Son (Co-Caregiver)</div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    Shares approval rights with sister Maya. Either can approve; first to respond establishes the
                    durable approval lock.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-700">
                  <span>Switch to David</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Persona 4: Sarah */}
              <div
                onClick={() => switchPersona('sarah')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                  isSarah
                    ? 'bg-amber-50/80 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200/80 hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl">
                      👧
                    </div>
                    {isSarah && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-600 text-white">
                        Active Now
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                    Sarah
                  </h3>
                  <div className="text-xs text-slate-500 font-medium">Granddaughter (View-Only Auditor)</div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    Can monitor Mr. Thomas&apos;s spending activity, but server-side authorization blocks her from
                    approving or releasing funds.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-800">
                  <span>Switch to Sarah</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center border border-slate-700 font-bold">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">SafePay — Protected Money Companion</div>
                <div className="text-slate-500 text-[11px]">
                  Built for the PayPal AI Hackathon • Rules decide. AI explains. People remain in control.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-slate-400">
              <span>PostgreSQL 16</span>
              <span>Next.js 15 App Router</span>
              <span>PayPal REST v2</span>
              <span>Google Gemini AI</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Caregiver AI Chatbot & Voice Assistant */}
      <CaregiverAIChatDrawer
        currentUser={user}
        elderName="Mr. Thomas"
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpen={() => {
          if (!user || isThomas) {
            switchPersona('maya').then(() => setIsChatOpen(true));
          } else {
            setIsChatOpen(true);
          }
        }}
      />
    </div>
  );
}
