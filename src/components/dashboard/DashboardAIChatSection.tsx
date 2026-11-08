'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { SessionUser } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draftMessage?: string | null;
  suggestedActions?: string[];
  timestamp: string;
}

export interface PendingApprovalHold {
  id: string;
  paymentRequestId: string;
  elderName: string;
  amount: number;
  currency: string;
  merchantName: string;
  category: string;
  riskScore: number;
}

interface DashboardAIChatSectionProps {
  currentUser: SessionUser | null;
  elderName?: string;
  elderId?: string;
  pendingApprovals?: PendingApprovalHold[];
}

export function DashboardAIChatSection({
  currentUser,
  elderName = 'Mr. Thomas',
  elderId,
  pendingApprovals = [],
}: DashboardAIChatSectionProps) {
  const latestHold = pendingApprovals[0] as PendingApprovalHold | undefined;

  const defaultWelcomeMessage = useMemo<ChatMessage>(() => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (latestHold) {
      return {
        id: `welcome-${elderId || 'default'}-${latestHold.id}`,
        role: 'assistant',
        content: `Hello ${currentUser?.fullName || 'Maya'}! I am your **SafePay AI Assistant** with live RAG access to **${elderName}**'s payment baseline and active holds.\n\n⚠️ **Active Pending Hold:** SafePay is holding a **$${latestHold.amount.toFixed(2)} ${latestHold.currency}** charge from **${latestHold.merchantName}** (${latestHold.category}, Risk Score: ${latestHold.riskScore}/100) awaiting your review.\n\nAsk me about the risk assessment, why this charge was held, or ask me to draft a gentle text to ${elderName}.`,
        suggestedActions: [
          `Why was the $${latestHold.amount.toFixed(0)} charge from ${latestHold.merchantName} held?`,
          `Draft a gentle text to ${elderName} about ${latestHold.merchantName}`,
          `Summarize ${elderName}'s approved and declined transactions`,
        ],
        timestamp: time,
      };
    }

    return {
      id: `welcome-${elderId || 'default'}`,
      role: 'assistant',
      content: `Hello ${currentUser?.fullName || 'Maya'}! I am your **SafePay AI Assistant** with real-time access to **${elderName}**'s payment baseline, daily cap utilization, and transaction records.\n\nAsk me about recent transactions, protection limits, or ask me to draft a gentle check-in note to ${elderName}.`,
      suggestedActions: [
        `Summarize ${elderName}'s recent spending`,
        `Who are ${elderName}'s saved merchants?`,
        `Review ${elderName}'s protection limits`,
      ],
      timestamp: time,
    };
  }, [currentUser?.fullName, elderName, elderId, latestHold]);

  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Re-sync welcome message when elder or pending holds change
  useEffect(() => {
    setMessages((prev) => {
      // If user has not started a multi-turn conversation yet, replace with current dynamic welcome
      if (prev.length <= 1) {
        return [defaultWelcomeMessage];
      }
      return prev;
    });
  }, [defaultWelcomeMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/caregiver-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          elderId,
          elderName,
          pendingApprovals: pendingApprovals.map((a) => ({
            id: a.id,
            paymentRequestId: a.paymentRequestId,
            merchantName: a.merchantName,
            category: a.category,
            amount: a.amount,
            currency: a.currency,
            riskScore: a.riskScore,
          })),
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || "I've reviewed the records and updated the overview.",
        draftMessage: data.draftMessage,
        suggestedActions: data.suggestedActions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: latestHold
            ? `I am referencing ${elderName}'s live records. There is 1 pending hold: **${latestHold.merchantName} ($${latestHold.amount.toFixed(2)})** awaiting your review.\n\nSafePay has placed a temporary hold on this payment; no funds have moved. You can approve or decline directly above.`
            : `I am referencing ${elderName}'s live records. All transactions are currently in order and protected under SafePay rules.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDraft = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2000);
  };

  return (
    <div className="w-full liquid-glass rounded-3xl sm:rounded-[2rem] overflow-hidden border border-white/80 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.1)]">
      {/* macOS Style Chrome Header with Traffic Lights (Identical to Homepage) */}
      <div className="h-12 px-5 flex items-center justify-between border-b border-black/5 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/10" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] border border-black/10" />
        </div>

        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-xs font-bold text-slate-950 tracking-tight">
            SafePay Account RAG Assistant
          </span>
          <span className="text-[11px] font-semibold text-slate-400">•</span>
          <span className="text-[11px] text-slate-600 font-semibold">Account: {elderName}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider hidden sm:inline">
            Isolated Context Active
          </span>
        </div>
      </div>

      {/* Main Chat Messages Container */}
      <div className="h-[360px] sm:h-[400px] overflow-y-auto p-5 sm:p-6 space-y-4 bg-white/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === 'user' ? 'items-end' : 'items-start'
            } space-y-1.5`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 px-1">
              {m.role === 'user' ? (
                <span>You • {m.timestamp}</span>
              ) : (
                <span className="flex items-center gap-1 text-purple-700 font-semibold">
                  <Sparkles className="w-3 h-3" /> SafePay AI • {m.timestamp}
                </span>
              )}
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs ${
                m.role === 'user'
                  ? 'bg-slate-950 text-white rounded-br-xs'
                  : 'bg-white/95 text-slate-900 border border-black/5 rounded-bl-xs'
              }`}
            >
              <div className="whitespace-pre-line">{m.content}</div>

              {/* Draft text for Senior if present */}
              {m.draftMessage && (
                <div className="mt-3 p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 text-purple-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                      Suggested Text Message to {elderName}:
                    </span>
                    <button
                      onClick={() => handleCopyDraft(m.id, m.draftMessage!)}
                      className="px-2 py-1 rounded-md bg-white text-purple-900 text-[11px] font-semibold hover:bg-purple-100 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      {copiedDraftId === m.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium italic">&ldquo;{m.draftMessage}&rdquo;</p>
                </div>
              )}

              {/* Dynamic Suggested Actions */}
              {m.suggestedActions && m.suggestedActions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-black/5 flex flex-wrap gap-1.5">
                  {m.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(action)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-200 border border-slate-200/60 text-slate-700 transition-all active:scale-95"
                    >
                      {action} &rarr;
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/80 border border-black/5 max-w-xs text-xs text-slate-600 font-medium animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 text-purple-600 animate-spin" />
            <span>Consulting {elderName}&apos;s live account RAG...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Interactive Bottom Context Bar (Identical to Homepage below Hero) */}
      <div className="p-3.5 sm:p-4 border-t border-black/5 bg-white/70 backdrop-blur-md">
        {/* Real-time hold alert banner if hold is pending */}
        {latestHold && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-semibold truncate">
                Hold Pending: {latestHold.merchantName} (${latestHold.amount.toFixed(2)})
              </span>
            </div>
            <button
              onClick={() => handleSend(`Why was the $${latestHold.amount.toFixed(0)} charge from ${latestHold.merchantName} held?`)}
              className="text-[10px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0 ml-2"
            >
              Analyze in Chat &rarr;
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center bg-slate-50 rounded-full px-4 sm:px-5 py-2.5 border border-black/5 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-300 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${elderName}'s approved, declined, or pending charges...`}
              disabled={loading}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            />

            {/* Glowing Receiving Context Badge */}
            <div className="ml-2 hidden sm:flex items-center gap-1.5 shrink-0 pl-3 border-l border-slate-200">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-bold text-emerald-700 tracking-wide uppercase">
                Account RAG Grounded
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-950 active:scale-95 transition-all shadow-xs shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4 text-purple-300" />
          </button>
        </form>
      </div>
    </div>
  );
}
