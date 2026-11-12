'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionUser } from '@/types';
import { LunaMascot } from '@/components/mascot/LunaMascot';
import {
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Search,
  CheckCircle2,
  Users,
  Sparkles,
  Sun,
  Moon,
  Mic,
  Send,
  ChevronLeft,
  Play,
  Github,
  BookOpen,
  HelpCircle,
  X,
  Heart,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Sliders,
  Menu,
} from 'lucide-react';

interface DemoElderAccount {
  id: string;
  name: string;
  relationship: string;
  avatarInitial: string;
  avatarBg: string;
  cap: number;
  threshold: number;
  status: 'active' | 'hold';
  pendingHold?: {
    id: string;
    amount: number;
    merchant: string;
    category: string;
    riskScore: number;
    explanation: string;
    suggestedSms: string;
  };
}

const DEMO_ELDERS: DemoElderAccount[] = [
  {
    id: 'pradip',
    name: 'Pradip Rana Datta',
    relationship: 'Parent',
    avatarInitial: 'P',
    avatarBg: 'bg-purple-600',
    cap: 500,
    threshold: 100,
    status: 'hold',
    pendingHold: {
      id: 'hold-1',
      amount: 45.99,
      merchant: 'Amazon.com',
      category: 'Gardening Kit & Planter',
      riskScore: 78,
      explanation:
        'SafePay placed a protective hold on this charge because it exceeds Pradip’s usual morning baseline ($25.00) and is his first purchase from this merchant category.',
      suggestedSms:
        'Hi Dad, noticed your Amazon gardening order for $45.99. Approved it for you, have fun in the garden!',
    },
  },
  {
    id: 'thomas',
    name: 'Thomas Sterling',
    relationship: 'Father',
    avatarInitial: 'T',
    avatarBg: 'bg-emerald-600',
    cap: 1000,
    threshold: 150,
    status: 'active',
  },
  {
    id: 'eleanor',
    name: 'Eleanor Vance',
    relationship: 'Mother',
    avatarInitial: 'E',
    avatarBg: 'bg-blue-600',
    cap: 750,
    threshold: 120,
    status: 'active',
  },
];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [recentAction, setRecentAction] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Preview interactive state
  const [previewDark, setPreviewDark] = useState(false);
  const [isDeviceSidebarCollapsed, setIsDeviceSidebarCollapsed] = useState(false);
  const [previewChatInput, setPreviewChatInput] = useState('');
  const [voiceActive, setVoiceActive] = useState(false);
  const [selectedElderId, setSelectedElderId] = useState<string>('pradip');
  const [elderSearchQuery, setElderSearchQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modals state
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Active selected elder in demo
  const activeElder = DEMO_ELDERS.find((e) => e.id === selectedElderId) || DEMO_ELDERS[0];

  // Refresh authenticated session
  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('code') || params.get('token_hash')) {
        window.location.replace(`/auth/callback${window.location.search}`);
        return;
      }
    }
    refreshSession();
  }, []);

  const handleCopyDraft = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  return (
    <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 relative">
      {/* =========================================================================
          1. FLOATING LIQUID GLASS NAVIGATION BAR
          ========================================================================= */}
      <nav className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-5xl liquid-glass rounded-full px-5 py-2.5 flex items-center justify-between shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-white/80 transition-all duration-200">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <span className="font-bold tracking-tight text-sm text-slate-950">SafePay</span>
        </Link>

        {/* Center Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setStoryModalOpen(true)}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Our Story
          </button>
          <button
            onClick={() => setDocsModalOpen(true)}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Docs
          </button>
          <button
            onClick={() => setInstructionsModalOpen(true)}
            className="hover:text-slate-950 transition-colors cursor-pointer"
          >
            Instructions
          </button>
          <a
            href="https://github.com/Rijurajx/SafePay"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="View Source on GitHub"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
        </div>

        {/* Right CTA Button & Mobile Menu Toggle */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <Link
              href="/dashboard"
              className="px-4.5 py-1.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open App</span>
            </Link>
          ) : (
            <Link
              href="/signin"
              className="px-4.5 py-1.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="p-1.5 rounded-full text-slate-600 hover:text-slate-950 hover:bg-white/60 md:hidden transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Dropdown */}
      {mobileNavOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md liquid-glass rounded-3xl p-5 shadow-2xl border border-white/80 md:hidden flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => {
              setStoryModalOpen(true);
              setMobileNavOpen(false);
            }}
            className="text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white/60 transition-colors"
          >
            Our Story
          </button>
          <button
            onClick={() => {
              setDocsModalOpen(true);
              setMobileNavOpen(false);
            }}
            className="text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white/60 transition-colors"
          >
            Documentation
          </button>
          <button
            onClick={() => {
              setInstructionsModalOpen(true);
              setMobileNavOpen(false);
            }}
            className="text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white/60 transition-colors"
          >
            Instructions &amp; How to Use
          </button>
          <a
            href="https://github.com/Rijurajx/SafePay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white/60 transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub Repository</span>
          </a>
        </div>
      )}

      {/* =========================================================================
          2. HERO SECTION
          ========================================================================= */}
      <section className="pt-32 sm:pt-40 pb-16 px-6 max-w-5xl mx-auto flex flex-col items-center text-center gap-6">
        {/* Hero Title with Interactive Luna AI Mascot */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-950 leading-[1.08] max-w-4xl">
          Payments designed for{' '}
          <span className="inline-flex items-center align-middle mx-1 sm:mx-2">
            <LunaMascot size="lg" />
          </span>{' '}
          everyone you love.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed text-pretty">
          An intelligent payment protection companion that empowers seniors to shop independently online, while giving family members
          real-time oversight and instant approval controls via PayPal.
        </p>

        {/* Action Buttons: Get Started + View Demo */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <Link
            href={currentUser ? '/dashboard' : '/signup'}
            className="px-6 py-3 rounded-full bg-slate-950 text-white font-medium text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md shadow-slate-950/10 flex items-center gap-2"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </Link>

          <button
            onClick={() => setVideoModalOpen(true)}
            className="liquid-glass px-6 py-3 rounded-full text-slate-900 font-medium text-sm hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <Play className="w-3 h-3 fill-rose-600 ml-0.5" />
            </div>
            <span>View Demo</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          3. DEMO AI CHAT SCREEN (LUNA AI GUARDIAN WORKSPACE)
          ========================================================================= */}
      <section id="preview" className="px-4 sm:px-6 pb-24 max-w-6xl mx-auto">
        <div
          className={`w-full rounded-3xl sm:rounded-[2.25rem] overflow-hidden border transition-all duration-300 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.12)] ${
            previewDark
              ? 'bg-slate-900/95 border-slate-800 text-white shadow-2xl'
              : 'liquid-glass border-white/80 text-slate-900'
          }`}
        >
          {/* Header Bar: Luna AI Identity + Dark/Light Mode Toggle */}
          <div
            className={`h-14 px-5 flex items-center justify-between border-b transition-colors duration-200 ${
              previewDark
                ? 'bg-slate-900/90 border-white/10 text-white'
                : 'bg-white/60 border-black/5 text-slate-900'
            } backdrop-blur-md`}
          >
            {/* Luna AI Brand with Responsive Ball Mascot */}
            <div className="flex items-center gap-2.5">
              <LunaMascot size="sm" />
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">Luna AI</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  Guardian Engine
                </span>
              </div>
            </div>

            {/* Dark / Light Mode Toggle Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewDark((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
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

          {/* Body Container: Collapsible Elder Sidebar + Main Chat Pane */}
          <div
            className={`flex flex-col md:flex-row h-auto md:h-[620px] transition-colors duration-200 ${
              previewDark ? 'bg-slate-950 text-slate-100' : 'bg-white/70 text-slate-900'
            }`}
          >
            {/* Left Elder Switcher Sidebar (Copied from Actual AI Chat Interface) */}
            <aside
              className={`border-r transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col shrink-0 overflow-hidden ${
                previewDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/70 border-black/5'
              } ${isDeviceSidebarCollapsed ? 'w-16 p-2.5 items-center' : 'w-full md:w-72 p-4'}`}
            >
              <div className="flex items-center justify-between mb-3 w-full overflow-hidden">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isDeviceSidebarCollapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[160px]'
                  } ${previewDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  Elder Accounts
                </span>
                <button
                  onClick={() => setIsDeviceSidebarCollapsed((prev) => !prev)}
                  className={`p-1.5 rounded-xl transition-colors shrink-0 ${
                    previewDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-slate-500'
                  }`}
                  title={isDeviceSidebarCollapsed ? 'Expand Accounts' : 'Collapse Accounts'}
                >
                  <ChevronLeft
                    className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isDeviceSidebarCollapsed ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
              </div>

              {/* Search Bar */}
              <div
                className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden w-full ${
                  isDeviceSidebarCollapsed ? 'opacity-0 max-h-0 mb-0 pointer-events-none' : 'opacity-100 max-h-12 mb-3'
                }`}
              >
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={elderSearchQuery}
                    onChange={(e) => setElderSearchQuery(e.target.value)}
                    placeholder="Search elder accounts..."
                    className={`w-full h-9 pl-9 pr-3 rounded-xl border text-xs focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 ${
                      previewDark
                        ? 'bg-slate-800 border-white/10 text-white placeholder:text-slate-500'
                        : 'bg-white border-black/5 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Elder Switcher Items */}
              <div className="space-y-1.5 flex-1 overflow-y-auto w-full">
                {DEMO_ELDERS.filter((elder) =>
                  elder.name.toLowerCase().includes(elderSearchQuery.toLowerCase())
                ).map((elder) => {
                  const isSelected = activeElder.id === elder.id;
                  return (
                    <button
                      key={elder.id}
                      onClick={() => {
                        setSelectedElderId(elder.id);
                        setRecentAction(null);
                      }}
                      className={`flex items-center cursor-pointer transition-all border ${
                        isDeviceSidebarCollapsed
                          ? 'w-11 h-11 mx-auto justify-center p-0 rounded-2xl'
                          : 'w-full text-left p-2.5 rounded-2xl'
                      } ${
                        isSelected
                          ? previewDark
                            ? 'bg-purple-600/20 border-purple-500/40 text-white shadow-xs'
                            : 'bg-purple-50 border-purple-200 text-purple-950 shadow-xs'
                          : previewDark
                          ? 'border-transparent hover:bg-white/5 text-slate-300'
                          : 'border-transparent hover:bg-black/[0.03] text-slate-700'
                      }`}
                      title={`${elder.name} (${elder.relationship})`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full ${elder.avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                      >
                        {elder.avatarInitial}
                      </div>
                      <div
                        className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isDeviceSidebarCollapsed
                            ? 'opacity-0 max-w-0 pointer-events-none ml-0'
                            : 'opacity-100 max-w-[180px] ml-2.5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-xs font-bold truncate ${
                              isSelected
                                ? previewDark
                                  ? 'text-white'
                                  : 'text-purple-950'
                                : previewDark
                                ? 'text-slate-200'
                                : 'text-slate-900'
                            }`}
                          >
                            {elder.name}
                          </h4>
                          {elder.status === 'hold' && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 animate-pulse shrink-0 ml-1">
                              1 Hold
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[10px] truncate mt-0.5 ${
                            previewDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {elder.relationship} • Cap ${elder.cap}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isDeviceSidebarCollapsed && (
                <div
                  className={`pt-3 border-t flex items-center justify-between text-[11px] ${
                    previewDark ? 'border-white/10 text-slate-400' : 'border-black/5 text-slate-400'
                  }`}
                >
                  <span>PayPal SafePay Circle</span>
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Protected
                  </span>
                </div>
              )}
            </aside>

            {/* Right Chat & Controls Main Pane */}
            <main
              className={`flex-1 flex flex-col justify-between overflow-hidden transition-colors ${
                previewDark ? 'bg-slate-950/80 text-white' : 'bg-white/40 text-slate-900'
              }`}
            >
              {/* Context Bar */}
              <div
                className={`p-3.5 border-b flex items-center justify-between shrink-0 transition-colors ${
                  previewDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/80 border-black/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-600 flex items-center justify-center font-bold text-xs">
                    {activeElder.avatarInitial}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${previewDark ? 'text-white' : 'text-slate-950'}`}>
                      Monitoring: {activeElder.name} ({activeElder.relationship})
                    </div>
                    <div className={`text-[10px] ${previewDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Auto-Approval: ${activeElder.threshold} • Daily Cap: ${activeElder.cap} • PayPal Sandbox Active
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hidden sm:inline-block">
                  Live Guardian RAG
                </span>
              </div>

              {/* Scrollable Chat & Approval Area */}
              <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-5">
                {/* Pending Verification Request Card if Elder has hold */}
                {activeElder.pendingHold && (
                  <div className="w-full flex flex-col items-center justify-center gap-3 pb-2 border-b border-black/5">
                    <div className="w-full max-w-md flex items-center justify-between text-xs font-bold px-1">
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Action Required ({activeElder.name})</span>
                      </div>
                      <span className="text-[10px] bg-amber-400/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                        Caregiver Review
                      </span>
                    </div>

                    <div
                      className={`w-full max-w-md rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center text-center gap-3.5 border shadow-sm transition-colors ${
                        previewDark
                          ? 'bg-slate-900/90 border-white/10 text-white shadow-2xl'
                          : 'liquid-glass border-white/90 text-slate-900 shadow-sm'
                      }`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center ${
                          previewDark ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Verified Secure Connection
                        </p>
                        <h3 className={`text-3xl font-extrabold mt-1 ${previewDark ? 'text-white' : 'text-slate-950'}`}>
                          ${activeElder.pendingHold.amount.toFixed(2)}
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                          {activeElder.pendingHold.merchant} • {activeElder.pendingHold.category}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Risk Score: {activeElder.pendingHold.riskScore}/100
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            Account: {activeElder.name}
                          </span>
                        </div>
                      </div>

                      {recentAction ? (
                        <div className="w-full max-w-xs py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in">
                          ✓ {recentAction}
                        </div>
                      ) : (
                        <div className="w-full max-w-xs flex gap-2 pt-1">
                          <button
                            onClick={() => setRecentAction('Approved & Settled via PayPal')}
                            className="flex-1 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
                          >
                            Approve Now
                          </button>
                          <button
                            onClick={() => setRecentAction('Flagged and Held')}
                            className="py-2.5 px-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                        Secured by Family Member Oversight
                      </p>
                    </div>
                  </div>
                )}

                {/* Assistant Chat Bubble Starting with Luna Mascot */}
                <div className="flex items-start gap-3 max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <LunaMascot size="sm" className="mt-0.5" />
                  <div
                    className={`border rounded-2xl p-4.5 shadow-xs leading-relaxed text-xs sm:text-sm ${
                      previewDark
                        ? 'bg-slate-900 border-white/10 text-slate-200'
                        : 'bg-white border-black/5 text-slate-800'
                    }`}
                  >
                    <p>
                      Hello Maya! I placed a temporary hold on a <strong>$45.99</strong> order from Amazon.com on{' '}
                      <strong>{activeElder.name}</strong>&apos;s device. This purchase exceeds his normal morning baseline and is his first time ordering from this category.
                    </p>
                    <p className="mt-2 text-slate-500 text-xs">
                      PayPal funds have been safely held. Would you like to authorize this payment or send a gentle check-in note?
                    </p>

                    {/* Suggested SMS Draft Box */}
                    {activeElder.pendingHold?.suggestedSms && (
                      <div
                        className={`mt-3 p-3 rounded-xl border space-y-2 ${
                          previewDark
                            ? 'bg-purple-950/30 border-purple-500/20 text-purple-200'
                            : 'bg-purple-50 border-purple-200/70 text-purple-950'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>Suggested Check-In Note:</span>
                          <button
                            onClick={() => handleCopyDraft(activeElder.pendingHold!.suggestedSms)}
                            className="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-semibold cursor-pointer"
                          >
                            {copiedDraft ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy SMS</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] italic">
                          &ldquo;{activeElder.pendingHold.suggestedSms}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Quick action prompt pills */}
                    <div className="mt-3.5 pt-2.5 border-t border-black/5 flex flex-wrap gap-1.5">
                      {['Why was this held?', 'Approve and notify Dad', 'Review daily cap'].map((act, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewChatInput(act)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            previewDark
                              ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700'
                              : 'bg-slate-100 border-slate-200/60 text-slate-700 hover:bg-purple-50 hover:text-purple-900'
                          }`}
                        >
                          {act} &rarr;
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Input Bar */}
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
                    placeholder="Ask Luna AI about this payment or security rule..."
                    className={`flex-1 px-4 py-2.5 rounded-full border text-xs outline-none transition-all ${
                      previewDark
                        ? 'bg-slate-800 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500'
                        : 'bg-slate-50 border-black/5 text-slate-900 placeholder:text-slate-500 focus:border-purple-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setVoiceActive((prev) => !prev)}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer ${
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
                    className="p-2.5 rounded-full bg-slate-950 text-white hover:bg-slate-800 transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4 text-purple-400" />
                  </button>
                </form>
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. STATEMENT SECTION WITH GIANT RESPONSIVE LUNA MASCOT
          ========================================================================= */}
      <section className="px-6 py-12 max-w-6xl mx-auto">
        <div className="relative liquid-glass rounded-3xl p-8 sm:p-14 overflow-hidden flex flex-col justify-center border border-white/80 shadow-md">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-semibold leading-tight max-w-2xl text-slate-950 tracking-tight">
            SafePay acts as an <span className="text-slate-500">invisible safety net</span> that grows more intuitive
            with every interaction.
          </h2>

          {/* Giant Cursor-Tracking Luna Statement Mascot */}
          <div className="absolute -bottom-8 -right-8">
            <LunaMascot size="xl" />
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. FEATURES SECTION (REPLACING OLD SECTION BELOW STATEMENT)
          ========================================================================= */}
      <section id="features" className="px-6 py-16 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Payment Safeguards</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Engineered for Independence &amp; Family Security
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Every layer of SafePay is designed to preserve the autonomy of seniors while shielding them from digital deception,
            predatory recurring subscriptions, and rogue checkout flows.
          </p>
        </div>

        {/* 6 Feature Architecture Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1: Sub-Second PayPal Hold Engine */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Sub-Second PayPal Hold Engine</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Seamlessly intercepts checkouts before final fund settlement. Routine grocery and prescription payments pass automatically, while anomalous charges are placed on safe hold.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>PayPal Orders v2 API</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>

          {/* Feature 2: Context-Aware Gemini AI Engine */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Context-Aware Risk Scoring</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Evaluates every transaction against historical baselines, detects duplicate merchant submissions within 24 hours, and flags unverified third-party sellers.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>Real-Time Anomaly Scoring</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>

          {/* Feature 3: Dignified Senior Autonomy */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Dignified Senior Autonomy</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Seniors retain their financial freedom. No invasive surveillance over everyday transactions. Custom daily and monthly caps keep elders in control of their lifestyle.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>Zero-Surveillance Architecture</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>

          {/* Feature 4: Luna AI Guardian Assistant */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <LunaMascot size="xs" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Luna AI Guardian Assistant</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Translates cryptic billing statements into plain, compassionate human explanations. Automatically drafts respectful, non-patronizing check-in SMS messages to parents.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>Grounded Retrieval-Augmented AI</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>

          {/* Feature 5: Instant Limit Escalations */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Sliders className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-950">One-Tap Limit Escalation</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                When a special repair, vacation, or medical bill arises, seniors can request a temporary limit bump with a single tap. Caregivers approve instantly via dashboard.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>Emergency Limit Dispatch</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>

          {/* Feature 6: Cryptographic Guardian Circles */}
          <div className="liquid-glass p-7 rounded-3xl border border-white/90 shadow-sm flex flex-col justify-between hover:translate-y-[-3px] transition-all duration-200 group">
            <div className="space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-950">Multi-Guardian Collaboration</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Multiple adult siblings can join a single elder circle with granular permission matrices: primary approvers, co-caregivers, and view-only family auditors.
              </p>
            </div>
            <div className="pt-6 mt-4 border-t border-black/5 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>Tamper-Evident Audit Logging</span>
              <span className="text-slate-400">&rarr;</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. FAQ SECTION
          ========================================================================= */}
      <section id="faq" className="px-6 py-20 max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 tracking-tight text-slate-950">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3.5">
          {[
            {
              q: 'How does SafePay protect elder payments with PayPal?',
              a: 'The senior checks out with PayPal as usual. SafePay inspects the transaction against the senior’s established behavioral baseline and family protection limits. If everything is normal, the payment is captured immediately. If an anomaly or unverified vendor is detected, the charge is placed on safe hold without settling funds until a designated family guardian reviews it.',
            },
            {
              q: 'Can family members monitor every single purchase?',
              a: 'SafePay balances safety with dignity. Everyday routine expenses below the family approval threshold (such as groceries or utilities) settle cleanly. Family guardians only receive active hold notifications for unfamiliar merchants, duplicate charges, or purchases that exceed customized limits.',
            },
            {
              q: 'What is Luna AI and how does it assist caregivers?',
              a: 'Luna AI is an account-grounded AI guardian. It analyzes risk assessments in real time, translates confusing merchant descriptors into clear terms, and drafts empathetic, respectful text messages that adult children can copy and send to their aging parents.',
            },
            {
              q: 'What happens if a senior needs to make a larger purchase?',
              a: 'Seniors can tap "Request Limit Increase" directly from their Senior Shield profile. They specify the amount and purpose, and their family circle is immediately notified to authorize the adjustment with one click.',
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
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/40 transition-colors cursor-pointer"
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

      {/* =========================================================================
          7. REDESIGNED FOOTER (EXCLUDING DEMO ACCOUNTS, PROFESSIONAL LAYOUT)
          ========================================================================= */}
      <footer className="px-6 pt-16 pb-12 border-t border-black/5 text-xs text-slate-600 bg-white/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Top Footer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            {/* Column 1: Brand & Tagline */}
            <div className="space-y-3">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="font-bold text-slate-900 text-sm">SafePay</span>
              </Link>
              <p className="text-xs text-slate-500 leading-relaxed">
                Autonomous financial dignity for seniors. Peace of mind for families. Powered by PayPal Sandbox and Google Gemini AI.
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PayPal Sandbox Engine Operational</span>
              </div>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Product</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#features" className="hover:text-slate-950 transition-colors">
                    Core Features
                  </a>
                </li>
                <li>
                  <a href="#preview" className="hover:text-slate-950 transition-colors">
                    Luna AI Guardian Preview
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setVideoModalOpen(true)}
                    className="hover:text-slate-950 transition-colors text-left cursor-pointer"
                  >
                    Interactive Demo Video
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setInstructionsModalOpen(true)}
                    className="hover:text-slate-950 transition-colors text-left cursor-pointer"
                  >
                    User Instructions
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Architecture & Security */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Architecture</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setDocsModalOpen(true)}
                    className="hover:text-slate-950 transition-colors text-left cursor-pointer"
                  >
                    Developer Docs &amp; APIs
                  </button>
                </li>
                <li>
                  <span className="text-slate-400">Two-Step PayPal Capture</span>
                </li>
                <li>
                  <span className="text-slate-400">Gemini Risk Engine</span>
                </li>
                <li>
                  <span className="text-slate-400">Zero-Knowledge Monitoring</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Story & GitHub */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Company &amp; Open Source</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setStoryModalOpen(true)}
                    className="hover:text-slate-950 transition-colors text-left cursor-pointer"
                  >
                    Our Story &amp; Mission
                  </button>
                </li>
                <li>
                  <a
                    href="https://github.com/Rijurajx/SafePay"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-slate-950 transition-colors flex items-center gap-1.5"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub Repository</span>
                  </a>
                </li>
                <li>
                  <span className="text-slate-400">Financial Innovation Hackathon</span>
                </li>
                <li>
                  <span className="text-slate-400">Apache 2.0 / MIT License</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <div>© 2026 SafePay Technologies Inc. Built for the PayPal AI Financial Innovation Hackathon.</div>
            <div className="flex items-center gap-5">
              <span>Financial Privacy Compliant</span>
              <span>•</span>
              <span>Encrypted Session Vault</span>
              <span>•</span>
              <span>PayPal Sandbox Verified</span>
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          8. MODALS (OUR STORY, DOCS, INSTRUCTIONS, VIEW DEMO)
          ========================================================================= */}

      {/* OUR STORY MODAL */}
      {storyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl liquid-glass rounded-3xl p-6 sm:p-8 border border-white/90 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-3">
                <LunaMascot size="sm" />
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Our Story</h3>
                  <p className="text-xs text-slate-500">Why we built SafePay for our aging family members</p>
                </div>
              </div>
              <button
                onClick={() => setStoryModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <p>
                Every year, millions of seniors lose billions of dollars to online scams, hidden subscriptions, and predatory
                billing. But the conventional answer—taking away their credit cards or micromanaging their everyday lives—strips away
                the very independence they have earned over a lifetime.
              </p>
              <p>
                We asked ourselves a simple question: <em>What if family protection felt as effortless as a gentle tap on the shoulder?</em>
              </p>
              <p>
                SafePay was born to bridge this exact divide. By integrating directly with <strong>PayPal&apos;s two-phase payment authorization</strong>,
                we created an intelligent safety net that intercepts risky transactions before a single dollar moves, without
                burdening seniors or requiring invasive oversight.
              </p>
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200/70 text-purple-950 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Our Core Promise</span>
                <p className="text-xs leading-relaxed">
                  Autonomy for our elders. Complete peace of mind for our families. No awkward conversations, no cryptic statements, and no compromises.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setStoryModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                Close Story
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCS MODAL */}
      {docsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl liquid-glass rounded-3xl p-6 sm:p-8 border border-white/90 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xs">
                  <BookOpen className="w-4.5 h-4.5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">SafePay Documentation &amp; Architecture</h3>
                  <p className="text-xs text-slate-500">PayPal Sandbox Integration, Risk Telemetry &amp; Data Isolation</p>
                </div>
              </div>
              <button
                onClick={() => setDocsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950">1. Two-Phase PayPal Capture Engine</h4>
                <p>
                  Transactions initiated by protected elders utilize the PayPal Orders v2 API with <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">intent: AUTHORIZE</code>.
                  Funds remain securely authorized but uncaptured until SafePay evaluates risk telemetry. If flagged or held, capture occurs only after guardian sign-off.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950">2. Contextual Gemini Anomaly Engine</h4>
                <p>
                  Risk scores (0–100) are computed dynamically across multiple dimensions:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Velocity &amp; Duplicate Filter:</strong> Flags identical amounts to the same merchant within a 24-hour window.</li>
                  <li><strong>Threshold Guard:</strong> Compares total daily spend against custom family daily caps and absolute limits.</li>
                  <li><strong>Merchant Provenance:</strong> Evaluates domain registration, vendor category, and prior safe history.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950">3. Luna AI RAG System</h4>
                <p>
                  Built with retrieval-augmented generation over PostgreSQL audit logs and protection settings. Luna AI generates tailored SMS check-in notes and plain-English risk rationales for unfamiliar billing codes.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950">4. Zero-Knowledge Monitoring Until Consent</h4>
                <p>
                  Caregiver invitations do not expose elder financial telemetry until the senior member explicitly accepts the cryptographic invitation token and grants consent.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-black/5">
              <a
                href="https://github.com/Rijurajx/SafePay"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1"
              >
                <span>Read Full Technical Readme on GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setDocsModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTRUCTIONS MODAL */}
      {instructionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl liquid-glass rounded-3xl p-6 sm:p-8 border border-white/90 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xs">
                  <HelpCircle className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">How to Use SafePay</h3>
                  <p className="text-xs text-slate-500">Step-by-step instructions for Caregivers and Seniors</p>
                </div>
              </div>
              <button
                onClick={() => setInstructionsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-950">Caregiver Registration &amp; Family Setup</h4>
                  <p className="text-slate-600">
                    Sign up as a Family Guardian. On the onboarding screen, set your desired automatic approval threshold (e.g. $100), daily spending cap, and invite your senior family member by their private email.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-950">Senior Acceptance &amp; Autonomous Shopping</h4>
                  <p className="text-slate-600">
                    Your senior loved one receives a private cryptographic invite link in their email inbox. Once accepted, their Senior Shield profile is active. They can shop normally online using PayPal without awkward restrictions.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-950">Luna AI Real-Time Hold Review</h4>
                  <p className="text-slate-600">
                    If an unfamiliar charge, duplicate transaction, or cap exceedance occurs, SafePay places a temporary hold. Open the <strong>AI Assistant Chat</strong> in your Caregiver Dashboard to review Luna AI’s explanation, approve the charge in 1-tap, or copy a gentle pre-written check-in message.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-950">Senior Limit Increase Requests</h4>
                  <p className="text-slate-600">
                    If your senior needs to make an extraordinary purchase (home repairs, travel), they tap &ldquo;Request Limit Increase&rdquo; in their Senior Ledger. Caregivers can review and approve it immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInstructionsModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DEMO VIDEO MODAL */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-3xl liquid-glass rounded-3xl p-6 sm:p-8 border border-white/90 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-black/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
                  <Play className="w-4 h-4 fill-rose-600 ml-0.5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">SafePay Live Demo Walkthrough</h3>
                  <p className="text-xs text-slate-500">PayPal Sandbox simulation &amp; Luna AI Guardian demonstration</p>
                </div>
              </div>
              <button
                onClick={() => setVideoModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-950 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Container Area */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center p-6 shadow-inner">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center mb-3">
                <Play className="w-7 h-7 fill-white ml-1" />
              </div>
              <h4 className="text-white font-bold text-base sm:text-lg mb-1">
                SafePay PayPal AI Demonstration Video
              </h4>
              <p className="text-slate-400 text-xs sm:text-sm max-w-md">
                Official demonstration video will be embedded here. Experience the seamless two-step hold mechanism, real-time Gemini risk evaluation, and Luna AI check-in workflow.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">
                SafePay Technologies • PayPal Innovation Hackathon
              </span>
              <button
                onClick={() => setVideoModalOpen(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                Close Video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
