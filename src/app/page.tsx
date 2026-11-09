'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { SessionUser } from '@/types';
import {
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Search,
  CheckCircle2,
  Settings,
  ShoppingCart,
  Users,
  MousePointerClick,
  ShoppingBag,
  Sparkles,
  RefreshCw,
  Sun,
  Moon,
  Mic,
  Send,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function HomePage() {
  const [, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<'senior' | 'guardian'>('senior');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'completed'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [recentAction, setRecentAction] = useState<string | null>(null);

  // Preview interactive state
  const [previewDark, setPreviewDark] = useState(false);
  const [isDeviceSidebarCollapsed, setIsDeviceSidebarCollapsed] = useState(false);
  const [previewChatInput, setPreviewChatInput] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);

  // Mascot eye-tracking refs
  const heroMascotRef = useRef<HTMLDivElement>(null);
  const statementMascotRef = useRef<HTMLDivElement>(null);

  // Refresh authenticated session
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

  const handlePayment = () => {
    setPaymentStatus('verifying');
    setTimeout(() => {
      setPaymentStatus('completed');
    }, 1200);
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

  return (
    <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 relative">
      {/* Minimal Floating Navigation */}
      <nav className="fixed top-5 left-1/2 -translate-x-1/2 z-50 liquid-glass rounded-full px-5 py-2 flex items-center justify-between gap-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 transition-all duration-200">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="font-bold tracking-tight text-sm text-slate-900">SafePay</span>
        </Link>

        {/* Single Clean Action */}
        <Link
          href="/dashboard"
          className="px-4 py-1.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xs"
        >
          Open App
        </Link>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 sm:pt-40 pb-16 px-6 max-w-5xl mx-auto flex flex-col items-center text-center gap-6">
        {/* Apple-styled Announcement Pill */}
        <div
          onClick={() => {
            const el = document.getElementById('preview');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="liquid-pill px-4 py-1.5 text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1.5 shadow-2xs group"
        >
          <span className="text-purple-600 font-semibold">✨ Family Safety Net</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600">PayPal Companion Active</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Hero Title with Liquid Eye-Tracking Mascot */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-950 leading-[1.08] max-w-4xl">
          Payments designed for{' '}
          <span className="inline-flex items-center align-middle mx-1 sm:mx-2">
            <div
              ref={heroMascotRef}
              id="hero-mascot"
              className="w-12 h-12 md:w-16 md:h-16 rounded-full relative overflow-hidden mascot-container cursor-pointer hover:scale-105 transition-transform active:scale-95 shadow-md bg-white border border-white/80"
              style={{
                boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12), inset 0 2px 4px rgba(255,255,255,0.9)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 md:gap-2">
                <div className="mascot-eye w-1.5 h-3.5 md:w-2 md:h-4 bg-slate-950 rounded-full transition-all duration-100" />
                <div className="mascot-eye w-1.5 h-3.5 md:w-2 md:h-4 bg-slate-950 rounded-full transition-all duration-100" />
              </div>
            </div>
          </span>{' '}
          everyone you love.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed text-pretty">
          An intelligent payment companion that helps elderly family members shop safely online, while giving family members
          real-time oversight and peace of mind.
        </p>

        {/* Action Buttons with Apple Liquid Glass feel */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <Link
            href="/auth/signup"
            className="px-6 py-3 rounded-full bg-slate-950 text-white font-medium text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md shadow-slate-950/10 flex items-center gap-2"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </Link>
          <Link
            href="/dashboard"
            className="liquid-glass px-6 py-3 rounded-full text-slate-900 font-medium text-sm hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Launch Live Dashboard</span>
          </Link>
        </div>
      </section>

      {/* INTERACTIVE MOCKUP (Senior Experience & Guardian Panel Toggle) */}
      <section id="preview" className="px-4 sm:px-6 pb-24 max-w-6xl mx-auto">
        <div
          className={`w-full rounded-3xl sm:rounded-[2.25rem] overflow-hidden border transition-all duration-300 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)] ${
            previewDark
              ? 'bg-slate-900/90 border-slate-800 text-white shadow-2xl'
              : 'liquid-glass border-white/80 text-slate-900'
          }`}
        >
          {/* Header Bar (No 3 dots, No macOS Sequoia, Dark/Light Mode Toggle) */}
          <div
            className={`h-12 px-5 flex items-center justify-between border-b transition-colors duration-200 ${
              previewDark
                ? 'bg-slate-900/90 border-white/10 text-white'
                : 'bg-white/40 border-black/5 text-slate-900'
            } backdrop-blur-md`}
          >
            {/* Apple Liquid Glass Segmented Switcher (Preserved in Homepage Preview) */}
            <div className="flex items-center gap-3">
              <div
                className={`flex p-1 rounded-full border text-xs font-semibold ${
                  previewDark ? 'bg-white/10 border-white/10' : 'bg-black/[0.04] border-black/5'
                }`}
              >
                <button
                  onClick={() => setActiveTab('senior')}
                  className={`px-4 py-1 rounded-full transition-all duration-200 ${
                    activeTab === 'senior'
                      ? previewDark
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-950 shadow-xs'
                      : previewDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Senior Experience
                </button>
                <button
                  onClick={() => setActiveTab('guardian')}
                  className={`px-4 py-1 rounded-full transition-all duration-200 ${
                    activeTab === 'guardian'
                      ? previewDark
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-950 shadow-xs'
                      : previewDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  Family View
                </button>
              </div>
            </div>

            {/* Dark / Light Mode Toggle Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewDark((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  previewDark
                    ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
                title={previewDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {previewDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px]">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[11px]">Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Body Container */}
          <div
            className={`flex flex-col md:flex-row h-auto md:h-[580px] transition-colors duration-200 ${
              previewDark ? 'bg-slate-950 text-slate-100' : 'bg-white/70 text-slate-900'
            }`}
          >
            {/* Left Device Selection Aside (Collapsible) */}
            <aside
              className={`border-r transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shrink-0 ${
                previewDark ? 'bg-slate-900/60 border-white/10' : 'bg-slate-50/60 border-black/5'
              } ${isDeviceSidebarCollapsed ? 'w-16 p-2 items-center' : 'w-full md:w-72 p-4'}`}
            >
              <div className="flex items-center justify-between mb-3 w-full">
                {!isDeviceSidebarCollapsed && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      previewDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Family Devices
                  </span>
                )}
                <button
                  onClick={() => setIsDeviceSidebarCollapsed((prev) => !prev)}
                  className={`p-1.5 rounded-xl transition-colors ${
                    previewDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-slate-500'
                  }`}
                  title={isDeviceSidebarCollapsed ? 'Expand Devices' : 'Collapse Devices'}
                >
                  {isDeviceSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>

              {!isDeviceSidebarCollapsed && (
                <div className="relative mb-3 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search family devices..."
                    className={`w-full h-9 pl-9 pr-4 rounded-xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 ${
                      previewDark
                        ? 'bg-slate-800 border-white/10 text-white placeholder:text-slate-500'
                        : 'bg-white border-black/5 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              )}

              <div className="space-y-1.5 flex-1 overflow-y-auto w-full">
                <div
                  onClick={() => setActiveTab('senior')}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeTab === 'senior'
                      ? previewDark
                        ? 'bg-slate-800 shadow-xs border border-white/10'
                        : 'bg-white shadow-xs border border-black/5'
                      : previewDark
                      ? 'hover:bg-white/5'
                      : 'hover:bg-black/[0.03]'
                  }`}
                  title="Mr. Thomas's iPad"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                    T
                  </div>
                  {!isDeviceSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className={`text-xs font-bold truncate ${previewDark ? 'text-white' : 'text-slate-900'}`}>
                          Mr. Thomas&apos;s iPad
                        </h4>
                        <span className="text-[10px] text-slate-400">12:44 PM</span>
                      </div>
                      <p className="text-[11px] text-emerald-500 font-medium truncate flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Active on Amazon.com
                      </p>
                    </div>
                  )}
                </div>

                <div
                  onClick={() => setActiveTab('guardian')}
                  className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    activeTab === 'guardian'
                      ? previewDark
                        ? 'bg-slate-800 shadow-xs border border-white/10'
                        : 'bg-white shadow-xs border border-black/5'
                      : previewDark
                      ? 'hover:bg-white/5'
                      : 'hover:bg-black/[0.03]'
                  }`}
                  title="Maya's MacBook"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
                    M
                  </div>
                  {!isDeviceSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className={`text-xs font-bold truncate ${previewDark ? 'text-white' : 'text-slate-900'}`}>
                          Maya&apos;s MacBook
                        </h4>
                        <span className="text-[10px] text-slate-400">Yesterday</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">1 pending review request</p>
                    </div>
                  )}
                </div>
              </div>

              {!isDeviceSidebarCollapsed && (
                <div
                  className={`pt-3 border-t flex items-center justify-between text-[11px] ${
                    previewDark ? 'border-white/10 text-slate-400' : 'border-black/5 text-slate-400'
                  }`}
                >
                  <span>SafePay Network</span>
                  <span className="text-emerald-500 font-semibold">Protected</span>
                </div>
              )}
            </aside>

            {/* Main Stage Display */}
            <main
              className={`flex-1 flex flex-col justify-between overflow-hidden transition-colors ${
                previewDark ? 'bg-slate-950/80 text-white' : 'bg-white/40 text-slate-900'
              }`}
            >
              {activeTab === 'senior' ? (
                /* SCREEN 1: SENIOR EXPERIENCE */
                <div className="flex-1 flex flex-col justify-between h-full">
                  <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
                    {/* Assistant Message Bubble with smooth fluid transition */}
                    <div className="flex items-start gap-3.5 max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
                      <div
                        id="chat-mascot"
                        className={`w-9 h-9 rounded-full relative shrink-0 transition-all duration-300 flex items-center justify-center shadow-xs ${
                          paymentStatus === 'completed'
                            ? 'bg-emerald-600 scale-105'
                            : previewDark
                            ? 'bg-purple-600'
                            : 'bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-1 h-2 bg-white rounded-full" />
                          <div className="w-1 h-2 bg-white rounded-full" />
                        </div>
                      </div>
                      <div
                        className={`border rounded-2xl p-4 shadow-xs transition-colors ${
                          previewDark
                            ? 'bg-slate-900 border-white/10 text-slate-200'
                            : 'bg-white border-black/5 text-slate-800'
                        }`}
                      >
                        <p className="text-xs sm:text-sm leading-relaxed">
                          Hi Thomas! I noticed you&apos;re looking at a gardening tool set on Amazon. It&apos;s listed
                          for $45.99. Would you like me to help you pay for this safely?
                        </p>
                      </div>
                    </div>

                    {/* Verified Connection Box with Apple Liquid Card */}
                    <div
                      className={`ml-0 md:ml-12 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3.5 border shadow-sm max-w-md transition-colors ${
                        previewDark
                          ? 'bg-slate-900/90 border-white/10 text-white'
                          : 'liquid-glass border-white/90 text-slate-900'
                      }`}
                    >
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-wider ${
                            previewDark ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          Verified Secure Connection
                        </p>
                        <h3
                          className={`text-3xl font-extrabold mt-1 ${
                            previewDark ? 'text-white' : 'text-slate-950'
                          }`}
                        >
                          $45.99
                        </h3>
                      </div>

                      {paymentStatus === 'idle' && (
                        <button
                          onClick={handlePayment}
                          className={`w-full max-w-xs py-3 rounded-full font-semibold text-sm shadow-sm active:scale-[0.98] transition-all ${
                            previewDark
                              ? 'bg-white text-slate-950 hover:bg-slate-100'
                              : 'bg-slate-950 text-white hover:bg-slate-800'
                          }`}
                        >
                          Confirm Payment
                        </button>
                      )}

                      {paymentStatus === 'verifying' && (
                        <button
                          disabled
                          className="w-full max-w-xs py-3 rounded-full bg-slate-950 text-white font-semibold text-sm opacity-80 cursor-wait flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>Verifying with PayPal...</span>
                        </button>
                      )}

                      {paymentStatus === 'completed' && (
                        <div className="flex items-center gap-2 py-1 animate-fadeIn">
                          <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs">
                            <span className="w-1.5 h-1.5 bg-white rounded-full" /> DONE
                          </span>
                          <p className="text-xs font-semibold text-emerald-500">
                            Payment sent &amp; verified by your daughter Maya.
                          </p>
                        </div>
                      )}

                      <p
                        className={`text-[10px] uppercase tracking-widest font-bold ${
                          previewDark ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Secured by Family Member Oversight
                      </p>
                    </div>
                  </div>

                  {/* Input Bar at Bottom (Only Send and Voice buttons, No receiving context) */}
                  <div
                    className={`p-4 border-t backdrop-blur-md transition-colors ${
                      previewDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/70 border-black/5'
                    }`}
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPreviewChatInput('');
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={previewChatInput}
                        onChange={(e) => setPreviewChatInput(e.target.value)}
                        placeholder="Ask me anything about this payment..."
                        className={`flex-1 px-4 py-2.5 rounded-full border text-xs outline-none transition-all ${
                          previewDark
                            ? 'bg-slate-800 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500'
                            : 'bg-slate-50 border-black/5 text-slate-900 placeholder:text-slate-500 focus:border-purple-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setVoiceActive((prev) => !prev)}
                        className={`p-2.5 rounded-full border transition-all ${
                          voiceActive
                            ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                            : previewDark
                            ? 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={voiceActive ? 'Listening Active' : 'Start Voice Input'}
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                      <button
                        type="submit"
                        className="p-2.5 rounded-full bg-slate-950 text-white hover:bg-slate-800 transition-all shadow-xs shrink-0 active:scale-95"
                        title="Send Message"
                      >
                        <Send className="w-4 h-4 text-purple-400" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* SCREEN 2: FAMILY VIEW */
                <div className="flex-1 flex flex-col p-6 sm:p-8 space-y-6 overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2
                        className={`text-lg font-bold ${
                          previewDark ? 'text-white' : 'text-slate-950'
                        }`}
                      >
                        Oversight Dashboard
                      </h2>
                      <p className={`text-xs ${previewDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Monitoring Mr. Thomas&apos;s activity
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-6 px-3 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                      </span>
                      <Link
                        href="/dashboard"
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          previewDark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'
                        }`}
                        title="Family Protection Settings"
                      >
                        <Settings className={`w-4 h-4 ${previewDark ? 'text-slate-300' : 'text-slate-600'}`} />
                      </Link>
                    </div>
                  </div>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      className={`p-5 rounded-2xl border transition-colors ${
                        previewDark
                          ? 'bg-slate-900 border-white/10 text-white'
                          : 'liquid-glass border-white/80'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Today&apos;s Spend
                      </p>
                      <p
                        className={`text-2xl font-extrabold ${
                          previewDark ? 'text-white' : 'text-slate-950'
                        }`}
                      >
                        $112.40
                      </p>
                      <div className="mt-3.5 h-1.5 w-full bg-slate-200/40 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600 w-2/3 rounded-full" />
                      </div>
                    </div>
                    <div
                      className={`p-5 rounded-2xl border transition-colors ${
                        previewDark
                          ? 'bg-slate-900 border-white/10 text-white'
                          : 'liquid-glass border-white/80'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Protection Cap
                      </p>
                      <p
                        className={`text-2xl font-extrabold ${
                          previewDark ? 'text-white' : 'text-slate-950'
                        }`}
                      >
                        $2,500.00
                      </p>
                      <p className="text-xs text-emerald-500 font-semibold mt-2">Zero anomalous spikes detected</p>
                    </div>
                  </div>

                  {/* Recent Verification Request */}
                  <div
                    className={`rounded-2xl p-5 border space-y-3 transition-colors ${
                      previewDark
                        ? 'bg-slate-900 border-white/10 text-white'
                        : 'liquid-glass border-white/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-xs font-bold uppercase tracking-wider ${
                          previewDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Recent Verification Request
                      </h3>
                      <Link
                        href="/dashboard"
                        className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                      >
                        View in Dashboard &rarr;
                      </Link>
                    </div>

                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-3 ${
                        previewDark
                          ? 'bg-slate-800/80 border-white/10'
                          : 'bg-white/60 border-black/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                          <ShoppingCart className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${previewDark ? 'text-white' : 'text-slate-900'}`}>
                            Amazon.com
                          </p>
                          <p className={`text-[11px] ${previewDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Gardening Kit • $45.99
                          </p>
                        </div>
                      </div>

                      {recentAction ? (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                          {recentAction}
                        </span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRecentAction('Approved by Maya')}
                            className="px-4 py-1.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 active:scale-95 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRecentAction('Flagged for Review')}
                            className="px-4 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 active:scale-95 transition-all"
                          >
                            Flag
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </section>

      {/* STATEMENT SECTION WITH GIANT INTERACTIVE MASCOT (Liquid Glass Banner) */}
      <section className="px-6 py-12 max-w-6xl mx-auto">
        <div className="relative liquid-glass rounded-3xl p-8 sm:p-14 overflow-hidden flex flex-col justify-center border border-white/80 shadow-md">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-semibold leading-tight max-w-2xl text-slate-950 tracking-tight">
            SafePay acts as an <span className="text-slate-500">invisible safety net</span> that grows more intuitive
            with every interaction.
          </h2>

          {/* Giant Cursor-Tracking Statement Mascot */}
          <div
            ref={statementMascotRef}
            id="statement-mascot"
            className="absolute -bottom-8 -right-8 w-40 h-40 sm:w-48 sm:h-48 bg-white rounded-full shadow-[0_24px_48px_rgba(0,0,0,0.12)] cursor-pointer mascot-container active:scale-95 transition-transform border border-white/80"
          >
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex items-center gap-3.5 sm:gap-4">
              <div className="mascot-eye w-2.5 h-6 sm:w-3 sm:h-7 bg-slate-950 rounded-full" />
              <div className="mascot-eye w-2.5 h-6 sm:w-3 sm:h-7 bg-slate-950 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 LIQUID GLASS FEATURE CARDS */}
      <section id="how-it-works" className="px-6 py-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Multi-Guardian Oversight */}
          <div className="liquid-glass p-8 rounded-3xl border border-white/80 shadow-sm flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div>
              <div className="flex -space-x-2.5 mb-6">
                <div className="w-10 h-10 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  M
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  D
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">Family Safety Network</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                Connect family members to look after loved ones. Maya stays informed without hovering over normal spending.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="liquid-pill w-full py-2.5 text-xs font-semibold text-slate-900 flex items-center justify-center gap-2"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Family Dashboard</span>
            </Link>
          </div>

          {/* Card 2: Smart Handover */}
          <div className="liquid-glass p-8 rounded-3xl border border-white/80 shadow-sm flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div>
              <div className="mb-6 h-10 flex items-center">
                <span className="liquid-pill px-3 py-1 text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <MousePointerClick className="w-3.5 h-3.5 text-purple-600" />
                  <span>Handover active</span>
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">Smart Handover</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                When SafePay detects unusual checkout flows, it smoothly holds the payment for family review.
              </p>
            </div>
            <div className="relative h-16 bg-black/[0.03] rounded-2xl flex items-center justify-center border border-black/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-2xs">
                  <ShoppingBag className="w-4 h-4 text-slate-600" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Caregiver Voice AI Assistant */}
          <div className="liquid-glass p-8 rounded-3xl border border-white/80 shadow-sm flex flex-col justify-between hover:translate-y-[-2px] transition-all">
            <div>
              <div className="mb-6 h-10 flex items-center">
                <span className="liquid-pill px-3 py-1 text-xs font-medium text-emerald-800 bg-emerald-50/80 flex items-center gap-1.5 border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI Assistant Grounded</span>
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">Caregiver AI Assistant</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                Maya can consult the account-grounded AI assistant on the dashboard to review transaction risks, spending patterns, and draft respectful check-in messages.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Open Dashboard Assistant &rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ SECTION (Clean Liquid Accordions) */}
      <section id="faq" className="px-6 py-20 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 tracking-tight text-slate-950">
          Common Questions
        </h2>

        <div className="space-y-3.5">
          {[
            {
              q: 'How does the companion protect payments?',
              a: 'The elder pays through the app using PayPal. Before any money leaves, the system checks the payment against spending baselines. Normal payments go through quietly, while risky ones are held until a family member approves.',
            },
            {
              q: 'Can family members see all of my purchases?',
              a: 'Every payment made through SafePay is recorded so both Mr. Thomas and Maya share a transparent, clear record. Mr. Thomas always sees that Maya can see his payments.',
            },
            {
              q: 'How does the AI explain payments?',
              a: 'Google Gemini generates short, plain-language explanations saved at the moment of payment, helping family members understand unfamiliar charges without cryptic billing codes.',
            },
            {
              q: 'What happens if a payment is held?',
              a: 'No money leaves Mr. Thomas account. The payment is held safely until Maya taps approve or Mr. Thomas cancels.',
            },
          ].map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="liquid-glass rounded-2xl overflow-hidden transition-all border border-white/80"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/40 transition-colors"
                >
                  <span className="font-semibold text-sm text-slate-900">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-black/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* MINIMAL FOOTER */}
      <footer className="px-6 pt-16 pb-12 border-t border-black/5 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-950 text-white flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="font-bold text-slate-900 text-sm">SafePay</span>
            <span className="text-slate-400 text-xs ml-2">© 2026 SafePay Technologies Inc.</span>
          </div>

          <div className="flex items-center gap-5 text-slate-500 text-xs">
            <span
              onClick={() => switchPersona('maya')}
              className="cursor-pointer hover:text-slate-900 transition-colors"
            >
              Maya (Caregiver)
            </span>
            <span
              onClick={() => switchPersona('thomas')}
              className="cursor-pointer hover:text-slate-900 transition-colors"
            >
              Mr. Thomas (Elder)
            </span>
            <span
              onClick={() => switchPersona('david')}
              className="cursor-pointer hover:text-slate-900 transition-colors"
            >
              David (Caregiver)
            </span>
            <span
              onClick={() => switchPersona('sarah')}
              className="cursor-pointer hover:text-slate-900 transition-colors"
            >
              Sarah (Auditor)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
