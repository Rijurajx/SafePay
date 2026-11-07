'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CaregiverAIChatDrawer } from '@/components/caregiver/CaregiverAIChatDrawer';
import {
  SessionUser,
  RiskSignal,
  PendingApprovalItem,
  FullRiskAssessmentResponse,
  CheckoutCreateOrderResponse,
  FamilyActivityData,
  ActivityAuditLogItem,
} from '@/types';
import {
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Clock,
  Lock,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface ScenarioPreset {
  id: string;
  name: string;
  amount: number;
  merchantName: string;
  category: string;
  icon: string;
  description: string;
}

const SCENARIOS: ScenarioPreset[] = [
  {
    id: 'groceries',
    name: 'Routine Groceries',
    amount: 28.5,
    merchantName: 'Local Market',
    category: 'Groceries',
    icon: '🛒',
    description: 'Everyday routine purchase well within historical baseline ($24.50 median).',
  },
  {
    id: 'pharmacy',
    name: 'Walgreens Pharmacy',
    amount: 34.2,
    merchantName: 'Walgreens Pharmacy #4102',
    category: 'Medical & Healthcare',
    icon: '💊',
    description: 'Trusted healthcare merchant, regular monthly medication.',
  },
  {
    id: 'tablet',
    name: 'Reading Tablet',
    amount: 185.0,
    merchantName: 'TechGadget Superstore',
    category: 'Consumer Electronics',
    icon: '📱',
    description: 'Exceeds $100 family notification threshold + new online merchant.',
  },
  {
    id: 'scam',
    name: 'Unsolicited PC Support',
    amount: 489.0,
    merchantName: 'Global PC Tech Care LLC',
    category: 'Overseas Telemarketing',
    icon: '⚠️',
    description: 'High-risk telemarketing scam pattern with extreme statistical anomaly.',
  },
];

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'senior' | 'guardian' | 'activity'>('senior');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioPreset>(SCENARIOS[0]);
  const [customAmount, setCustomAmount] = useState('28.50');
  const [customMerchant, setCustomMerchant] = useState('Local Market');
  const [customCategory, setCustomCategory] = useState('Groceries');
  const [isCustom, setIsCustom] = useState(false);

  // Evaluation states
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<FullRiskAssessmentResponse | null>(null);
  const [paypalCheckoutLoading, setPaypalCheckoutLoading] = useState(false);
  const [paypalOrderResult, setPaypalOrderResult] = useState<CheckoutCreateOrderResponse | null>(null);

  // Guardian Approvals state
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null);
  const [copiedQuestionIndex, setCopiedQuestionIndex] = useState<number | null>(null);

  // Activity Ledger state
  const [activityData, setActivityData] = useState<FamilyActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);

  // Mascot eye-tracking refs
  const heroMascotRef = useRef<HTMLDivElement>(null);
  const statementMascotRef = useRef<HTMLDivElement>(null);

  // Refresh user session
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Fetch pending approvals for caregiver
  const fetchPendingApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const res = await fetch('/api/approvals/pending');
      const data = await res.json();
      if (res.ok && data.pendingApprovals) {
        setPendingApprovals(data.pendingApprovals);
      }
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  // Fetch family activity & audit log
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch('/api/family/activity');
      const data = await res.json();
      if (res.ok) {
        setActivityData(data);
      }
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (activeTab === 'guardian') {
      fetchPendingApprovals();
    } else if (activeTab === 'activity') {
      fetchActivity();
    }
  }, [activeTab, fetchPendingApprovals, fetchActivity]);

  // Mascot eye-tracking physics
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const updateMascot = (mascotEl: HTMLDivElement | null, maxDist: number) => {
        if (!mascotEl) return;
        const rect = mascotEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        const angle = Math.atan2(deltaY, deltaX);
        const distance = Math.min(maxDist, Math.hypot(deltaX, deltaY) / 18);

        const moveX = Math.cos(angle) * distance;
        const moveY = Math.sin(angle) * distance;

        const eyes = mascotEl.querySelectorAll<HTMLDivElement>('.mascot-eye');
        eyes.forEach((eye) => {
          eye.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
      };

      updateMascot(heroMascotRef.current, 5);
      updateMascot(statementMascotRef.current, 11);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Switch demo persona
  const switchPersona = async (personaKey: 'thomas' | 'maya' | 'david' | 'sarah') => {
    try {
      await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: personaKey }),
      });
      await refreshSession();
      setPersonaDropdownOpen(false);
      if (activeTab === 'guardian') {
        await fetchPendingApprovals();
      }
      if (activeTab === 'activity') {
        await fetchActivity();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run live risk evaluation
  const handleInitiatePayment = async () => {
    setEvaluating(true);
    setEvalResult(null);
    setPaypalOrderResult(null);

    const amount = isCustom ? parseFloat(customAmount) : selectedScenario.amount;
    const merchantName = isCustom ? customMerchant : selectedScenario.merchantName;
    const category = isCustom ? customCategory : selectedScenario.category;

    try {
      // Ensure session is set to Thomas if currently caregiver
      if (!user || !user.email.includes('thomas')) {
        await switchPersona('thomas');
      }

      const res = await fetch('/api/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          merchantName,
          category,
        }),
      });

      const data = await res.json();
      setEvalResult(data);
    } catch (err) {
      console.error('Evaluation error:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Create live PayPal Sandbox order
  const handleProceedToPayPal = async () => {
    if (!evalResult?.paymentRequestId) return;
    setPaypalCheckoutLoading(true);

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentRequestId: evalResult.paymentRequestId,
          returnUrl: `${window.location.origin}/?paypal=success`,
          cancelUrl: `${window.location.origin}/?paypal=cancel`,
        }),
      });

      const data = await res.json();
      setPaypalOrderResult(data);
      if (data.approveUrl) {
        window.open(data.approveUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('PayPal checkout error:', err);
    } finally {
      setPaypalCheckoutLoading(false);
    }
  };

  // Caregiver decision handler (Approve / Decline)
  const handleCaregiverDecision = async (approvalId: string, decision: 'APPROVED' | 'DECLINED') => {
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'APPROVED' ? 'Approved by caregiver review' : 'Declined by caregiver review',
        }),
      });

      const data = await res.json();

      if (res.status === 403) {
        // Expected security error when Sarah attempts approval
        setActionFeedback({
          id: approvalId,
          type: 'error',
          message: `🔒 Role Restriction: ${data.error}`,
        });
      } else if (res.ok && data.success) {
        setActionFeedback({
          id: approvalId,
          type: 'success',
          message: decision === 'APPROVED'
            ? '✓ Payment hold approved and released for checkout!'
            : '✓ Transaction declined and funds released back to Dad.',
        });
        await fetchPendingApprovals();
        await fetchActivity();
      } else {
        setActionFeedback({
          id: approvalId,
          type: 'error',
          message: data.error || 'Failed to process decision.',
        });
      }
    } catch (err) {
      console.error('Error deciding approval:', err);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIndex(index);
    setTimeout(() => setCopiedQuestionIndex(null), 2000);
  };

  // Current persona helpers
  const isThomas = user?.email.includes('thomas');
  const isMaya = user?.email.includes('maya');
  const isDavid = user?.email.includes('david');
  const isSarah = user?.email.includes('sarah');

  return (
    <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 relative pb-24">
      {/* FLOATING ISLAND NAVIGATION */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 liquid-glass rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 sm:gap-6 shadow-[0_12px_36px_rgb(0,0,0,0.06)] border border-white/80 transition-all duration-200 w-[95%] max-w-4xl">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold tracking-tight text-sm text-slate-900">SafePay</span>
          <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 hidden sm:inline-block">
            Protected Money
          </span>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center bg-black/[0.04] p-1 rounded-full border border-black/5 text-xs font-medium">
          <button
            onClick={() => setActiveTab('senior')}
            className={`px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'senior'
                ? 'bg-white text-slate-950 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Senior View
          </button>
          <button
            onClick={() => setActiveTab('guardian')}
            className={`px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-[0.98] flex items-center gap-1.5 ${
              activeTab === 'guardian'
                ? 'bg-white text-slate-950 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span>Caregiver Hub</span>
            {pendingApprovals.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingApprovals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-[0.98] hidden sm:inline-block ${
              activeTab === 'activity'
                ? 'bg-white text-slate-950 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Audit Ledger
          </button>
        </div>

        {/* Persona Selector Popover */}
        <div className="relative shrink-0">
          <button
            onClick={() => setPersonaDropdownOpen(!personaDropdownOpen)}
            className="liquid-pill px-3 py-1.5 text-xs font-semibold text-slate-900 flex items-center gap-2 hover:bg-white active:scale-[0.98]"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isThomas ? 'bg-purple-600' : isMaya ? 'bg-blue-600' : isDavid ? 'bg-indigo-600' : 'bg-amber-600'
              }`}
            />
            <span className="truncate max-w-[100px] sm:max-w-none">
              {user ? user.fullName.split(' ')[0] : 'Switch Role'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>

          {personaDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 liquid-glass rounded-2xl p-2 border border-white/80 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-black/5">
                Simulate Role Identity
              </div>
              <div className="space-y-1 pt-1.5">
                <button
                  onClick={() => switchPersona('thomas')}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isThomas ? 'bg-white/90 shadow-2xs font-semibold' : 'hover:bg-white/50'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-900">Mr. Thomas Sterling</div>
                    <div className="text-[11px] text-slate-500 font-normal">Protected Senior • Purchases funds</div>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                    Elder
                  </span>
                </button>
                <button
                  onClick={() => switchPersona('maya')}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isMaya ? 'bg-white/90 shadow-2xs font-semibold' : 'hover:bg-white/50'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-900">Maya Sterling</div>
                    <div className="text-[11px] text-slate-500 font-normal">Primary Caregiver • Full Approver</div>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                    Approver
                  </span>
                </button>
                <button
                  onClick={() => switchPersona('david')}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isDavid ? 'bg-white/90 shadow-2xs font-semibold' : 'hover:bg-white/50'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-900">David Sterling</div>
                    <div className="text-[11px] text-slate-500 font-normal">Co-Caregiver • Can Approve Holds</div>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                    Approver
                  </span>
                </button>
                <button
                  onClick={() => switchPersona('sarah')}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isSarah ? 'bg-white/90 shadow-2xs font-semibold' : 'hover:bg-white/50'
                  }`}
                >
                  <div>
                    <div className="text-xs text-slate-900">Sarah Sterling</div>
                    <div className="text-[11px] text-amber-700 font-normal">View-Only • Strict RBAC Test</div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    View-Only
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-28 sm:pt-36 pb-10 px-6 max-w-4xl mx-auto flex flex-col items-center text-center gap-4">
        {/* Role Identity Banner */}
        <div className="liquid-pill px-4 py-1.5 text-xs text-slate-700 flex items-center gap-2 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-900">Active Mode:</span>
          <span>
            {isThomas
              ? 'Mr. Thomas (Protected Senior)'
              : isMaya
              ? 'Maya Sterling (Primary Caregiver)'
              : isDavid
              ? 'David Sterling (Caregiver Approver)'
              : 'Sarah Sterling (View-Only Caregiver)'}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-950 leading-[1.1] max-w-3xl">
          Protected payments for{' '}
          <span className="inline-flex items-center align-middle mx-1 sm:mx-2">
            <div
              ref={heroMascotRef}
              id="hero-mascot"
              className="w-10 h-10 md:w-14 md:h-14 rounded-full relative overflow-hidden mascot-container cursor-pointer hover:scale-105 transition-transform active:scale-95 shadow-md bg-white border border-white/80"
            >
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 md:gap-2">
                <div className="mascot-eye w-1.5 h-3 md:w-2 md:h-3.5 bg-slate-950 rounded-full transition-all duration-100" />
                <div className="mascot-eye w-1.5 h-3 md:w-2 md:h-3.5 bg-slate-950 rounded-full transition-all duration-100" />
              </div>
            </div>
          </span>{' '}
          everyone you love.
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-xl leading-relaxed">
          Rules decide. Math calculates. AI explains. People remain in control.
        </p>
      </section>

      {/* MAIN INTERACTIVE WORKSPACE */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        {activeTab === 'senior' && (
          /* TAB 1: SENIOR CHECKOUT SIMULATOR */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Scenario Picker */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-5 border-b border-black/5">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select a Real-Life Scenario to Test</h3>
                  <p className="text-xs text-slate-500">
                    Watch how the deterministic policy engine and Gemini explainer behave in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    PayPal Sandbox Connected
                  </span>
                </div>
              </div>

              {/* Scenario Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-5">
                {SCENARIOS.map((scenario) => {
                  const isSelected = !isCustom && selectedScenario.id === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => {
                        setIsCustom(false);
                        setSelectedScenario(scenario);
                        setEvalResult(null);
                        setPaypalOrderResult(null);
                      }}
                      className={`text-left p-4 rounded-2xl transition-all duration-200 active:scale-[0.98] border ${
                        isSelected
                          ? 'bg-white shadow-md border-purple-500/30 ring-2 ring-purple-500/10'
                          : 'bg-white/40 hover:bg-white/80 border-black/5'
                      }`}
                    >
                      <div className="text-2xl mb-2">{scenario.icon}</div>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="font-bold text-xs text-slate-900">{scenario.name}</div>
                        <div className="font-bold text-sm text-slate-950">${scenario.amount.toFixed(2)}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mb-2">{scenario.merchantName}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">
                        {scenario.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Transaction Option */}
              <div className="mt-4 pt-4 border-t border-black/5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsCustom(!isCustom)}
                  className={`liquid-pill px-3.5 py-1.5 text-xs font-medium transition-all ${
                    isCustom ? 'bg-slate-950 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✏️ Custom Amount & Store
                </button>

                {isCustom && (
                  <div className="flex flex-wrap items-center gap-2 w-full pt-2">
                    <input
                      type="number"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Amount ($)"
                      className="h-9 px-3 rounded-xl bg-white border border-black/10 text-xs font-semibold w-28 text-slate-900"
                    />
                    <input
                      type="text"
                      value={customMerchant}
                      onChange={(e) => setCustomMerchant(e.target.value)}
                      placeholder="Merchant Name"
                      className="h-9 px-3 rounded-xl bg-white border border-black/10 text-xs flex-1 min-w-[160px] text-slate-900"
                    />
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Category"
                      className="h-9 px-3 rounded-xl bg-white border border-black/10 text-xs w-36 text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Live Checkout Evaluation Terminal */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between pb-6 border-b border-black/5">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Simulated Checkout Screen
                  </span>
                  <h3 className="font-bold text-slate-950 text-lg sm:text-xl">
                    {isCustom ? customMerchant : selectedScenario.merchantName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Due</span>
                  <div className="text-2xl font-bold text-slate-950">
                    ${isCustom ? parseFloat(customAmount || '0').toFixed(2) : selectedScenario.amount.toFixed(2)} USD
                  </div>
                </div>
              </div>

              {/* Action Stage */}
              <div className="py-6 flex flex-col items-center justify-center text-center">
                {!evalResult && !evaluating && (
                  <div className="space-y-4 max-w-md">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Click below to submit this payment through SafePay&apos;s live risk evaluation pipeline.
                    </p>
                    <button
                      onClick={handleInitiatePayment}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-slate-950 text-white font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md shadow-slate-950/10 flex items-center justify-center gap-2 mx-auto"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Initiate Protected Checkout</span>
                    </button>
                  </div>
                )}

                {evaluating && (
                  <div className="py-8 space-y-4">
                    <div className="w-12 h-12 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mx-auto" />
                    <div>
                      <div className="font-semibold text-sm text-slate-900">Evaluating Safety Baseline...</div>
                      <div className="text-xs text-slate-500">
                        Running deterministic rules, Modified Z-Score calculations, and Gemini explainer
                      </div>
                    </div>
                  </div>
                )}

                {evalResult && (
                  <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* SCENARIO A: AUTO-APPROVED WITHIN BASELINE */}
                    {evalResult.classification === 'NORMAL' && (
                      <div className="liquid-glass-subtle rounded-2xl p-6 border border-emerald-500/30 bg-emerald-50/40 text-left space-y-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-sm">Payment Approved Automatically</h4>
                              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                                Within Baseline
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {evalResult.explanation?.seniorMessage || 'Payment approved! Thank you, Thomas.'}
                            </p>
                          </div>
                        </div>

                        {/* Complete with PayPal Sandbox Button */}
                        <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <span className="text-xs text-emerald-900 font-medium">
                            Ready for immediate capture on PayPal Sandbox.
                          </span>
                          <button
                            onClick={handleProceedToPayPal}
                            disabled={paypalCheckoutLoading}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0070ba] hover:bg-[#003087] text-white font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs"
                          >
                            {paypalCheckoutLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>Pay with PayPal</span>
                            )}
                            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SCENARIO B: FAMILY APPROVAL HOLD TRIGGERED */}
                    {evalResult.requiresFamilyApproval && (
                      <div className="liquid-glass-subtle rounded-2xl p-6 border border-amber-500/30 bg-amber-50/40 text-left space-y-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-sm">Family Confirmation Check-In</h4>
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                                Hold Active (30m)
                              </span>
                            </div>

                            {/* Warm Senior Message (No alarms) */}
                            <div className="mt-2 p-3.5 rounded-xl bg-white/80 border border-amber-200">
                              <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block mb-0.5">
                                What Thomas sees on his screen:
                              </span>
                              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                                &ldquo;{evalResult.explanation?.seniorMessage ||
                                  "We're checking in with Maya & David to confirm this order. We'll update you in just a moment!"}&rdquo;
                              </p>
                            </div>

                            {/* Triggered Signals */}
                            <div className="mt-3 space-y-1">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                Policy Triggers:
                              </span>
                              {evalResult.signals?.map((s: RiskSignal, idx: number) => (
                                <div key={idx} className="text-xs text-slate-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span>{s.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Caregiver Switch Shortcut */}
                        <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <span className="text-xs text-amber-900 font-medium">
                            Hold placed in database. Funds reserved safely.
                          </span>
                          <button
                            onClick={() => {
                              switchPersona('maya').then(() => setActiveTab('guardian'));
                            }}
                            className="w-full sm:w-auto px-5 py-2 rounded-full bg-slate-950 text-white font-semibold text-xs hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                          >
                            <span>Switch to Maya to Review</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PayPal Order Details if Created */}
                    {paypalOrderResult && (
                      <div className="p-4 rounded-xl bg-white border border-black/10 text-left text-xs space-y-1">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>PayPal Sandbox Order Live</span>
                        </div>
                        <div className="text-slate-600">
                          Order ID: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{paypalOrderResult.orderId}</code>
                        </div>
                        <div className="text-slate-500">
                          Status: <span className="font-semibold text-emerald-700">{paypalOrderResult.status}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guardian' && (
          /* TAB 2: CAREGIVER GUARDIAN HUB */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Caregiver Role Header */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-950 text-lg">Family Guardian Dashboard</h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isSarah
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {isSarah ? 'View-Only Access' : 'Payment Approval Authority'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protecting Mr. Thomas Sterling • Family review threshold: transactions &gt; $100.00
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="liquid-pill px-4 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Ask Caregiver AI</span>
                </button>
                <button
                  onClick={fetchPendingApprovals}
                  className="liquid-pill p-2 text-slate-600 hover:text-slate-900"
                  title="Refresh pending approvals"
                >
                  <RefreshCw className={`w-4 h-4 ${approvalsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {actionFeedback && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-rose-700 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {/* Pending Approvals Feed */}
            {pendingApprovals.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-12 text-center border border-white/80 shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">All Clear — No Holds Awaiting Review</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Thomas&apos;s spending is completely within his baseline. Switch to &quot;Senior View&quot; above to simulate an anomalous purchase!
                </p>
                <button
                  onClick={() => setActiveTab('senior')}
                  className="px-5 py-2 rounded-full bg-slate-950 text-white font-medium text-xs hover:bg-slate-800 transition-all inline-flex items-center gap-1.5 mt-2"
                >
                  <span>Simulate a Purchase</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((item) => {
                  const assessment = item.riskAssessment;
                  const explanation = assessment?.explanation;

                  return (
                    <div
                      key={item.id}
                      className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.06)] space-y-5"
                    >
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-black/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                            ⚠️
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-950 text-base">{item.recipient.merchantName}</h4>
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                                Risk Score: {assessment?.riskScore || 75}/100
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">
                              Category: {item.recipient.category} • Requested by {item.elder.fullName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-950">
                            ${item.amount.toFixed(2)} {item.currency}
                          </div>
                          <span className="text-[11px] text-slate-400">Hold active</span>
                        </div>
                      </div>

                      {/* Gemini AI Briefing Card */}
                      {explanation && (
                        <div className="liquid-glass-subtle rounded-2xl p-5 border border-purple-500/20 bg-purple-50/30 space-y-3.5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-bold text-purple-900 tracking-wide uppercase">
                              Gemini Caregiver Briefing
                            </span>
                          </div>

                          <div className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug">
                            {explanation.headline}
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">
                            {explanation.plainEnglishSummary}
                          </p>

                          {/* Respectful Suggested Question */}
                          {explanation.suggestedQuestions && explanation.suggestedQuestions.length > 0 && (
                            <div className="p-3 rounded-xl bg-white/80 border border-purple-200/60 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-purple-900">
                                <span>Suggested check-in question for Dad:</span>
                                <button
                                  onClick={() => copyToClipboard(explanation.suggestedQuestions[0], 0)}
                                  className="text-[10px] text-purple-700 hover:text-purple-900 flex items-center gap-1"
                                >
                                  {copiedQuestionIndex === 0 ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedQuestionIndex === 0 ? 'Copied' : 'Copy Question'}</span>
                                </button>
                              </div>
                              <p className="text-xs text-slate-800 italic">
                                &ldquo;{explanation.suggestedQuestions[0]}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          {isSarah ? (
                            <span className="text-amber-800 font-medium flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              Sarah has view-only permissions. Maya & David must approve.
                            </span>
                          ) : (
                            <span>Approving captures the order and sends confirmation to Dad.</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                          <button
                            onClick={() => handleCaregiverDecision(item.id, 'DECLINED')}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-black/10 active:scale-[0.98] transition-all"
                          >
                            Decline Hold
                          </button>
                          <button
                            onClick={() => handleCaregiverDecision(item.id, 'APPROVED')}
                            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 ${
                              isSarah
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-950 hover:bg-slate-800 text-white shadow-xs'
                            }`}
                          >
                            {isSarah && <Lock className="w-3.5 h-3.5" />}
                            <span>Approve Payment</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          /* TAB 3: LIVE ACTIVITY & AUDIT LEDGER */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Stat Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Today&apos;s Spending
                </span>
                <div className="text-2xl font-bold text-slate-950 mt-1">
                  ${activityData?.spendingToday?.toFixed(2) || '0.00'}
                </div>
                <span className="text-[11px] text-slate-500">Cap: ${activityData?.dailyCap?.toFixed(2) || '1,000.00'}</span>
              </div>
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Family Threshold
                </span>
                <div className="text-2xl font-bold text-slate-950 mt-1">
                  ${activityData?.familyThreshold?.toFixed(2) || '100.00'}
                </div>
                <span className="text-[11px] text-slate-500">Transactions above trigger hold</span>
              </div>
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Safety Status
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <span>Active</span>
                </div>
                <span className="text-[11px] text-slate-500">Real-time baseline monitoring</span>
              </div>
            </div>

            {/* Live Ledger Table */}
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_48px_-12px_rgba(15,23,42,0.06)] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-950 text-base">Immutable Audit Trail</h3>
                  <button
                    onClick={fetchActivity}
                    className="liquid-pill p-1.5 text-slate-500 hover:text-slate-900"
                    title="Refresh activity feed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <span className="text-xs text-slate-400">Cryptographically verifiable sequence</span>
              </div>

              <div className="divide-y divide-black/5 text-xs">
                {activityData?.auditLogs?.map((log: ActivityAuditLogItem) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{log.eventType}</div>
                      <div className="text-[11px] text-slate-500">Actor: {log.actorName}</div>
                    </div>
                    <div className="text-right">
                      {log.newState && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                          {log.newState}
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FLOATING CAREGIVER AI CHAT DRAWER */}
      <CaregiverAIChatDrawer
        currentUser={user}
        elderName="Mr. Thomas"
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpen={() => setIsChatOpen(true)}
      />

      {/* Floating Chat Bubble Launcher */}
      <button
        onClick={() => {
          switchPersona('maya').then(() => setIsChatOpen(true));
        }}
        className="fixed bottom-6 right-6 z-40 liquid-glass p-3.5 rounded-full shadow-lg border border-white/80 hover:scale-105 active:scale-95 transition-all text-purple-900 flex items-center gap-2 group"
      >
        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-slate-900 pr-1 hidden sm:inline">Ask SafePay AI</span>
      </button>
    </div>
  );
}
