'use client';

import React, { useEffect, useState, useRef } from 'react';
import { DemoPersonaBar } from '@/components/shared/DemoPersonaBar';
import { CaregiverAIChatDrawer } from '@/components/caregiver/CaregiverAIChatDrawer';
import { SessionUser } from '@/types';
import {
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Plus,
  Search,
  CheckCircle2,
  Settings,
  ShoppingCart,
  Users,
  MousePointerClick,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  X,
  Volume2,
  Lock,
  Scale,
} from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'senior' | 'guardian'>('senior');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'completed'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showCookies, setShowCookies] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    authorized: boolean;
    status: number;
    message: string;
    reason?: string;
  } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [recentAction, setRecentAction] = useState<string | null>(null);

  // Mascot eye-tracking refs
  const heroMascotRef = useRef<HTMLDivElement>(null);
  const statementMascotRef = useRef<HTMLDivElement>(null);

  // Session fetch
  const refreshSession = async () => {
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
  };

  useEffect(() => {
    refreshSession();
    const timer = setTimeout(() => setShowCookies(true), 1500);
    return () => clearTimeout(timer);
  }, []);

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
        const distance = Math.min(maxDist, Math.hypot(deltaX, deltaY) / 20);

        const moveX = Math.cos(angle) * distance;
        const moveY = Math.sin(angle) * distance;

        const eyes = mascotEl.querySelectorAll<HTMLDivElement>('.mascot-eye');
        eyes.forEach((eye) => {
          eye.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });
      };

      updateMascot(heroMascotRef.current, 5);
      updateMascot(statementMascotRef.current, 10);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handlePayment = () => {
    setPaymentStatus('verifying');
    setTimeout(() => {
      setPaymentStatus('completed');
    }, 1200);
  };

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
  const isSarah = user?.email.includes('sarah');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-900 selection:text-white">
      {/* Top Demo Persona Switcher Bar */}
      <DemoPersonaBar currentUser={user} onPersonaSwitched={() => refreshSession()} />

      {/* FIXED GLASS NAVIGATION */}
      <nav className="fixed top-8 sm:top-9 left-0 right-0 z-40 h-16 glass-nav px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold tracking-tight text-lg text-white">SafePay</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#7e8083]">
          <a href="#interactive-preview" className="hover:text-white transition-colors flex items-center gap-1">
            Product <ChevronDown className="w-3 h-3 text-[10px]" />
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors flex items-center gap-1">
            Safety <ChevronDown className="w-3 h-3 text-[10px]" />
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            Resources
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => switchPersona('maya')}
            className="btn-pill btn-secondary h-9 px-5 text-sm"
          >
            {user ? user.fullName.split(' ')[0] : 'Login'}
          </button>
          <div className="flex">
            <button
              onClick={() => {
                switchPersona('maya').then(() => setIsChatOpen(true));
              }}
              className="btn-pill btn-primary h-9 px-5 text-sm rounded-r-none font-semibold"
            >
              Try AI Assistant
            </button>
            <div className="w-[1px] h-9 bg-black/10" />
            <button
              onClick={() => {
                const el = document.getElementById('interactive-preview');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-pill btn-primary h-9 px-3 text-sm rounded-l-none"
              aria-label="Scroll to preview"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* AUTHENTICATED WORKBENCH OVERLAY (When a demo persona is active) */}
      {user && (
        <section className="pt-28 pb-4 px-6 max-w-7xl mx-auto">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-black font-bold flex items-center justify-center text-sm">
                  {user.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{user.fullName}</span>
                    <span className="text-[10px] bg-white/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                      {isThomas ? 'Protected User' : isSarah ? 'Caregiver (View-Only)' : 'Caregiver (Approver)'}
                    </span>
                  </div>
                  <p className="text-xs text-[#7e8083]">PostgreSQL Session UUID: {user.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestApprovalPermission}
                  disabled={testLoading}
                  className="btn-pill btn-secondary h-8 px-3 text-xs flex items-center gap-1.5"
                >
                  {testLoading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Scale className="w-3 h-3 text-blue-400" />
                  )}
                  <span>Test Server Authorization</span>
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="btn-pill btn-primary h-8 px-3 text-xs flex items-center gap-1.5 font-bold"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>Open Voice Chatbot</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-center justify-between ${
                  testResult.authorized
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.authorized ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-rose-400" />
                  )}
                  <span>
                    HTTP {testResult.status}: {testResult.message}
                  </span>
                </div>
                {testResult.reason && <span className="opacity-75">{testResult.reason}</span>}
              </div>
            )}
          </div>
        </section>
      )}

      {/* HERO SECTION */}
      <section className={`${user ? 'pt-12' : 'pt-36 sm:pt-40'} pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center gap-8`}>
        {/* Announcement Pill */}
        <div
          onClick={() => {
            const el = document.getElementById('interactive-preview');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="btn-pill btn-secondary group px-4 py-1.5 text-xs font-medium text-[#d5dbe6] cursor-pointer"
        >
          ✨ Announcing Guardian Mode 2.0{' '}
          <ArrowRight className="w-3.5 h-3.5 ml-1 inline-block transition-transform group-hover:translate-x-0.5" />
        </div>

        {/* Hero Headline with Interactive Eye-Tracking Mascot */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter leading-[1.05] max-w-4xl perspective-text text-white">
          Payments designed for{' '}
          <span className="inline-flex items-center align-middle mx-2">
            <div
              ref={heroMascotRef}
              id="hero-mascot"
              className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full relative overflow-hidden mascot-container cursor-pointer hover:scale-110 transition-transform active:scale-95 shadow-md"
            >
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 md:gap-2">
                <div className="mascot-eye w-1.5 h-3.5 md:w-2 md:h-4 bg-black rounded-full transition-all duration-100" />
                <div className="mascot-eye w-1.5 h-3.5 md:w-2 md:h-4 bg-black rounded-full transition-all duration-100" />
              </div>
            </div>
          </span>{' '}
          everyone you love.
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-[#7e8083] max-w-2xl leading-relaxed text-pretty">
          An intelligent payment companion that helps elderly family members shop safely online, while giving guardians
          real-time oversight and peace of mind.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => {
              const el = document.getElementById('interactive-preview');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-pill btn-primary h-12 px-8 font-semibold text-base"
          >
            Get Started
          </button>
          <button
            onClick={() => {
              switchPersona('maya').then(() => setIsChatOpen(true));
            }}
            className="btn-pill btn-secondary h-12 px-8 font-medium text-base flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Launch Caregiver AI Voice</span>
          </button>
        </div>
      </section>

      {/* INTERACTIVE SHOWCASE CONTAINER (Senior Experience vs Guardian Panel) */}
      <section id="interactive-preview" className="px-6 pb-28 max-w-7xl mx-auto">
        <div className="w-full bg-[#1a1a1a] rounded-[2rem] border border-white/10 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Window Chrome Header with macOS Traffic Lights */}
          <div className="h-11 px-4 flex items-center justify-between border-b border-white/5 bg-[#202020]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>

            {/* Segmented Controller Tab */}
            <div className="flex items-center gap-4">
              <div className="flex bg-[#0a0a0a] rounded-lg p-1 text-[11px] font-semibold border border-white/5">
                <button
                  onClick={() => setActiveTab('senior')}
                  className={`btn-pill px-4 py-1.5 transition-all ${
                    activeTab === 'senior' ? 'bg-[#2b2b2b] text-white' : 'text-[#7e8083] hover:text-white'
                  }`}
                >
                  Senior Experience
                </button>
                <button
                  onClick={() => setActiveTab('guardian')}
                  className={`btn-pill px-4 py-1.5 transition-all ${
                    activeTab === 'guardian' ? 'bg-[#2b2b2b] text-white' : 'text-[#7e8083] hover:text-white'
                  }`}
                >
                  Guardian Panel
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab(activeTab === 'senior' ? 'guardian' : 'senior');
              }}
              className="btn-pill bg-white/5 w-7 h-7 hover:bg-white/10 flex items-center justify-center"
              title="Toggle View"
            >
              <Plus className="w-3.5 h-3.5 text-white/70" />
            </button>
          </div>

          {/* Window Body */}
          <div className="flex flex-col md:flex-row h-auto md:h-[600px] bg-[#fbfbfb] text-[#0a0a0a]">
            {/* Aside Device List Sidebar */}
            <aside className="w-full md:w-72 border-r border-black/5 bg-[#f5f5f5] flex flex-col shrink-0">
              <div className="p-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                  <input
                    type="text"
                    placeholder="Search safety checks..."
                    className="w-full h-9 pl-9 pr-4 rounded-lg bg-black/5 border border-black/10 text-sm focus:outline-hidden focus:border-black/20 text-slate-900 placeholder:text-black/40"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
                <div
                  onClick={() => setActiveTab('senior')}
                  className={`p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${
                    activeTab === 'senior' ? 'bg-black/10' : 'hover:bg-black/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#885CF5] flex items-center justify-center text-white font-bold shrink-0">
                    M
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-sm font-semibold truncate text-slate-900">Margaret&apos;s iPad</h4>
                      <span className="text-[10px] text-black/40">12:44 PM</span>
                    </div>
                    <p className="text-xs text-black/60 truncate">Active on Amazon.com</p>
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('guardian')}
                  className={`p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${
                    activeTab === 'guardian' ? 'bg-black/10' : 'hover:bg-black/5'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold shrink-0">
                    J
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="text-sm font-semibold truncate text-slate-900">John&apos;s Desktop</h4>
                      <span className="text-[10px] text-black/40">Yesterday</span>
                    </div>
                    <p className="text-xs text-black/60 truncate">3 pending approvals</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Stage Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[#fbfbfb]">
              {activeTab === 'senior' ? (
                /* TAB 1: SENIOR EXPERIENCE */
                <div className="flex-1 flex flex-col justify-between h-full">
                  <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Assistant Message Bubble */}
                    <div className="flex items-start gap-4">
                      <div
                        id="chat-mascot"
                        className={`w-10 h-10 rounded-full relative shrink-0 transition-all duration-500 shadow-xs flex items-center justify-center ${
                          paymentStatus === 'completed' ? 'bg-emerald-600 scale-110' : 'bg-[#0a0a0a]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-1 h-2 bg-white rounded-full" />
                          <div className="w-1 h-2 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="bg-white border border-black/10 rounded-2xl p-4 shadow-xs max-w-md">
                        <p className="text-sm text-slate-800 leading-relaxed">
                          Hi Margaret! I noticed you&apos;re looking at a new gardening kit on Amazon. It&apos;s listed
                          for $45.99. Would you like me to help you pay for this safely?
                        </p>
                      </div>
                    </div>

                    {/* Verified Secure Connection Box */}
                    <div className="ml-0 md:ml-14 bg-white border-2 border-dashed border-black/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 shadow-2xs">
                      <div className="w-16 h-16 bg-[#1f8a65]/10 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-9 h-9 text-[#1f8a65]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black/40">Verified Secure Connection</p>
                        <h3 className="text-3xl font-bold text-slate-900">$45.99</h3>
                      </div>

                      {paymentStatus === 'idle' && (
                        <button
                          onClick={handlePayment}
                          className="btn-pill btn-primary w-full max-w-xs h-12 font-bold text-base shadow-sm hover:scale-[1.02]"
                        >
                          Confirm Payment
                        </button>
                      )}

                      {paymentStatus === 'verifying' && (
                        <button
                          disabled
                          className="btn-pill btn-primary w-full max-w-xs h-12 font-bold text-base opacity-75 cursor-wait flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          <span>Verifying with PayPal...</span>
                        </button>
                      )}

                      {paymentStatus === 'completed' && (
                        <div className="flex items-center gap-2 py-2 animate-fadeIn">
                          <span className="bg-[#1f8a65] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" /> DONE
                          </span>
                          <p className="text-xs font-medium text-[#1f8a65]">
                            Payment sent & verified by your son David.
                          </p>
                        </div>
                      )}

                      <p className="text-[10px] uppercase tracking-widest text-black/30 font-bold">
                        Secured by Guardian Oversight
                      </p>
                    </div>
                  </div>

                  {/* Contextual Bottom Search Bar */}
                  <div className="p-4 border-t border-black/5 bg-white">
                    <div className="flex items-center gap-3 bg-[#f5f5f5] rounded-full px-5 py-3 border border-black/5">
                      <span className="text-sm text-black/40">Ask me anything about this payment...</span>
                      <div className="ml-auto flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full orange-pulse" />
                        <div
                          className="w-1.5 h-1.5 bg-orange-500 rounded-full orange-pulse"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <div
                          className="w-1.5 h-1.5 bg-orange-500 rounded-full orange-pulse"
                          style={{ animationDelay: '0.4s' }}
                        />
                        <span className="text-[10px] font-bold text-orange-500 ml-2">RECEIVING CONTEXT</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: GUARDIAN PANEL */
                <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Oversight Dashboard</h2>
                      <p className="text-sm text-black/50">Monitoring Margaret&apos;s activity</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="h-6 px-3 bg-green-100 text-green-700 rounded-full text-[11px] font-bold flex items-center">
                        LIVE
                      </span>
                      <button
                        onClick={() => setIsChatOpen(true)}
                        className="btn-pill bg-black/5 w-8 h-8 hover:bg-black/10 flex items-center justify-center"
                        title="Caregiver AI Settings"
                      >
                        <Settings className="w-4 h-4 text-black/70" />
                      </button>
                    </div>
                  </div>

                  {/* Stat Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-black/5 rounded-2xl shadow-xs">
                      <p className="text-xs font-bold text-black/30 uppercase tracking-wider mb-2">Today&apos;s Spend</p>
                      <p className="text-2xl font-bold text-slate-900">$112.40</p>
                      <div className="mt-4 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#885CF5] w-2/3" />
                      </div>
                    </div>
                    <div className="p-4 bg-white border border-black/5 rounded-2xl shadow-xs">
                      <p className="text-xs font-bold text-black/30 uppercase tracking-wider mb-2">Protection Cap</p>
                      <p className="text-2xl font-bold text-slate-900">$2,500.00</p>
                      <p className="text-xs text-emerald-600 font-semibold mt-2">Zero anomalous spikes detected</p>
                    </div>
                  </div>

                  {/* Verification Requests Card */}
                  <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-900">Recent Verification Requests</h3>
                      <button
                        onClick={() => setIsChatOpen(true)}
                        className="text-[11px] text-[#0a84ff] font-semibold px-2 py-1 hover:bg-blue-50 rounded"
                      >
                        Ask AI Assistant
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#fbfbfb] border border-black/5 rounded-xl gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                            <ShoppingCart className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Amazon.com</p>
                            <p className="text-[10px] text-black/40">Gardening Kit • $45.99</p>
                          </div>
                        </div>

                        {recentAction ? (
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                            {recentAction}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRecentAction('Approved by You')}
                              className="btn-pill btn-primary h-8 px-4 text-xs font-semibold"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRecentAction('Flagged for Review')}
                              className="btn-pill btn-destructive h-8 px-4 text-xs font-semibold"
                            >
                              Flag
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </section>

      {/* STATEMENT SECTION WITH GIANT INTERACTIVE MASCOT */}
      <section className="px-6 py-16 max-w-7xl mx-auto">
        <div className="relative bg-[#1a1a1a] min-h-[22rem] rounded-3xl p-8 sm:p-14 overflow-hidden flex flex-col justify-center border border-white/5">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight max-w-2xl text-white">
            SafePay acts as an <span className="text-[#7e8083]">invisible safety net</span> that grows more intuitive
            with every interaction.
          </h2>

          {/* Giant Cursor-Tracking Statement Mascot */}
          <div
            ref={statementMascotRef}
            id="statement-mascot"
            className="absolute -bottom-10 -right-10 w-44 h-44 sm:w-48 sm:h-48 bg-white rounded-full shadow-[0_32px_64px_rgba(0,0,0,0.5)] cursor-pointer mascot-container active:scale-95 transition-transform"
          >
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex items-center gap-3.5 sm:gap-4">
              <div className="mascot-eye w-2.5 h-6 sm:w-3 sm:h-7 bg-black rounded-full" />
              <div className="mascot-eye w-2.5 h-6 sm:w-3 sm:h-7 bg-black rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 FEATURE CARDS GRID */}
      <section id="how-it-works" className="px-6 py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1: Multi-Guardian Oversight */}
          <div className="bg-[#1a1a1a] border border-white/5 p-8 rounded-3xl group hover:border-white/10 transition-all flex flex-col justify-between">
            <div>
              <div className="flex -space-x-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-orange-400 border-2 border-[#1a1a1a] flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  M
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-400 border-2 border-[#1a1a1a] flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  D
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Multi-Guardian Oversight</h3>
              <p className="text-[#7e8083] text-sm leading-relaxed mb-6">
                Connect siblings or caregivers to a shared dashboard. Everyone stays informed, no one gets overwhelmed.
              </p>
            </div>
            <button
              onClick={() => switchPersona('maya')}
              className="btn-pill btn-secondary w-full py-3 text-sm font-semibold text-white flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>Add Guardian</span>
            </button>
          </div>

          {/* Card 2: Smart Handover */}
          <div className="bg-[#1a1a1a] border border-white/5 p-8 rounded-3xl group hover:border-white/10 transition-all flex flex-col justify-between">
            <div>
              <div className="mb-6 h-10 flex items-center">
                <div className="btn-pill btn-secondary px-3 py-1 text-xs font-medium text-[#d5dbe6] flex items-center gap-2">
                  <MousePointerClick className="w-3.5 h-3.5 text-blue-400" />
                  <span>Handover active</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Smart Handover</h3>
              <p className="text-[#7e8083] text-sm leading-relaxed mb-6">
                When SafePay detects complex checkout flows, it smoothly hands over to a guardian with a 0.52s crossfade.
              </p>
            </div>
            <div className="relative h-20 bg-black/20 rounded-2xl flex items-center justify-center border border-white/5">
              <div className="flex items-center gap-4 transition-all duration-500">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <ShoppingBag className="w-5 h-5 text-white/40" />
                </div>
                <ArrowRight className="w-4 h-4 text-white/30" />
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Caregiver Voice AI Assistant */}
          <div className="bg-[#1a1a1a] border border-white/5 p-8 rounded-3xl group hover:border-white/10 transition-all flex flex-col justify-between">
            <div>
              <div className="mb-6 h-10 flex items-center">
                <div className="btn-pill btn-secondary px-3 py-1 text-xs font-medium text-emerald-400 flex items-center gap-2 border-emerald-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voice AI Active</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Voice & Chat Companion</h3>
              <p className="text-[#7e8083] text-sm leading-relaxed mb-6">
                Maya & David can speak directly with the AI assistant to query transaction risks and draft respectful
                messages to Dad.
              </p>
            </div>
            <button
              onClick={() => {
                switchPersona('maya').then(() => setIsChatOpen(true));
              }}
              className="btn-pill btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              <span>Talk with SafePay AI</span>
            </button>
          </div>
        </div>
      </section>

      {/* COMMON QUESTIONS ACCORDION */}
      <section id="faq" className="px-6 py-24 max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 tracking-tight text-white">Common Questions</h2>

        <div className="space-y-4">
          {[
            {
              q: 'How does the companion stay with me?',
              a: 'SafePay lives as a browser extension and a mobile app. It recognizes when you reach a payment screen and automatically pops up to assist without disrupting everyday habits.',
            },
            {
              q: 'Can guardians see all of my purchases?',
              a: 'No. Everyday purchases under your established daily threshold (such as groceries or routine prescriptions) clear automatically. Guardians are only notified when unusual or high-risk charges are detected.',
            },
            {
              q: 'How does the AI explain flagged charges?',
              a: 'Google Gemini analyzes merchant domain age, subscription terms, and historical patterns, translating cryptic billing codes into simple, humane explanations for family members.',
            },
            {
              q: 'What happens if a charge is flagged as a scam?',
              a: 'A spending reservation is held in PostgreSQL without moving money. Guardians receive a notification with 1-click Approve or Hold options, plus an AI-drafted text to check in gently with the parent.',
            },
          ].map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/2 transition-colors"
                >
                  <span className="font-semibold text-sm sm:text-base text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#7e8083] transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-[#7e8083] text-sm leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER WITH GIANT CIRCULAR STROKE */}
      <footer className="relative px-6 pt-32 pb-16 overflow-hidden border-t border-white/5">
        {/* Faded Circular Watermark */}
        <div className="absolute bottom-[-15%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.15] mask-fade">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="50" cy="50" r="48" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-black" />
                </div>
                <span className="font-bold tracking-tight text-xl text-white">SafePay</span>
              </div>
              <p className="text-xs text-[#7e8083] max-w-xs leading-relaxed">
                Rules decide. AI explains. People remain in control. Built for the PayPal AI Hackathon.
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</div>
              <ul className="space-y-2.5 text-xs text-[#7e8083]">
                <li>Senior Experience</li>
                <li>Guardian Panel</li>
                <li>PayPal REST v2</li>
                <li>Gemini Context Engine</li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Architecture</div>
              <ul className="space-y-2.5 text-xs text-[#7e8083]">
                <li>PostgreSQL 16</li>
                <li>Next.js 15 App Router</li>
                <li>Prisma ORM</li>
                <li>Vitest Suite (19/19)</li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Personas</div>
              <ul className="space-y-2.5 text-xs text-[#7e8083]">
                <li onClick={() => switchPersona('thomas')} className="cursor-pointer hover:text-white">
                  Mr. Thomas (Elder)
                </li>
                <li onClick={() => switchPersona('maya')} className="cursor-pointer hover:text-white">
                  Maya (Approver)
                </li>
                <li onClick={() => switchPersona('david')} className="cursor-pointer hover:text-white">
                  David (Approver)
                </li>
                <li onClick={() => switchPersona('sarah')} className="cursor-pointer hover:text-white">
                  Sarah (View-Only)
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#7e8083]">
            <p>© 2026 SafePay Technologies Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Security Whitepaper</span>
            </div>
          </div>
        </div>
      </footer>

      {/* FLOATING COOKIE PREFERENCES BANNER */}
      {showCookies && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1b1b1b] p-6 rounded-3xl w-[360px] border border-white/10 shadow-2xl transition-all duration-500 animate-fadeIn">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-bold text-sm text-white">Cookie Preferences</h4>
            <button
              onClick={() => setShowCookies(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[#7e8083] mb-5 leading-relaxed">
            We use essential cookies to maintain secure sessions and prevent unauthorized transactions.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setShowCookies(false)}
              className="btn-pill btn-primary h-10 text-xs font-bold"
            >
              Accept All Cookies
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowCookies(false)}
                className="btn-pill btn-secondary h-9 text-xs"
              >
                Reject Non-Essential
              </button>
              <button
                onClick={() => setShowCookies(false)}
                className="btn-pill btn-secondary h-9 text-xs"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAREGIVER VOICE & CHAT AI DRAWER */}
      <CaregiverAIChatDrawer
        currentUser={user}
        elderName={isThomas ? 'Your Account' : 'Margaret (Mr. Thomas)'}
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
