'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Store,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { SessionUser } from '@/types';

interface PresetItem {
  id: string;
  merchantName: string;
  category: string;
  amount: number;
  description: string;
  expectedResult: 'APPROVED' | 'HOLD';
  badgeColor: string;
}

const PRESET_SCENARIOS: PresetItem[] = [
  {
    id: 'pharmacy',
    merchantName: 'Walgreens Pharmacy',
    category: 'Healthcare / Pharmacy',
    amount: 34.20,
    description: 'Monthly prescription refill & multivitamin supplements.',
    expectedResult: 'APPROVED',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'groceries',
    merchantName: 'Corner Market & Produce',
    category: 'Groceries',
    amount: 28.50,
    description: 'Fresh fruits, bread, and daily pantry staples.',
    expectedResult: 'APPROVED',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'duplicate_groceries',
    merchantName: 'Corner Market & Produce',
    category: 'Groceries',
    amount: 28.50,
    description: 'Duplicate charge: Exact same $28.50 at Corner Market (Triggers hold).',
    expectedResult: 'HOLD',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'electronics',
    merchantName: 'TechGadget Online',
    category: 'Electronics',
    amount: 185.00,
    description: 'Noise-cancelling wireless headphones (Exceeds $100 family limit).',
    expectedResult: 'HOLD',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    id: 'tech_support',
    merchantName: 'Suspicious PC Remote Care',
    category: 'Tech Support Services',
    amount: 489.00,
    description: 'Urgent computer virus cleanup invoice from popup ad.',
    expectedResult: 'HOLD',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
];

interface LinkedElderOption {
  id: string;
  fullName: string;
  email: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [linkedElders, setLinkedElders] = useState<LinkedElderOption[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');

  // Selected cart preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>('pharmacy');

  // Evaluation & PayPal states
  const [evaluating, setEvaluating] = useState(false);
  const [evalStep, setEvalStep] = useState<string>('');
  const [evalResult, setEvalResult] = useState<{
    status: 'APPROVED' | 'AWAITING_FAMILY' | 'BLOCKED_BY_POLICY';
    riskScore: number;
    paymentRequestId: string;
    seniorMessage?: string;
    caregiverExplanation?: string;
    ruleDecision?: string;
    paypalUrl?: string | null;
    paypalOrderId?: string | null;
  } | null>(null);

  // Limit Request Modal states
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [limitAmount, setLimitAmount] = useState('100');
  const [limitReason, setLimitReason] = useState('');
  const [submittingLimit, setSubmittingLimit] = useState(false);
  const [limitSuccessMsg, setLimitSuccessMsg] = useState<string | null>(null);

  const handleRequestLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLimit(true);
    try {
      const res = await fetch('/api/family/limit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limitType,
          requestedAmount: Number(limitAmount),
          reason: limitReason,
          elderId: selectedElderId || currentUser?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit limit request');
      setLimitSuccessMsg(`Request for +$${limitAmount} sent to family caregivers!`);
      setTimeout(() => {
        setShowLimitModal(false);
        setLimitSuccessMsg(null);
      }, 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error submitting request');
    } finally {
      setSubmittingLimit(false);
    }
  };

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);

        if (data.user.roleDefault === 'CAREGIVER') {
          // Caregiver has links to elders
          interface RawCaregiverLink {
            elder?: { id: string; fullName: string; email: string };
          }
          const elders: LinkedElderOption[] = (data.caregiverLinks || [])
            .map((l: RawCaregiverLink) => l.elder)
            .filter((e: LinkedElderOption | undefined): e is LinkedElderOption => Boolean(e));
          setLinkedElders(elders);

          const paramElderId = searchParams.get('elderId');
          if (paramElderId && elders.some((e: LinkedElderOption) => e.id === paramElderId)) {
            setSelectedElderId(paramElderId);
          } else if (elders.length > 0) {
            setSelectedElderId(elders[0].id);
          }
        } else {
          // Protected Senior
          setSelectedElderId(data.user.id);
        }
      } else {
        // Fallback demo switch to Thomas if completely unauthenticated
        await fetch('/api/auth/demo-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: 'thomas' }),
        });
        const res2 = await fetch('/api/auth/session');
        const data2 = await res2.json();
        setCurrentUser(data2.user);
        setSelectedElderId(data2.user?.id || '11111111-1111-4111-a111-111111111111');
      }
    } catch (e) {
      console.error('Failed to load session for checkout:', e);
    }
  }, [searchParams]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const currentScenario =
    PRESET_SCENARIOS.find((p) => p.id === selectedPresetId) || PRESET_SCENARIOS[0];

  const effectiveShopperElder =
    currentUser?.roleDefault === 'PROTECTED_USER'
      ? currentUser
      : linkedElders.find((e) => e.id === selectedElderId) || linkedElders[0];

  const handleRunCheckout = async () => {
    setEvaluating(true);
    setEvalResult(null);
    setEvalStep('Checking dual-layer rules against $100 family threshold...');

    const targetElderId =
      currentUser?.roleDefault === 'PROTECTED_USER' ? currentUser.id : selectedElderId;

    try {
      // Step 1: Run Risk Evaluation API with explicit elderId
      const evalRes = await fetch('/api/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderId: targetElderId,
          amount: currentScenario.amount,
          merchantName: currentScenario.merchantName,
          category: currentScenario.category,
        }),
      });

      const evalData = await evalRes.json();

      if (!evalRes.ok) {
        throw new Error(evalData.error || 'Evaluation failed');
      }

      setEvalStep('Gemini AI evaluating anomaly context & explanations...');
      await new Promise((resolve) => setTimeout(resolve, 600));

      // If approved, create the real PayPal Sandbox Order!
      if (evalData.status === 'APPROVED') {
        setEvalStep('Generating secure PayPal Sandbox Order...');
        const paypalRes = await fetch('/api/checkout/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentRequestId: evalData.paymentRequestId,
            returnUrl: window.location.origin + '/dashboard',
            cancelUrl: window.location.origin + '/checkout',
          }),
        });

        const paypalData = await paypalRes.json();

        setEvalResult({
          status: 'APPROVED',
          riskScore: evalData.riskScore || 12,
          paymentRequestId: evalData.paymentRequestId,
          seniorMessage: evalData.explanation?.seniorExplanation || 'Your purchase was approved and is safe to complete.',
          caregiverExplanation: evalData.explanation?.caregiverExplanation,
          paypalUrl: paypalData.approveUrl,
          paypalOrderId: paypalData.orderId,
        });
      } else {
        // Awaiting family hold
        setEvalResult({
          status: evalData.status,
          riskScore: evalData.riskScore || 75,
          paymentRequestId: evalData.paymentRequestId,
          seniorMessage:
            evalData.explanation?.seniorExplanation ||
            "We've paused this charge and notified your family guardian. SafePay keeps your card secure until family confirms.",
          caregiverExplanation: evalData.explanation?.caregiverExplanation,
        });
      }
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Error evaluating checkout');
    } finally {
      setEvaluating(false);
      setEvalStep('');
    }
  };

  return (
    <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 pb-20">
      {/* FLOATING HEADER */}
      <header className="sticky top-4 z-40 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="liquid-glass rounded-2xl px-5 py-3 flex items-center justify-between border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-full hover:bg-white/60 text-slate-600 transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-bold tracking-tight text-sm text-slate-950">SafePay Checkout Sandbox</span>
            </div>
          </div>

          {/* Active Shopper Identity Badge */}
          <div className="flex items-center gap-2">
            {currentUser?.roleDefault === 'CAREGIVER' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Simulating for Elder:</span>
                {linkedElders.length > 1 ? (
                  <select
                    value={selectedElderId}
                    onChange={(e) => setSelectedElderId(e.target.value)}
                    className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 outline-none"
                  >
                    {linkedElders.map((elder) => (
                      <option key={elder.id} value={elder.id}>
                        {elder.fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{effectiveShopperElder?.fullName || 'Linked Elder'}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Active Senior Shopper:</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{currentUser?.fullName || 'Mr. Thomas (Senior)'}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CHECKOUT SIMULATION CONTAINER */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="liquid-pill px-3.5 py-1 text-xs font-semibold text-purple-700 bg-white/70 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-purple-600" /> Live PayPal Sandbox & Risk Simulation
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Simulate Senior Online Shopping
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Pick a realistic scenario below to test how SafePay&apos;s dual-layer engine protects{' '}
            <span className="font-semibold text-slate-900">{effectiveShopperElder?.fullName || 'the senior'}</span> while keeping routine checkouts effortless.
          </p>
        </div>

        {/* PRESET SELECTOR GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => {
                  setSelectedPresetId(preset.id);
                  setEvalResult(null);
                }}
                className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 relative flex flex-col justify-between ${
                  isSelected
                    ? 'liquid-glass border-purple-500/80 shadow-lg ring-2 ring-purple-500/20'
                    : 'liquid-glass-subtle border-white/80 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}
                    >
                      {preset.expectedResult === 'APPROVED' ? 'Routine Auto-Approve' : 'Safety Family Hold'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-950">{preset.merchantName}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{preset.description}</p>
                </div>

                <div className="pt-4 flex items-baseline justify-between border-t border-black/5 mt-4">
                  <span className="text-xs text-slate-500">{preset.category}</span>
                  <span className="text-base font-extrabold text-slate-950">${preset.amount.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* SIMULATED STORE CHECKOUT CARD */}
        <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.1)] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-black/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-slate-900 border border-black/5 flex items-center justify-center shadow-xs">
                <Store className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">{currentScenario.merchantName}</h2>
                <span className="text-xs text-slate-500">Secure Merchant Checkout • {currentScenario.category}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 uppercase font-semibold">Total Amount</span>
              <div className="text-2xl font-black text-slate-950">${currentScenario.amount.toFixed(2)} USD</div>
            </div>
          </div>

          {/* SafePay Safeguard Shield Active Notice */}
          <div className="bg-white/70 rounded-2xl p-4 border border-emerald-200/60 flex items-center gap-3 text-xs text-emerald-950">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="space-y-0.5">
              <span className="font-bold">SafePay Protective Companion is Active</span>
              <p className="text-slate-600">
                Rule Engine checks $100 family limit. Gemini AI verifies recipient reputation and flags anomalies for{' '}
                <span className="font-semibold text-slate-900">{effectiveShopperElder?.fullName || 'this account'}</span>.
              </p>
            </div>
          </div>

          {/* Evaluation Action Button */}
          {!evalResult && (
            <div className="pt-2">
              <button
                onClick={handleRunCheckout}
                disabled={evaluating}
                className="w-full py-4 rounded-full bg-slate-950 text-white font-bold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2"
              >
                {evaluating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    <span>{evalStep || 'Evaluating SafePay Rules...'}</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Complete Order with SafePay Protection</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* EVALUATION RESULTS BANNER */}
          {evalResult && (
            <div className="space-y-6 pt-2 animate-fade-in">
              {evalResult.status === 'APPROVED' ? (
                /* APPROVED RESULT */
                <div className="liquid-glass rounded-2xl p-6 border border-emerald-300 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-emerald-950">Transaction Approved by SafePay Rules</h3>
                        <p className="text-xs text-emerald-800">
                          Routine merchant within safety baseline. Risk score: {evalResult.riskScore}/100.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                      Auto-Cleared
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-white/80 p-3.5 rounded-xl border border-emerald-100 font-medium">
                    {evalResult.seniorMessage}
                  </p>

                  {/* PayPal Sandbox Direct Link */}
                  {evalResult.paypalUrl && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <a
                        href={evalResult.paypalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-full bg-[#0070ba] hover:bg-[#003087] text-white text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                      >
                        <span>Open PayPal Sandbox Checkout</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          setEvalResult(null);
                        }}
                        className="w-full sm:w-auto py-3 px-5 rounded-full text-xs font-semibold text-slate-700 hover:bg-black/5 transition-all"
                      >
                        Try Another Scenario
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* HOLD RESULT */
                <div className="liquid-glass rounded-2xl p-6 border border-amber-300 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-amber-950">SafePay Safety Hold Triggered</h3>
                        <p className="text-xs text-amber-800">
                          Charge exceeds family threshold or has unusual merchant anomaly.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      Risk Score: {evalResult.riskScore}/100
                    </span>
                  </div>

                  {/* Dignified Senior Message */}
                  <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200/80 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      Dignified Senior Reassurance:
                    </span>
                    <p className="text-xs text-amber-950 leading-relaxed font-medium">
                      &ldquo;{evalResult.seniorMessage}&rdquo;
                    </p>
                  </div>

                  {/* Caregiver AI Briefing */}
                  {evalResult.caregiverExplanation && (
                    <div className="bg-white/80 p-4 rounded-xl border border-purple-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Gemini AI Briefing to Caregiver:</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {evalResult.caregiverExplanation}
                      </p>
                    </div>
                  )}

                  {/* Protected Security Gate: Elder cannot approve their own holds */}
                  <div className="pt-2 flex flex-col gap-3">
                    <div className="p-4 rounded-xl bg-purple-50/90 border border-purple-200 text-xs text-purple-950 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <p className="font-bold text-purple-900">Waiting for Family Caregiver Review</p>
                        <p className="text-purple-800/90 leading-relaxed">
                          Your family caregivers have been notified to review this payment. Protected senior accounts cannot approve payments. Please wait while your family confirms, or submit a limit increase request if needed.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowLimitModal(true)}
                        className="w-full sm:w-auto flex-1 py-3 px-5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                        <span>Request Limit Increase from Guardian</span>
                      </button>

                      <Link
                        href={currentUser?.roleDefault === 'PROTECTED_USER' ? '/elder' : '/dashboard'}
                        className="w-full sm:w-auto py-3 px-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold text-center transition-all"
                      >
                        Return to Dashboard
                      </Link>

                      <button
                        type="button"
                        onClick={() => setEvalResult(null)}
                        className="w-full sm:w-auto py-3 px-4 rounded-full text-xs font-semibold text-slate-700 hover:bg-black/5 transition-all"
                      >
                        Reset Cart
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIMIT INCREASE REQUEST MODAL */}
          {showLimitModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                      $
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Request Limit Increase</h3>
                      <p className="text-[11px] text-slate-500">Ask your caregiver for additional spending allowance</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
                  >
                    &times;
                  </button>
                </div>

                {limitSuccessMsg ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <p>{limitSuccessMsg}</p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestLimit} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Limit to Increase</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setLimitType('DAILY')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                            limitType === 'DAILY'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Daily Spending Cap
                        </button>
                        <button
                          type="button"
                          onClick={() => setLimitType('MONTHLY')}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                            limitType === 'MONTHLY'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Monthly Budget
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Requested Additional Amount ($ USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="10"
                          min="10"
                          max="2000"
                          required
                          value={limitAmount}
                          onChange={(e) => setLimitAmount(e.target.value)}
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Reason for Caregiver (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={limitReason}
                        onChange={(e) => setLimitReason(e.target.value)}
                        placeholder="e.g., Grocery shopping, medicine refill, home repair"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowLimitModal(false)}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingLimit}
                        className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {submittingLimit ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Submit Request</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen soft-mesh-bg flex items-center justify-center text-xs font-semibold text-slate-700">
          Loading Checkout Sandbox...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
