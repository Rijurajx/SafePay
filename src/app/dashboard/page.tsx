'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Users,
  CreditCard,
  Lock,
  Eye,
  RefreshCw,
  ShoppingBag,
  AlertTriangle,
  X,
  Store,
  Copy,
  Check,
} from 'lucide-react';
import { SessionUser, DemoPersonaKey } from '@/types';
import { DashboardAIChatSection } from '@/components/dashboard/DashboardAIChatSection';

interface LinkedElder {
  id: string;
  fullName: string;
  email: string;
  relationship: string;
  permission: {
    canView: boolean;
    canApprove: boolean;
    canManage: boolean;
  };
  protectionSettings: {
    familyApprovalThreshold: number;
    absoluteDailyCap: number;
  };
  todaySpend: number;
}

interface PendingApproval {
  id: string;
  paymentRequestId: string;
  elderName: string;
  amount: number;
  currency: string;
  merchantName: string;
  category: string;
  expiresAt: string;
  riskScore: number;
  explanation?: {
    summary?: string;
    caregiverExplanation?: string;
    seniorExplanation?: string;
    suggestedQuestionsForSenior?: string[];
    riskFactors?: string[];
  } | null;
}

interface SeniorHold {
  id: string;
  amount: number;
  currency: string;
  merchantName: string;
  category: string;
  seniorMessage: string;
  createdAt: string;
}

interface RecentPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  category: string;
  createdAt: string;
}

interface SeniorGuardian {
  id: string;
  fullName: string;
  email: string;
  relationship: string;
  canApprove: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<'CAREGIVER' | 'PROTECTED_USER' | null>(null);

  // Caregiver state
  const [linkedElders, setLinkedElders] = useState<LinkedElder[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Elder Connect form
  const [connectName, setConnectName] = useState('');
  const [connectEmail, setConnectEmail] = useState('');
  const [connectRelationship, setConnectRelationship] = useState('Father');
  const [connectThreshold, setConnectThreshold] = useState('100');
  const [connectDailyCap, setConnectDailyCap] = useState('1000');
  const [connectSubmitting, setConnectSubmitting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    elderName: string;
    contact: string;
    inviteLink: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Senior state
  const [seniorTodaySpend, setSeniorTodaySpend] = useState<number>(0);
  const [seniorDailyCap, setSeniorDailyCap] = useState<number>(1000);
  const [seniorFamilyThreshold, setSeniorFamilyThreshold] = useState<number>(100);
  const [seniorGuardians, setSeniorGuardians] = useState<SeniorGuardian[]>([]);
  const [seniorHolds, setSeniorHolds] = useState<SeniorHold[]>([]);
  const [seniorRecentPayments, setSeniorRecentPayments] = useState<RecentPayment[]>([]);

  // Action states
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary');
      if (res.status === 401) {
        router.push('/auth/signin');
        return;
      }
      const data = await res.json();
      setCurrentUser(data.user);
      setRole(data.role);

      if (data.role === 'CAREGIVER') {
        setLinkedElders(data.linkedElders || []);
        if (data.linkedElders?.length > 0 && !selectedElderId) {
          setSelectedElderId(data.linkedElders[0].id);
        }
        setPendingApprovals(data.pendingApprovals || []);
      } else {
        setSeniorTodaySpend(data.todaySpend || 0);
        setSeniorDailyCap(data.dailyCap || 1000);
        setSeniorFamilyThreshold(data.familyThreshold || 100);
        setSeniorGuardians(data.guardians || []);
        setSeniorHolds(data.activeHolds || []);
        setSeniorRecentPayments(data.recentPayments || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard summary:', e);
    } finally {
      setLoading(false);
    }
  }, [router, selectedElderId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const switchPersona = async (key: DemoPersonaKey) => {
    try {
      await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: key }),
      });
      await fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/signin');
  };

  const handleDecision = async (approvalId: string, decision: 'APPROVED' | 'DECLINED') => {
    setDecidingId(approvalId);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'APPROVED' ? 'Approved by family caregiver' : 'Declined for safety',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionNotice({
          message: data.error || 'Failed to authorize action. Check permissions.',
          type: 'error',
        });
      } else {
        setActionNotice({
          message:
            decision === 'APPROVED'
              ? 'Transaction approved! PayPal sandbox payment has been authorized.'
              : 'Transaction declined. Protected user will not be charged.',
          type: 'success',
        });
        await fetchSummary();
      }
    } catch {
      setActionNotice({
        message: 'Network error processing decision.',
        type: 'error',
      });
    } finally {
      setDecidingId(null);
    }
  };

  const handleSwitchFamily = async (targetUserId: string) => {
    setActionNotice(null);
    try {
      const res = await fetch('/api/auth/switch-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice({ message: data.message || 'Switched account view', type: 'success' });
        await fetchSummary();
      } else {
        setActionNotice({ message: data.error || 'Failed to switch view', type: 'error' });
      }
    } catch {
      setActionNotice({ message: 'Error switching family view', type: 'error' });
    }
  };

  const handleConnectElder = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectSubmitting(true);
    setConnectError(null);
    setCreatedInvite(null);

    try {
      const res = await fetch('/api/family/invite-elder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderFullName: connectName,
          elderEmailOrPhone: connectEmail,
          relationship: connectRelationship,
          approvalThreshold: parseFloat(connectThreshold) || 100,
          dailyCap: parseFloat(connectDailyCap) || 1000,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectError(data.error || 'Failed to issue invitation');
      } else {
        setCreatedInvite({
          elderName: connectName,
          contact: connectEmail,
          inviteLink: data.inviteLink,
        });
        fetchSummary();
      }
    } catch {
      setConnectError('Network error issuing invitation.');
    } finally {
      setConnectSubmitting(false);
    }
  };

  const activeElder = linkedElders.find((e) => e.id === selectedElderId) || linkedElders[0];
  const canUserApprove = activeElder?.permission?.canApprove ?? false;

  if (loading) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center p-6 text-slate-800">
        <div className="liquid-glass rounded-3xl p-8 flex flex-col items-center gap-4 shadow-xl border border-white/80">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-slate-700">Loading SafePay Shield...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 pb-20">
      {/* Minimal Top Navigation */}
      <header className="sticky top-4 z-40 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="liquid-glass rounded-full px-5 py-2.5 flex items-center justify-between border border-white/80 shadow-sm">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold tracking-tight text-sm text-slate-950">SafePay</span>
          </Link>

          {/* Persona Switch & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/[0.04] p-1 rounded-full border border-black/5">
              <button
                onClick={() => switchPersona('thomas')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  currentUser?.email.includes('thomas')
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Mr. Thomas
              </button>
              <button
                onClick={() => switchPersona('maya')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  currentUser?.email.includes('maya')
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Maya
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Notice Alert Toast */}
        {actionNotice && (
          <div
            className={`mt-3 p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : actionNotice.type === 'error'
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : 'bg-blue-50 text-blue-900 border border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="p-1 hover:bg-black/5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {role === 'CAREGIVER' ? (
          /* =========================================================================
             CAREGIVER DASHBOARD VIEW
             ========================================================================= */
          <>
            {/* ELDER SELECTOR & STATS BAR */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-7 border border-white/80 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full">
                    Family Guardian Circle
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Logged in as {currentUser?.fullName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                    Protecting: {activeElder?.fullName || 'Senior Member'}
                  </h1>
                  {activeElder && (
                    activeElder.permission?.canView ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Shield Active
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Awaiting Senior Consent
                      </span>
                    )
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {currentUser?.email.includes('sarah') ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                      <Eye className="w-3.5 h-3.5" /> View-Only Access — Sarah can inspect transactions but cannot approve.
                    </span>
                  ) : !activeElder?.permission?.canView ? (
                    <span className="inline-flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/60">
                      <Clock className="w-3.5 h-3.5" /> Monitoring Paused: {activeElder?.fullName} must accept your family invitation before oversight activates.
                    </span>
                  ) : (
                    `Relationship: ${activeElder?.relationship || 'Family'} • Authorized to approve held transactions.`
                  )}
                </p>
              </div>

              {/* Quick Actions & Add Elder */}
              <div className="flex flex-wrap items-center gap-3">
                {activeElder && (
                  <>
                    <Link
                      href={`/checkout?elderId=${activeElder.id}`}
                      className="liquid-pill px-3.5 py-2 text-xs font-semibold text-slate-900 flex items-center gap-1.5 shadow-2xs hover:bg-white active:scale-95 transition-all"
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <span>Simulate Checkout as {activeElder.fullName}</span>
                    </Link>
                    <button
                      onClick={() => handleSwitchFamily(activeElder.id)}
                      className="liquid-pill px-3.5 py-2 text-xs font-semibold text-slate-900 flex items-center gap-1.5 shadow-2xs hover:bg-white active:scale-95 transition-all"
                      title="Switch session to experience SafePay through the senior's perspective"
                    >
                      <Eye className="w-4 h-4 text-purple-600" />
                      <span>Switch to Senior View</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="liquid-pill px-4 py-2 text-xs font-semibold text-slate-900 flex items-center gap-1.5 shadow-2xs hover:bg-white active:scale-95 transition-all"
                >
                  <UserPlus className="w-4 h-4 text-purple-600" />
                  <span>Connect Another Elder</span>
                </button>
                <button
                  onClick={() => {
                    document.getElementById('ai-chat-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 rounded-full bg-slate-950 text-white text-xs font-semibold flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-md shadow-slate-950/10"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Ask Caregiver AI</span>
                </button>
              </div>
            </div>

            {/* THREE METRICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Today's Spend */}
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <span>Today&apos;s Spending</span>
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-950">
                    ${(activeElder?.todaySpend || 0).toFixed(2)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Daily Cap Limit: ${(activeElder?.protectionSettings.absoluteDailyCap || 1000).toLocaleString()}
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          ((activeElder?.todaySpend || 0) /
                            (activeElder?.protectionSettings.absoluteDailyCap || 1000)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Family Approval Threshold */}
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <span>Auto-Approval Threshold</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-950">
                    ${(activeElder?.protectionSettings.familyApprovalThreshold || 100).toFixed(2)}
                  </div>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Charges over ${activeElder?.protectionSettings.familyApprovalThreshold || 100} or unfamiliar merchants automatically hold for family approval.
                  </p>
                </div>
              </div>

              {/* Card 3: Pending Approvals Hub */}
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <span>Pending Holds</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-slate-950">
                      {pendingApprovals.length}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">requests waiting</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {pendingApprovals.length > 0
                      ? 'Requires caregiver review before PayPal order captures.'
                      : 'All elder transactions are safe and in order.'}
                  </p>
                </div>
              </div>
            </div>

            {/* PENDING APPROVALS HUB (THE HERO COMPONENT) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">Pending Approvals Hub</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    {pendingApprovals.length} Active
                  </span>
                </div>
                <span className="text-xs text-slate-500">Live AI Risk Analysis Active</span>
              </div>

              {pendingApprovals.length === 0 ? (
                /* Calm Empty State */
                <div className="liquid-glass rounded-3xl p-10 text-center border border-white/80 shadow-sm space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-base font-bold text-slate-900">All Clear — No Pending Approvals</h3>
                    <p className="text-xs text-slate-600">
                      Mr. Thomas has no transactions on hold. Routine pharmacy, grocery, and low-risk purchases are authorized automatically.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/checkout"
                      className="liquid-pill px-4 py-2 text-xs font-semibold text-slate-900 shadow-2xs hover:bg-white"
                    >
                      Trigger a Test Suspicious Charge on /checkout &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                /* Active Pending Approvals Cards */
                <div className="grid grid-cols-1 gap-6">
                  {pendingApprovals.map((req) => (
                    <div
                      key={req.id}
                      className="liquid-glass rounded-3xl p-6 sm:p-7 border border-amber-200/80 shadow-[0_16px_40px_-12px_rgba(245,158,11,0.12)] space-y-6"
                    >
                      {/* Top Header of the Request */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" /> High Risk Hold
                            </span>
                            <span className="text-xs text-slate-500">Protected Member: {req.elderName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-950">{req.merchantName}</h3>
                            <span className="text-xs text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-black/5">
                              {req.category}
                            </span>
                          </div>
                        </div>

                        {/* Amount & Risk Score */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-xs text-slate-500 font-semibold uppercase">Requested Amount</span>
                            <div className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                              ${req.amount.toFixed(2)} {req.currency}
                            </div>
                          </div>
                          <div className="liquid-glass-subtle px-4 py-2 rounded-2xl text-center border border-amber-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                              Risk Score
                            </span>
                            <div className="text-xl font-bold text-amber-600">{req.riskScore}/100</div>
                          </div>
                        </div>
                      </div>

                      {/* Gemini AI Briefing Box */}
                      <div className="bg-white/80 rounded-2xl p-5 border border-purple-100 shadow-2xs space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span>Gemini AI Caregiver Analysis</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {req.explanation?.caregiverExplanation ||
                            req.explanation?.summary ||
                            `Transaction of $${req.amount} exceeds family threshold ($100). Merchant "${req.merchantName}" is unfamiliar with higher anomaly risk.`}
                        </p>

                        {/* Suggested Conversation Starters */}
                        {req.explanation?.suggestedQuestionsForSenior &&
                          req.explanation.suggestedQuestionsForSenior.length > 0 && (
                            <div className="pt-2 border-t border-purple-50 space-y-1.5">
                              <span className="text-[11px] font-semibold text-purple-700">
                                Suggested Questions to Ask Dad:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {req.explanation.suggestedQuestionsForSenior.map((q, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[11px] bg-purple-50 text-purple-900 px-3 py-1 rounded-full border border-purple-200/60 font-medium"
                                  >
                                    &ldquo;{q}&rdquo;
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Caregiver Decision Actions */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Expires in 30 minutes if unconfirmed</span>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          {/* Decline Button */}
                          <button
                            onClick={() => handleDecision(req.id, 'DECLINED')}
                            disabled={decidingId === req.id}
                            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Decline Charge</span>
                          </button>

                          {/* Approve Button (Role-Aware) */}
                          {canUserApprove ? (
                            <button
                              onClick={() => handleDecision(req.id, 'APPROVED')}
                              disabled={decidingId === req.id}
                              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-full text-xs font-bold text-white bg-slate-950 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-950/10"
                            >
                              {decidingId === req.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              )}
                              <span>Approve & Authorize PayPal</span>
                            </button>
                          ) : (
                            <div
                              title="Sarah has View-Only permission. Approvals require Maya or David."
                              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>View-Only (Approval Locked)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI PAYMENT ASSISTANT CHAT (DESIGNED LIKE HOMEPAGE HERO SECTION) */}
            <div id="ai-chat-section" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    Payment Context & AI Assistant
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-900 border border-purple-200">
                    Gemini 2.5 Flash
                  </span>
                </div>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Streaming live context from {activeElder?.fullName || 'Mr. Thomas'}&apos;s spending patterns
                </span>
              </div>

              <DashboardAIChatSection
                currentUser={currentUser}
                elderName={activeElder?.fullName || 'Mr. Thomas'}
                elderId={activeElder?.id}
                pendingApprovals={pendingApprovals}
              />
            </div>

            {/* GUARDIAN TEAM & FAMILY LINK PERMISSIONS */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-7 border border-white/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-950">Family Guardians & Permissions</h3>
                </div>
                <span className="text-xs text-slate-500">Dual-Control Tier System</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/80 p-4 rounded-2xl border border-blue-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Maya Henderson</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Primary Approver
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Daughter • Full Approval Authority & Settings</p>
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Approves holds, sets caps
                  </div>
                </div>

                <div className="bg-white/80 p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">David Henderson</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Secondary Approver
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Son • Full Approval Authority</p>
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Can approve high-risk orders
                  </div>
                </div>

                <div className="bg-white/80 p-4 rounded-2xl border border-amber-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Sarah Henderson</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Auditor (View-Only)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Granddaughter • Audit Visibility</p>
                  <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                    <Eye className="w-3 h-3 text-slate-400" /> Inspects activity, cannot approve
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* =========================================================================
             PROTECTED SENIOR VIEW (MR. THOMAS)
             ========================================================================= */
          <div className="max-w-4xl mx-auto space-y-8">
            {/* WARM WELCOME CARD */}
            <div className="liquid-glass rounded-3xl p-8 sm:p-10 border border-white/80 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.1)] space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                    Welcome back, {currentUser?.fullName || 'Thomas'}
                  </h1>
                  <p className="text-sm font-semibold text-emerald-800">
                    Your SafePay Shield is active and safeguarding your PayPal transactions.
                  </p>
                </div>
              </div>

              {/* Family Caregiver Safeguards Reassurance */}
              <div className="bg-white/70 rounded-2xl p-5 border border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Your Family Guardians
                  </div>
                  <p className="text-sm text-slate-800 font-medium">
                    {seniorGuardians.length > 0
                      ? `${seniorGuardians.map((g) => `${g.fullName} (${g.relationship})`).join(', ')} are linked to confirm unusual or large payments.`
                      : 'Maya and David are linked to confirm unusual or large payments.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {seniorGuardians.length > 0 && (
                    <button
                      onClick={() => handleSwitchFamily(seniorGuardians[0].id)}
                      className="liquid-pill px-3 py-1 text-xs font-semibold text-slate-800 flex items-center gap-1 shadow-2xs hover:bg-white"
                      title="Switch session to experience Guardian approval mode"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Switch to Caregiver View</span>
                    </button>
                  )}
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
                    Threshold: ${seniorFamilyThreshold.toFixed(0)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Daily Cap: ${seniorDailyCap.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Today's Spend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="liquid-glass-subtle rounded-2xl p-5 border border-white">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Today&apos;s Purchases
                  </span>
                  <div className="text-3xl font-extrabold text-slate-950 mt-1">
                    ${seniorTodaySpend.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Routine purchases process normally.</p>
                </div>

                <div className="liquid-glass-subtle rounded-2xl p-5 border border-white flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Protected Shopping
                    </span>
                    <p className="text-xs text-slate-700 font-medium mt-1">
                      Ready to test shopping online? Launch the SafePay simulated checkout experience.
                    </p>
                  </div>
                  <Link
                    href="/checkout"
                    className="mt-3 px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-all text-center shadow-sm flex items-center justify-center gap-2 active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4 text-purple-300" />
                    <span>Try Protected Checkout</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* ACTIVE HOLDS SECTION (CALM SENIOR COPY) */}
            {seniorHolds.length > 0 && (
              <div className="liquid-glass rounded-3xl p-7 border border-amber-200 shadow-md space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-950">We&apos;re Checking In With Your Family</h2>
                </div>

                {seniorHolds.map((hold) => (
                  <div
                    key={hold.id}
                    className="bg-white/90 rounded-2xl p-5 border border-amber-100 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900">{hold.merchantName}</div>
                        <div className="text-xs text-slate-500">{hold.category}</div>
                      </div>
                      <div className="text-xl font-extrabold text-slate-950">${hold.amount.toFixed(2)}</div>
                    </div>
                    <p className="text-xs text-slate-700 font-medium bg-amber-50/70 p-3 rounded-xl border border-amber-100/60 leading-relaxed">
                      {hold.seniorMessage}
                    </p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Maya has been alerted on her phone. No action needed from you.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RECENT PURCHASES */}
            <div className="liquid-glass rounded-3xl p-7 border border-white/80 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-950">Recent Purchases</h2>
              {seniorRecentPayments.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No purchases recorded yet today. Routine transactions will appear here.
                </div>
              ) : (
                <div className="divide-y divide-black/5">
                  {seniorRecentPayments.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{p.merchantName}</div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(p.createdAt).toLocaleDateString()} • {p.category}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-950">${p.amount.toFixed(2)}</div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            p.status === 'SETTLED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'AWAITING_FAMILY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CONNECT / INVITE ELDER MODAL */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-white shadow-2xl relative space-y-6">
            <button
              onClick={() => {
                setIsConnectModalOpen(false);
                setCreatedInvite(null);
                setConnectError(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-black/5 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            {createdInvite ? (
              /* Success: Invitation Link Ready for Sharing */
              <div className="space-y-5 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-950">Invitation Issued for {createdInvite.elderName}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    SafePay requires <strong className="text-slate-900">{createdInvite.elderName}</strong> to accept your family invitation before financial oversight can begin.
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] text-amber-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Senior Consent Gate Active</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Until {createdInvite.elderName} opens this link and accepts, transactions will not be monitored.
                  </p>
                </div>

                {/* Invitation Link Box */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Invitation Link:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInvite.inviteLink}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-mono outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdInvite.inviteLink);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs"
                    >
                      {copiedInvite ? (
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

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <a
                    href={createdInvite.inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:flex-1 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Open Senior Consent Screen (Test) &rarr;</span>
                  </a>
                  <button
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      setCreatedInvite(null);
                      setConnectName('');
                      setConnectEmail('');
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Invitation Form */
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-950">Invite an Elderly Family Member</h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    SafePay protects your loved ones with their consent. Enter their details below to send an invitation.
                  </p>
                </div>

                {connectError && (
                  <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium">
                    {connectError}
                  </div>
                )}

                <form onSubmit={handleConnectElder} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Senior Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Thomas Sterling"
                      value={connectName}
                      onChange={(e) => setConnectName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email or Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. thomas@family.org"
                      value={connectEmail}
                      onChange={(e) => setConnectEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                    <select
                      value={connectRelationship}
                      onChange={(e) => setConnectRelationship(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Grandfather">Grandfather</option>
                      <option value="Grandmother">Grandmother</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Relative">Relative</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Family Approval Threshold ($)
                      </label>
                      <input
                        type="number"
                        value={connectThreshold}
                        onChange={(e) => setConnectThreshold(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                      <span className="text-[10px] text-slate-500">Hold charges above this amount</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Daily Maximum Cap ($)
                      </label>
                      <input
                        type="number"
                        value={connectDailyCap}
                        onChange={(e) => setConnectDailyCap(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                      <span className="text-[10px] text-slate-500">Hard stop across 24 hours</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={connectSubmitting}
                      className="w-full py-3 rounded-full bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {connectSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      ) : (
                        <UserPlus className="w-4 h-4 text-emerald-400" />
                      )}
                      <span>Issue Invitation & Generate Link</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
