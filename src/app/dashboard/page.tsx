'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  LogOut,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Users,
  Eye,
  RefreshCw,
  ShoppingBag,
  AlertTriangle,
  X,
  Store,
  Copy,
  Check,
  Sliders,
  Edit2,
  User,
  Heart,
  MapPin,
  LayoutDashboard,
  Bot,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Send,
  ArrowRight,
} from 'lucide-react';
import { SessionUser, DemoPersonaKey } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface LinkedElder {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  city?: string | null;
  primaryZipCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  relationship: string;
  permission: {
    canView: boolean;
    canApprove: boolean;
    canManage: boolean;
  };
  protectionSettings: {
    familyApprovalThreshold: number;
    absoluteDailyCap: number;
    absoluteTransactionCap?: number;
    monthlyBudget?: number | null;
    requireFamilyForNewRecipient?: boolean;
    requireFamilyForUnusual?: boolean;
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

interface LedgerItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  category: string;
  isTrusted?: boolean;
  requiresFamilyApproval?: boolean;
  createdAt: string;
  settledAt?: string | null;
  riskAssessment?: {
    score?: number;
    reasons?: string[];
    recommendedAction?: string;
    caregiverExplanation?: string;
    seniorExplanation?: string;
  } | null;
  approvalRequest?: {
    id: string;
    status: string;
  } | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draftMessage?: string | null;
  suggestedActions?: string[];
  timestamp: string;
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
  phoneNumber?: string | null;
  preferredNotification?: string | null;
  relationship: string;
  canApprove: boolean;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<'CAREGIVER' | 'PROTECTED_USER' | null>(null);

  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState<'overview' | 'elders' | 'ai-chat' | 'profile'>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Caregiver core state
  const [linkedElders, setLinkedElders] = useState<LinkedElder[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string>('');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Elder Connect form
  const [connectName, setConnectName] = useState('');
  const [connectEmail, setConnectEmail] = useState('');
  const [connectRelationship, setConnectRelationship] = useState('Parent');
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

  // Transactions Ledger State
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'SETTLED' | 'AWAITING_FAMILY' | 'DECLINED'>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [expandedLedgerId, setExpandedLedgerId] = useState<string | null>(null);

  // Dedicated AI Chat State (keyed by elderId)
  const [chatMessagesByElder, setChatMessagesByElder] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Senior state
  const [seniorTodaySpend, setSeniorTodaySpend] = useState<number>(0);
  const [seniorDailyCap, setSeniorDailyCap] = useState<number>(1000);
  const [seniorFamilyThreshold, setSeniorFamilyThreshold] = useState<number>(100);
  const [seniorMonthlyBudget, setSeniorMonthlyBudget] = useState<number>(2000);
  const [seniorGuardians, setSeniorGuardians] = useState<SeniorGuardian[]>([]);
  const [seniorHolds, setSeniorHolds] = useState<SeniorHold[]>([]);
  const [seniorRecentPayments, setSeniorRecentPayments] = useState<RecentPayment[]>([]);

  // Profile edit modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileNotification, setProfileNotification] = useState<'BOTH' | 'SMS' | 'EMAIL'>('BOTH');
  const [profileCity, setProfileCity] = useState('');
  const [profileZip, setProfileZip] = useState('');
  const [profileEmergencyName, setProfileEmergencyName] = useState('');
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Safety limits edit modal state
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [limitThreshold, setLimitThreshold] = useState('100');
  const [limitDailyCap, setLimitDailyCap] = useState('1000');
  const [limitTransactionCap, setLimitTransactionCap] = useState('500');
  const [limitMonthlyBudget, setLimitMonthlyBudget] = useState('2000');
  const [limitNewMerchant, setLimitNewMerchant] = useState(true);
  const [limitUnusual, setLimitUnusual] = useState(true);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  // Action feedback states
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Currently selected active elder object
  const activeElder = useMemo(() => {
    return linkedElders.find((e) => e.id === selectedElderId) || linkedElders[0] || null;
  }, [linkedElders, selectedElderId]);

  // Fetch summary from backend
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (res.status === 401) {
        window.location.href = '/auth/signin';
        return;
      }
      const data = await res.json();
      setCurrentUser(data.user);
      setRole(data.role);

      if (data.role === 'CAREGIVER') {
        const freshElders: LinkedElder[] = data.linkedElders || [];
        setLinkedElders(freshElders);
        if (freshElders.length > 0) {
          setSelectedElderId((prev) => (freshElders.some((e) => e.id === prev) ? prev : freshElders[0].id));
        } else {
          setSelectedElderId('');
        }
        setPendingApprovals(data.pendingApprovals || []);
      } else {
        setSeniorTodaySpend(data.todaySpend || 0);
        setSeniorDailyCap(data.dailyCap || 1000);
        setSeniorFamilyThreshold(data.familyThreshold || 100);
        setSeniorMonthlyBudget(data.monthlyBudget || 2000);
        setSeniorGuardians(data.guardians || []);
        setSeniorHolds(data.activeHolds || []);
        setSeniorRecentPayments(data.recentPayments || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard summary:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch past transactions ledger for an elder
  const fetchElderLedger = useCallback(async (elderId: string) => {
    if (!elderId) {
      setLedgerItems([]);
      return;
    }
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/family/activity?elderId=${elderId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLedgerItems(data.payments || []);
      }
    } catch (err) {
      console.error('Failed to load elder ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Load ledger whenever selectedElderId changes
  useEffect(() => {
    if (selectedElderId) {
      fetchElderLedger(selectedElderId);
    }
  }, [selectedElderId, fetchElderLedger]);

  // Initial welcome message builder for an elder
  const getInitialElderWelcome = useCallback(
    (elder: LinkedElder, holds: PendingApproval[]): ChatMessage => {
      const hold = holds.find(
        (h) => h.elderName.toLowerCase() === elder.fullName.toLowerCase()
      );
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (hold) {
        return {
          id: `welcome-${elder.id}-${hold.id}`,
          role: 'assistant',
          content: `Hello ${currentUser?.fullName || 'Caregiver'}! I am monitoring **${elder.fullName}**'s account in real time.\n\n⚠️ **Action Required:** SafePay held a **$${hold.amount.toFixed(2)} ${hold.currency}** charge from **${hold.merchantName}** (${hold.category}, AI Risk Score: ${hold.riskScore}/100).\n\nYou can authorize or decline using the control buttons above, or ask me why this charge was flagged.`,
          suggestedActions: [
            `Why was the $${hold.amount.toFixed(0)} charge from ${hold.merchantName} held?`,
            `Draft a gentle text to ${elder.fullName} about this charge`,
            `Is ${hold.merchantName} safe for seniors?`,
          ],
          timestamp: time,
        };
      }

      return {
        id: `welcome-${elder.id}`,
        role: 'assistant',
        content: `Hello ${currentUser?.fullName || 'Caregiver'}! I am your AI Assistant for **${elder.fullName}**.\n\nAll safeguards are active (Auto-Approval: $${elder.protectionSettings.familyApprovalThreshold}, Daily Cap: $${elder.protectionSettings.absoluteDailyCap}, Monthly Budget: $${(elder.protectionSettings.monthlyBudget || 2000).toLocaleString()}). No pending holds require your attention right now.\n\nAsk me about recent transactions, spending patterns, or drafting check-in messages.`,
        suggestedActions: [
          `Summarize ${elder.fullName}'s recent transactions`,
          `Are ${elder.fullName}'s safety limits appropriate?`,
          `Check ${elder.fullName}'s home city baseline`,
        ],
        timestamp: time,
      };
    },
    [currentUser?.fullName]
  );

  // Initialize elder chat context if empty
  useEffect(() => {
    if (activeElder && !chatMessagesByElder[activeElder.id]) {
      const initialMsg = getInitialElderWelcome(activeElder, pendingApprovals);
      setChatMessagesByElder((prev) => ({
        ...prev,
        [activeElder.id]: [initialMsg],
      }));
    }
  }, [activeElder, pendingApprovals, chatMessagesByElder, getInitialElderWelcome]);

  // Scroll chat to bottom when active tab or messages update
  useEffect(() => {
    if (activeTab === 'ai-chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, chatMessagesByElder, chatLoading]);

  // Send message in AI Assistant tab
  const handleSendChatMessage = async (promptToSend?: string) => {
    if (!activeElder) return;
    const text = (promptToSend || chatInput).trim();
    if (!text || chatLoading) return;

    const currentList = chatMessagesByElder[activeElder.id] || [
      getInitialElderWelcome(activeElder, pendingApprovals),
    ];
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...currentList, userMsg];
    setChatMessagesByElder((prev) => ({ ...prev, [activeElder.id]: updatedMessages }));
    setChatInput('');
    setChatLoading(true);

    try {
      const elderHolds = pendingApprovals.filter(
        (a) => a.elderName.toLowerCase() === activeElder.fullName.toLowerCase()
      );
      const res = await fetch('/api/ai/caregiver-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          elderId: activeElder.id,
          elderName: activeElder.fullName,
          pendingApprovals: elderHolds.map((a) => ({
            id: a.id,
            paymentRequestId: a.paymentRequestId,
            merchantName: a.merchantName,
            category: a.category,
            amount: a.amount,
            currency: a.currency,
            riskScore: a.riskScore,
          })),
          conversationHistory: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || "I've reviewed the transaction records for you.",
        draftMessage: data.draftMessage,
        suggestedActions: data.suggestedActions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessagesByElder((prev) => ({
        ...prev,
        [activeElder.id]: [...(prev[activeElder.id] || []), aiMsg],
      }));
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: `I've inspected ${activeElder.fullName}'s live records. All transactions are actively guarded under your SafePay protection rules.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessagesByElder((prev) => ({
        ...prev,
        [activeElder.id]: [...(prev[activeElder.id] || []), fallbackMsg],
      }));
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopyDraft = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDraftId(id);
    setTimeout(() => setCopiedDraftId(null), 2500);
  };

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
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/auth/signin';
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
        if (selectedElderId) {
          await fetchElderLedger(selectedElderId);
        }
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

  const openProfileModal = () => {
    setProfileName(currentUser?.fullName || '');
    setProfilePhone(currentUser?.phoneNumber || '');
    setProfileNotification((currentUser?.preferredNotification as 'BOTH' | 'SMS' | 'EMAIL') || 'BOTH');
    setProfileCity(currentUser?.city || '');
    setProfileZip(currentUser?.primaryZipCode || '');
    setProfileEmergencyName(currentUser?.emergencyContactName || '');
    setProfileEmergencyPhone(currentUser?.emergencyContactPhone || '');
    setProfileError(null);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profileName.trim(),
          phoneNumber: profilePhone.trim() || null,
          preferredNotification: profileNotification,
          city: profileCity.trim() || null,
          primaryZipCode: profileZip.trim() || null,
          emergencyContactName: profileEmergencyName.trim() || null,
          emergencyContactPhone: profileEmergencyPhone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update profile');
      } else {
        if (currentUser) {
          setCurrentUser({ ...currentUser, ...data.user });
        }
        setActionNotice({
          message: 'Caregiver profile updated successfully!',
          type: 'success',
        });
        setIsProfileModalOpen(false);
        await fetchSummary();
      }
    } catch {
      setProfileError('Network error updating profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const openLimitsModal = () => {
    if (!activeElder) return;
    setLimitThreshold(String(activeElder.protectionSettings.familyApprovalThreshold || 100));
    setLimitDailyCap(String(activeElder.protectionSettings.absoluteDailyCap || 1000));
    setLimitTransactionCap(String(activeElder.protectionSettings.absoluteTransactionCap || 500));
    setLimitMonthlyBudget(String(activeElder.protectionSettings.monthlyBudget || 2000));
    setLimitNewMerchant(activeElder.protectionSettings.requireFamilyForNewRecipient ?? true);
    setLimitUnusual(activeElder.protectionSettings.requireFamilyForUnusual ?? true);
    setLimitsError(null);
    setIsLimitsModalOpen(true);
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeElder) return;
    setLimitsSaving(true);
    setLimitsError(null);
    try {
      const res = await fetch('/api/family/protection-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elderId: activeElder.id,
          familyApprovalThreshold: Number(limitThreshold) || 100,
          absoluteDailyCap: Number(limitDailyCap) || 1000,
          absoluteTransactionCap: Number(limitTransactionCap) || 500,
          monthlyBudget: Number(limitMonthlyBudget) || 2000,
          requireFamilyForNewRecipient: limitNewMerchant,
          requireFamilyForUnusual: limitUnusual,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLimitsError(data.error || 'Failed to save limits');
      } else {
        setActionNotice({
          message: `Safety limits updated for ${activeElder.fullName}!`,
          type: 'success',
        });
        setIsLimitsModalOpen(false);
        await fetchSummary();
      }
    } catch {
      setLimitsError('Network error saving limits');
    } finally {
      setLimitsSaving(false);
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
          elderFullName: connectName.trim(),
          elderEmailOrPhone: connectEmail.trim(),
          relationship: connectRelationship,
          familyApprovalThreshold: Number(connectThreshold) || 100,
          absoluteDailyCap: Number(connectDailyCap) || 1000,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectError(data.error || 'Failed to issue elder invitation');
      } else {
        setCreatedInvite({
          elderName: connectName.trim(),
          contact: connectEmail.trim(),
          inviteLink: data.inviteLink,
        });
        await fetchSummary();
      }
    } catch {
      setConnectError('Network error issuing invitation');
    } finally {
      setConnectSubmitting(false);
    }
  };

  const copyInviteToClipboard = () => {
    if (!createdInvite?.inviteLink) return;
    navigator.clipboard.writeText(createdInvite.inviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Filtered transactions for the ledger view
  const filteredLedger = useMemo(() => {
    return ledgerItems.filter((item) => {
      // Filter by status tab
      if (ledgerFilter === 'SETTLED' && item.status !== 'SETTLED') return false;
      if (ledgerFilter === 'AWAITING_FAMILY' && item.status !== 'AWAITING_FAMILY') return false;
      if (ledgerFilter === 'DECLINED' && item.status !== 'DECLINED') return false;

      // Filter by search string
      if (ledgerSearch.trim()) {
        const query = ledgerSearch.toLowerCase();
        const matchesMerchant = item.merchantName.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        return matchesMerchant || matchesCategory;
      }
      return true;
    });
  }, [ledgerItems, ledgerFilter, ledgerSearch]);

  // Elder pending approvals for the active elder in AI chat
  const activeElderPendingApprovals = useMemo(() => {
    if (!activeElder) return [];
    return pendingApprovals.filter(
      (a) => a.elderName.toLowerCase() === activeElder.fullName.toLowerCase()
    );
  }, [activeElder, pendingApprovals]);

  if (loading) {
    return (
      <div className="min-h-screen soft-mesh-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-semibold tracking-wide text-slate-700">Loading SafePay Dashboard...</p>
        </div>
      </div>
    );
  }

  /* =========================================================================
     PROTECTED USER (SENIOR) VIEW
     ========================================================================= */
  if (role === 'PROTECTED_USER') {
    return (
      <div className="min-h-screen soft-mesh-bg text-[#0a0c10] font-sans selection:bg-purple-100 selection:text-purple-900 pb-20">
        <header className="sticky top-4 z-40 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="liquid-glass rounded-full px-5 py-2.5 flex items-center justify-between border border-white/80 shadow-sm">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="font-bold tracking-tight text-sm text-slate-950">SafePay</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Senior Shield
              </span>
            </Link>

            <div className="flex items-center gap-3">
              {currentUser && (
                <div className="text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-full bg-white/80 border border-slate-200">
                  {currentUser.fullName}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
          {/* Senior Profile & Safeguards */}
          <div className="liquid-glass rounded-3xl p-6 sm:p-7 border border-white/80 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.08)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-950">Your Senior Profile &amp; Safeguards</h2>
                  <p className="text-xs text-slate-500">Protected family member account</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Shield Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-white/70 rounded-2xl border border-black/5 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Your Full Name</span>
                <span className="font-extrabold text-slate-900 text-sm block">{currentUser?.fullName}</span>
                <span className="text-[10px] text-emerald-700 font-semibold block">Protected Senior Account</span>
              </div>
              <div className="p-3.5 bg-white/70 rounded-2xl border border-black/5 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Account Contact</span>
                <span className="font-mono text-slate-800 text-xs truncate block">{currentUser?.email}</span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {currentUser?.phoneNumber ? `Mobile: ${currentUser.phoneNumber}` : 'SSO Verified'}
                </span>
              </div>
              <div className="p-3.5 bg-white/70 rounded-2xl border border-black/5 space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Primary Family Guardian</span>
                <span className="font-bold text-purple-900 text-xs block truncate">
                  {seniorGuardians.length > 0
                    ? `${seniorGuardians[0].fullName} (${seniorGuardians[0].relationship})`
                    : 'Caregiver Linked'}
                </span>
                <span className="font-mono text-slate-500 text-[10px] block truncate">
                  {seniorGuardians.length > 0 ? seniorGuardians[0].email : 'Connected Guardian'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-2.5 bg-white/60 rounded-xl border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase block">Monthly Budget</span>
                  <span className="font-bold text-slate-900 text-xs">${seniorMonthlyBudget.toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">Planned</span>
              </div>

              <div className="p-2.5 bg-white/60 rounded-xl border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase block">Home Baseline</span>
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{currentUser?.city ? `${currentUser.city} ${currentUser.primaryZipCode || ''}` : 'Local Region'}</span>
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">AI Active</span>
              </div>

              <div className="p-2.5 bg-white/60 rounded-xl border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase block">Emergency Backup</span>
                  <span className="font-bold text-slate-900 text-xs truncate block">
                    {currentUser?.emergencyContactName ? `${currentUser.emergencyContactName}` : 'Family Guardian'}
                  </span>
                </div>
                <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              </div>
            </div>
          </div>

          {/* Warm Welcome Card */}
          <div className="liquid-glass rounded-3xl p-8 border border-white/80 shadow-[0_20px_50px_-16px_rgba(15,23,42,0.1)] space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
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
                    : 'Your family caregivers are linked to confirm unusual or large payments.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {seniorGuardians.length > 0 && (
                  <button
                    onClick={() => handleSwitchFamily(seniorGuardians[0].id)}
                    className="px-3 py-1 text-xs font-semibold text-slate-800 rounded-full bg-slate-100 hover:bg-white border border-slate-200/80 flex items-center gap-1 shadow-2xs transition-all"
                    title="Switch session to Caregiver approval mode"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Switch to Caregiver View</span>
                  </button>
                )}
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
                  Hold: ${seniorFamilyThreshold.toFixed(0)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  Cap: ${seniorDailyCap.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="liquid-glass-subtle rounded-2xl p-5 border border-white">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today&apos;s Purchases</span>
                <div className="text-3xl font-extrabold text-slate-950 mt-1">${seniorTodaySpend.toFixed(2)}</div>
                <p className="text-xs text-slate-500 mt-1">Routine purchases process normally.</p>
              </div>

              <div className="liquid-glass-subtle rounded-2xl p-5 border border-white flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Protected Shopping</span>
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

          {/* Active Holds Section */}
          {seniorHolds.length > 0 && (
            <div className="liquid-glass rounded-3xl p-7 border border-amber-200 shadow-md space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-950">We&apos;re Checking In With Your Family</h2>
              </div>

              {seniorHolds.map((hold) => (
                <div key={hold.id} className="bg-white/90 rounded-2xl p-5 border border-amber-100 shadow-2xs space-y-3">
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
                </div>
              ))}
            </div>
          )}

          {/* Recent Purchases */}
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
        </main>
      </div>
    );
  }

  /* =========================================================================
     CAREGIVER REDESIGNED DASHBOARD (WITH MINIMAL COLLAPSIBLE SIDEBAR)
     ========================================================================= */
  return (
    <div className="min-h-screen soft-mesh-bg text-slate-900 flex flex-col md:flex-row antialiased selection:bg-purple-100 selection:text-purple-900">
      {/* =====================================================================
          1. MINIMAL COLLAPSIBLE SIDEBAR
          ===================================================================== */}
      <aside
        className={`relative shrink-0 border-r border-slate-200/80 bg-white/75 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between z-30 ${
          isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
        }`}
      >
        {/* Top Header & Brand */}
        <div className="p-4 border-b border-slate-200/60 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs shrink-0 hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col animate-in fade-in duration-200">
                <span className="font-bold tracking-tight text-sm text-slate-950 leading-tight">SafePay</span>
                <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">Caregiver Shield</span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="hidden md:flex p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Primary Navigation Items */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          {/* Nav Item: Overview */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
            }`}
            title="Overview"
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'overview' ? 'text-purple-400' : 'text-slate-500'}`} />
            {!isSidebarCollapsed && <span className="truncate">Overview</span>}
            {!isSidebarCollapsed && pendingApprovals.length > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {/* Nav Item: Elder Profiles */}
          <button
            onClick={() => setActiveTab('elders')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'elders'
                ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
            }`}
            title="Elder Profiles"
          >
            <Users className={`w-4 h-4 shrink-0 ${activeTab === 'elders' ? 'text-emerald-400' : 'text-slate-500'}`} />
            {!isSidebarCollapsed && <span className="truncate">Elder Profiles</span>}
            {!isSidebarCollapsed && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900">
                {linkedElders.length}
              </span>
            )}
          </button>

          {/* Nav Item: AI Assistant Chat */}
          <button
            onClick={() => setActiveTab('ai-chat')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'ai-chat'
                ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
            }`}
            title="AI Assistant Chat"
          >
            <Bot className={`w-4 h-4 shrink-0 ${activeTab === 'ai-chat' ? 'text-purple-400' : 'text-slate-500'}`} />
            {!isSidebarCollapsed && <span className="truncate">AI Assistant Chat</span>}
            {!isSidebarCollapsed && pendingApprovals.length > 0 && (
              <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* Nav Item: My Profile */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-slate-950 text-white shadow-md shadow-slate-950/10'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
            }`}
            title="My Profile"
          >
            <User className={`w-4 h-4 shrink-0 ${activeTab === 'profile' ? 'text-purple-400' : 'text-slate-500'}`} />
            {!isSidebarCollapsed && <span className="truncate">My Profile</span>}
          </button>

          {/* Connected Seniors Sub-List in Sidebar */}
          {!isSidebarCollapsed && linkedElders.length > 0 && (
            <div className="pt-4 space-y-1.5 animate-in fade-in duration-150">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Protected Seniors</span>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="hover:text-purple-600"
                  title="Add another senior"
                >
                  <UserPlus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1">
                {linkedElders.map((elder) => {
                  const hasHold = pendingApprovals.some(
                    (p) => p.elderName.toLowerCase() === elder.fullName.toLowerCase()
                  );
                  return (
                    <button
                      key={elder.id}
                      onClick={() => {
                        setSelectedElderId(elder.id);
                        if (activeTab === 'overview') setActiveTab('elders');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        activeElder?.id === elder.id
                          ? 'bg-purple-100/80 text-purple-950 font-bold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">{elder.fullName}</span>
                      </span>
                      {hasHold && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200/60 space-y-2">
          {/* Connect Elder Button */}
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/70 text-xs font-semibold transition-all active:scale-95"
            title="Invite Senior Member"
          >
            <UserPlus className="w-3.5 h-3.5 text-purple-600" />
            {!isSidebarCollapsed && <span>Invite Senior</span>}
          </button>

          {/* User Profile Mini Bar */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-200/50">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.fullName?.charAt(0) || 'C'}
              </div>
              {!isSidebarCollapsed && (
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">{currentUser?.fullName}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{currentUser?.email}</div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="p-1 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          2. MAIN CONTENT AREA
          ===================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 px-6 py-3.5 bg-white/70 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-950 capitalize">
                {activeTab === 'overview' && 'Live Oversight Overview'}
                {activeTab === 'elders' && 'Elder Accounts & Transaction Ledger'}
                {activeTab === 'ai-chat' && 'AI Assistant Workspace'}
                {activeTab === 'profile' && 'Caregiver Profile & Notification Settings'}
              </h1>
              <p className="text-[11px] text-slate-500">
                {activeTab === 'overview' && 'Real-time protection stats and pending family approval queue'}
                {activeTab === 'elders' && 'Interactive past transaction ledger, dropdown history, and limits'}
                {activeTab === 'ai-chat' && 'Deep RAG context assistant with integrated approval controls'}
                {activeTab === 'profile' && 'Manage your SMS approvals, notification channels, and backup contacts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {currentUser?.isSynthetic && (
              <div className="hidden sm:flex items-center bg-black/[0.04] p-1 rounded-full border border-black/5">
                <button
                  onClick={() => switchPersona('thomas')}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-slate-600 hover:text-slate-950"
                >
                  Mr. Thomas
                </button>
                <button
                  onClick={() => switchPersona('maya')}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-950 text-white shadow-xs"
                >
                  Maya
                </button>
              </div>
            )}

            {activeElder && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{activeElder.fullName} Protected</span>
              </span>
            )}
          </div>
        </header>

        {/* Global Action Notice Banner */}
        {actionNotice && (
          <div className="px-6 pt-3">
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in ${
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
              <button onClick={() => setActionNotice(null)} className="p-1 hover:bg-black/5 rounded-full">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Today&apos;s Spend
                </span>
                <div className="mt-2 text-2xl font-extrabold text-slate-950">
                  ${(activeElder?.todaySpend || 0).toFixed(2)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Daily Cap: ${(activeElder?.protectionSettings.absoluteDailyCap || 1000).toLocaleString()}
                </div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Auto-Approval Limit
                </span>
                <div className="mt-2 text-2xl font-extrabold text-purple-950">
                  ${(activeElder?.protectionSettings.familyApprovalThreshold || 100).toFixed(0)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Purchases over this hold for review</div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Monthly Target
                </span>
                <div className="mt-2 text-2xl font-extrabold text-blue-950">
                  ${(activeElder?.protectionSettings.monthlyBudget || 2000).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Monthly spending ceiling</div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Pending Approvals
                </span>
                <div className="mt-2 text-2xl font-extrabold text-slate-950 flex items-center gap-2">
                  <span>{pendingApprovals.length}</span>
                  {pendingApprovals.length > 0 && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      Needs Review
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Held PayPal orders</div>
              </div>
            </div>

            {/* Pending Approvals Review Section */}
            {pendingApprovals.length > 0 && (
              <div className="liquid-glass rounded-3xl p-6 border border-amber-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-950">
                        {pendingApprovals.length} Transaction{pendingApprovals.length > 1 ? 's' : ''} Awaiting Your Approval
                      </h3>
                      <p className="text-xs text-slate-500">Action is required before PayPal funds can be captured</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('ai-chat')}
                    className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    <span>Analyze with AI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {pendingApprovals.map((req) => (
                    <div
                      key={req.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3.5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-semibold text-purple-700">{req.elderName}</div>
                          <div className="text-base font-bold text-slate-950">{req.merchantName}</div>
                          <div className="text-xs text-slate-500">{req.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-extrabold text-slate-950">
                            ${req.amount.toFixed(2)} {req.currency}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.riskScore >= 70
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            Risk Score: {req.riskScore}/100
                          </span>
                        </div>
                      </div>

                      {req.explanation?.caregiverExplanation && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 leading-relaxed">
                          <strong>AI Assessment:</strong> {req.explanation.caregiverExplanation}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleDecision(req.id, 'APPROVED')}
                          disabled={decidingId === req.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve Payment</span>
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, 'DECLINED')}
                          disabled={decidingId === req.id}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Decline Payment</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Senior Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider">Connected Family Members</h3>
                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Invite Senior Member</span>
                </button>
              </div>

              {linkedElders.length === 0 ? (
                <div className="p-8 rounded-3xl bg-white/70 border border-slate-200/80 text-center space-y-3">
                  <UserPlus className="w-8 h-8 text-purple-600 mx-auto" />
                  <p className="text-xs text-slate-600">No senior members linked yet. Send an invitation to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {linkedElders.map((elder) => (
                    <div
                      key={elder.id}
                      className="liquid-glass rounded-2xl p-5 border border-white/80 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                            <Heart className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-950">{elder.fullName}</h4>
                            <p className="text-xs text-slate-500">
                              {elder.relationship} • {elder.city ? `${elder.city}, ${elder.primaryZipCode || ''}` : 'Local Baseline'}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Shield Active
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                        <div className="p-2 bg-white/80 rounded-xl border border-black/5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase block">Hold Limit</span>
                          <span className="font-bold text-purple-950 text-xs">
                            ${elder.protectionSettings.familyApprovalThreshold}
                          </span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-xl border border-black/5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase block">Daily Cap</span>
                          <span className="font-bold text-emerald-950 text-xs">
                            ${elder.protectionSettings.absoluteDailyCap}
                          </span>
                        </div>
                        <div className="p-2 bg-white/80 rounded-xl border border-black/5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase block">Monthly Budget</span>
                          <span className="font-bold text-blue-950 text-xs">
                            ${(elder.protectionSettings.monthlyBudget || 2000).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedElderId(elder.id);
                            setActiveTab('elders');
                          }}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition-all text-center"
                        >
                          Open Ledger
                        </button>
                        <button
                          onClick={() => {
                            setSelectedElderId(elder.id);
                            setActiveTab('ai-chat');
                          }}
                          className="py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-semibold transition-all flex items-center gap-1"
                        >
                          <Bot className="w-3.5 h-3.5 text-purple-600" />
                          <span>Chat AI</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ELDER PROFILES & TRANSACTION LEDGER */}
        {activeTab === 'elders' && (
          <div className="p-6 space-y-6">
            {/* Multi-Elder Selector Header */}
            {linkedElders.length > 1 && (
              <div className="flex items-center gap-2 p-1.5 bg-white/70 rounded-2xl border border-slate-200/80 w-fit">
                {linkedElders.map((elder) => (
                  <button
                    key={elder.id}
                    onClick={() => setSelectedElderId(elder.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeElder?.id === elder.id
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>{elder.fullName} ({elder.relationship})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Elder Profile Card */}
            {activeElder && (
              <div className="liquid-glass rounded-3xl p-6 border border-white/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shadow-2xs">
                      {activeElder.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-950">{activeElder.fullName}</h2>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {activeElder.relationship}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activeElder.phoneNumber || activeElder.email} • {activeElder.city ? `${activeElder.city}, ${activeElder.primaryZipCode || ''}` : 'Local Baseline'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openLimitsModal}
                      className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Adjust Safety Limits</span>
                    </button>
                  </div>
                </div>

                {/* Guardrails Overview Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                  <div className="p-3 bg-white/80 rounded-2xl border border-black/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Approval Threshold</span>
                    <span className="font-extrabold text-purple-950 text-sm">
                      ${(activeElder.protectionSettings.familyApprovalThreshold || 100).toFixed(0)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Held for review</span>
                  </div>
                  <div className="p-3 bg-white/80 rounded-2xl border border-black/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Daily Spend Cap</span>
                    <span className="font-extrabold text-emerald-950 text-sm">
                      ${(activeElder.protectionSettings.absoluteDailyCap || 1000).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">24h maximum</span>
                  </div>
                  <div className="p-3 bg-white/80 rounded-2xl border border-black/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Monthly Budget</span>
                    <span className="font-extrabold text-blue-950 text-sm">
                      ${(activeElder.protectionSettings.monthlyBudget || 2000).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Target ceiling</span>
                  </div>
                  <div className="p-3 bg-white/80 rounded-2xl border border-black/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Single Purchase Cap</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      ${(activeElder.protectionSettings.absoluteTransactionCap || 500).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Hard block</span>
                  </div>
                </div>

                {activeElder.emergencyContactName && (
                  <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs text-slate-600 px-1">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>
                        Emergency Backup: <strong>{activeElder.emergencyContactName}</strong> ({activeElder.emergencyContactPhone || 'No phone recorded'})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Comprehensive Transaction Ledger Section */}
            <div className="liquid-glass rounded-3xl p-6 border border-white/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-950">Past Transactions &amp; Audit Ledger</h3>
                  <p className="text-xs text-slate-500">
                    Detailed record of approved, held, and settled payments in expandable dropdown format
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Filter merchant or category..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-600/20"
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white/70 rounded-xl border border-slate-200/60 w-fit text-xs">
                {(['ALL', 'SETTLED', 'AWAITING_FAMILY', 'DECLINED'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setLedgerFilter(filterKey)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                      ledgerFilter === filterKey
                        ? 'bg-slate-950 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {filterKey === 'ALL' && 'All Transactions'}
                    {filterKey === 'SETTLED' && 'Settled / Approved'}
                    {filterKey === 'AWAITING_FAMILY' && 'Awaiting Approval'}
                    {filterKey === 'DECLINED' && 'Declined'}
                  </button>
                ))}
              </div>

              {/* Dropdown Ledger List */}
              {ledgerLoading ? (
                <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Loading transaction ledger...</span>
                </div>
              ) : filteredLedger.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-1">
                  <Store className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No transactions match the selected filter or search.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredLedger.map((tx) => {
                    const isExpanded = expandedLedgerId === tx.id;
                    const isHeld = tx.status === 'AWAITING_FAMILY';
                    return (
                      <div
                        key={tx.id}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isExpanded
                            ? 'bg-white border-purple-300 shadow-sm'
                            : 'bg-white/80 border-slate-200/70 hover:bg-white'
                        }`}
                      >
                        {/* Transaction Header Row (Clickable to toggle dropdown) */}
                        <div
                          onClick={() => setExpandedLedgerId(isExpanded ? null : tx.id)}
                          className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                tx.status === 'SETTLED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isHeld
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <Store className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-950">{tx.merchantName}</h4>
                                {tx.isTrusted && (
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                    Trusted
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{tx.category}</span>
                                <span>•</span>
                                <span>
                                  {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                                  {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <div className="text-right">
                              <div className="text-base font-extrabold text-slate-950">${tx.amount.toFixed(2)}</div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                  tx.status === 'SETTLED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isHeld
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {tx.status === 'SETTLED'
                                  ? 'Approved & Settled'
                                  : isHeld
                                  ? 'Held for Approval'
                                  : tx.status === 'DECLINED'
                                  ? 'Declined'
                                  : tx.status}
                              </span>
                            </div>

                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Dropdown Details Drawer */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-3.5 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">AI Risk Assessment</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900">
                                    {tx.riskAssessment?.score ?? 20} / 100
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      (tx.riskAssessment?.score ?? 20) >= 70
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {(tx.riskAssessment?.score ?? 20) >= 70 ? 'High Risk' : 'Low Risk'}
                                  </span>
                                </div>
                              </div>

                              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment ID</span>
                                <span className="font-mono text-slate-800 text-[11px] truncate block">{tx.id}</span>
                              </div>

                              <div className="p-3 bg-white rounded-xl border border-slate-200/60 space-y-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Processor</span>
                                <span className="font-semibold text-slate-800 text-xs block">PayPal Sandbox v2</span>
                              </div>
                            </div>

                            {/* Risk Assessment Explanations */}
                            {tx.riskAssessment?.caregiverExplanation && (
                              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/70 text-xs text-purple-950 space-y-1">
                                <div className="font-bold flex items-center gap-1.5 text-purple-900">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                  <span>AI Engine Context</span>
                                </div>
                                <p className="leading-relaxed text-slate-700">{tx.riskAssessment.caregiverExplanation}</p>
                              </div>
                            )}

                            {/* Actions if still pending */}
                            {isHeld && tx.approvalRequest && (
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-amber-900">
                                  Immediate family authorization is required for this charge.
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDecision(tx.approvalRequest!.id, 'APPROVED');
                                    }}
                                    disabled={decidingId === tx.approvalRequest.id}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                                  >
                                    Approve Now
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDecision(tx.approvalRequest!.id, 'DECLINED');
                                    }}
                                    disabled={decidingId === tx.approvalRequest.id}
                                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DEDICATED AI ASSISTANT CHAT (SPLIT SCREEN WORKSPACE) */}
        {activeTab === 'ai-chat' && (
          <div className="flex-1 flex flex-col md:flex-row h-full min-h-[calc(100vh-65px)]">
            {/* Left Elder Switcher Sidebar for AI Assistant */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200/80 bg-white/60 backdrop-blur-sm p-4 space-y-3 shrink-0">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Family Member</h3>
                <p className="text-[11px] text-slate-500">Each senior has their own AI context &amp; holds</p>
              </div>

              <div className="space-y-1.5">
                {linkedElders.map((elder) => {
                  const elderHolds = pendingApprovals.filter(
                    (p) => p.elderName.toLowerCase() === elder.fullName.toLowerCase()
                  );
                  const isSelected = activeElder?.id === elder.id;
                  return (
                    <button
                      key={elder.id}
                      onClick={() => setSelectedElderId(elder.id)}
                      className={`w-full text-left p-3 rounded-2xl transition-all border ${
                        isSelected
                          ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs truncate">{elder.fullName}</span>
                        {elderHolds.length > 0 && (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {elderHolds.length} Hold
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] mt-1 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {elder.relationship} • Cap: ${elder.protectionSettings.absoluteDailyCap}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Chat & Controls Main Pane */}
            <div className="flex-1 flex flex-col bg-white/40 justify-between min-w-0">
              {/* Active Elder Context Header */}
              {activeElder && (
                <div className="p-4 border-b border-slate-200/70 bg-white/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      {activeElder.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-950">
                        Monitoring: {activeElder.fullName} ({activeElder.relationship})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Auto-Approval: ${activeElder.protectionSettings.familyApprovalThreshold} • Daily Cap: $
                        {activeElder.protectionSettings.absoluteDailyCap} • Baseline: {activeElder.city || 'Local'}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                    Live RAG Active
                  </span>
                </div>
              )}

              {/* High-Priority In-Chat Approvals & Controls Card */}
              {activeElder && activeElderPendingApprovals.length > 0 && (
                <div className="p-4 bg-amber-50/80 border-b border-amber-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                      <span>Pending Transaction Approval for {activeElder.fullName}</span>
                    </div>
                    <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded-full font-bold">
                      Caregiver Decision Required
                    </span>
                  </div>

                  {activeElderPendingApprovals.map((hold) => (
                    <div
                      key={hold.id}
                      className="p-3.5 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-slate-900">{hold.merchantName}</span>
                          <span className="text-[11px] text-slate-500 block">{hold.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-extrabold text-slate-950">
                            ${hold.amount.toFixed(2)} {hold.currency}
                          </span>
                          <span className="text-[10px] font-bold text-rose-700 block">
                            Risk Score: {hold.riskScore}/100
                          </span>
                        </div>
                      </div>

                      {hold.explanation?.caregiverExplanation && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed">
                          {hold.explanation.caregiverExplanation}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleDecision(hold.id, 'APPROVED')}
                          disabled={decidingId === hold.id}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Payment</span>
                        </button>
                        <button
                          onClick={() => handleDecision(hold.id, 'DECLINED')}
                          disabled={decidingId === hold.id}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Decline Payment</span>
                        </button>
                        <button
                          onClick={() =>
                            handleSendChatMessage(`Why was the $${hold.amount.toFixed(0)} charge from ${hold.merchantName} held?`)
                          }
                          className="py-1.5 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold border border-purple-200 transition-all flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>Ask AI</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                {activeElder &&
                  (chatMessagesByElder[activeElder.id] || []).map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-slate-950 text-white shadow-xs rounded-br-xs'
                            : 'bg-white border border-slate-200/80 text-slate-800 shadow-2xs rounded-bl-xs'
                        }`}
                      >
                        <div className="whitespace-pre-line">{msg.content}</div>

                        {/* Draft SMS check-in box */}
                        {msg.draftMessage && (
                          <div className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200/70 text-purple-950 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-purple-900">
                              <span>Draft Check-In Message:</span>
                              <button
                                onClick={() => handleCopyDraft(msg.draftMessage!, msg.id)}
                                className="flex items-center gap-1 text-purple-700 hover:text-purple-950 transition-colors"
                              >
                                {copiedDraftId === msg.id ? (
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
                            <div className="font-mono text-[11px] bg-white p-2 rounded-lg border border-purple-200/40 text-slate-800">
                              &ldquo;{msg.draftMessage}&rdquo;
                            </div>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>

                      {/* Suggested quick reply chips */}
                      {msg.role === 'assistant' && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 max-w-xl">
                          {msg.suggestedActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendChatMessage(action)}
                              className="text-[11px] font-semibold text-purple-700 bg-white hover:bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200/70 transition-all shadow-2xs text-left"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 py-2 px-3 rounded-full w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>SafePay AI is analyzing records...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 bg-white/80 border-t border-slate-200/70">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="flex items-center gap-2 max-w-4xl mx-auto"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask anything about ${activeElder?.fullName || 'the senior'}'s payments, merchants, or fraud alerts...`}
                    className="flex-1 px-4 py-2.5 rounded-full bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-purple-600/20 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="p-2.5 rounded-full bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-40 transition-all shadow-xs shrink-0"
                    title="Send message"
                  >
                    <Send className="w-4 h-4 text-purple-400" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MY PROFILE (CAREGIVER) */}
        {activeTab === 'profile' && (
          <div className="p-6 max-w-3xl space-y-6">
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Caregiver Account Profile</h2>
                    <p className="text-xs text-slate-500">Primary family guardian and payment approver</p>
                  </div>
                </div>

                <button
                  onClick={openProfileModal}
                  className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Edit Profile</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Full Name / Display Name</span>
                  <span className="font-extrabold text-sm text-slate-950 block">{currentUser?.fullName}</span>
                </div>

                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Registered Email</span>
                  <span className="font-mono text-xs text-slate-900 block">{currentUser?.email}</span>
                </div>

                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Phone (SMS Approvals)</span>
                  <span className="font-mono text-xs text-slate-900 block">
                    {currentUser?.phoneNumber || (
                      <span className="text-amber-600 font-sans">Add mobile phone to receive 1-tap SMS approvals</span>
                    )}
                  </span>
                </div>

                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Preferred Alerts Channel</span>
                  <span className="font-bold text-purple-900 text-xs block">
                    {currentUser?.preferredNotification === 'SMS'
                      ? 'SMS Text Only'
                      : currentUser?.preferredNotification === 'EMAIL'
                      ? 'Email Only'
                      : 'Both SMS & Email (Fastest)'}
                  </span>
                </div>

                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Home Baseline Location</span>
                  <span className="font-semibold text-slate-800 text-xs block flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentUser?.city ? `${currentUser.city}, ${currentUser.primaryZipCode || ''}` : 'Local Baseline'}</span>
                  </span>
                </div>

                <div className="p-4 bg-white/80 rounded-2xl border border-slate-200/60 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Emergency Backup Guardian</span>
                  <span className="font-semibold text-slate-800 text-xs block">
                    {currentUser?.emergencyContactName
                      ? `${currentUser.emergencyContactName} (${currentUser.emergencyContactPhone || 'No phone'})`
                      : 'Not configured'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          3. MODALS
          ===================================================================== */}

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
              <div className="space-y-5 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-950">Invitation Ready for {createdInvite.elderName}</h3>
                  <p className="text-xs text-slate-600">
                    SafePay requires <strong className="text-slate-900">{createdInvite.elderName}</strong> to accept your family invitation before financial oversight begins.
                  </p>
                </div>

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
                      onClick={copyInviteToClipboard}
                      className="px-4 py-2.5 rounded-xl bg-slate-950 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                    >
                      {copiedInvite ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsConnectModalOpen(false);
                    setCreatedInvite(null);
                  }}
                  className="w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-950">Add Senior Loved One</h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Send a consent-gated invitation link to connect your elderly family member.
                  </p>
                </div>

                {connectError && (
                  <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium">
                    {connectError}
                  </div>
                )}

                <form onSubmit={handleConnectElder} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senior&apos;s Full Name:
                    </label>
                    <input
                      type="text"
                      required
                      value={connectName}
                      onChange={(e) => setConnectName(e.target.value)}
                      placeholder="e.g. Thomas Vance"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senior&apos;s Email Address:
                    </label>
                    <input
                      type="email"
                      required
                      value={connectEmail}
                      onChange={(e) => setConnectEmail(e.target.value)}
                      placeholder="thomas@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship:</label>
                    <select
                      value={connectRelationship}
                      onChange={(e) => setConnectRelationship(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                    >
                      <option value="Parent">Parent (Mother / Father)</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Spouse">Spouse / Partner</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other">Other Family Member</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Approval Threshold ($)</label>
                      <input
                        type="number"
                        value={connectThreshold}
                        onChange={(e) => setConnectThreshold(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Daily Cap ($)</label>
                      <input
                        type="number"
                        value={connectDailyCap}
                        onChange={(e) => setConnectDailyCap(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                      />
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
                      <span>Issue Invitation &amp; Generate Link</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* CAREGIVER PROFILE EDIT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-white shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-black/5 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">Edit Caregiver Profile</h3>
              </div>
              <p className="text-xs text-slate-600">
                Update your display name, SMS approval phone number, and alert channels.
              </p>
            </div>

            {profileError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium">
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Full Name / Display Username:
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Rijuraj Datta or Alex"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Email Address:</label>
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-slate-600 text-xs font-mono">
                  {currentUser?.email}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone (for SMS Approvals):
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="e.g. +1 (555) 234-5678"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Used for 1-click SMS decision links.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alerts Channel:</label>
                  <select
                    value={profileNotification}
                    onChange={(e) => setProfileNotification(e.target.value as 'BOTH' | 'SMS' | 'EMAIL')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  >
                    <option value="BOTH">Both SMS &amp; Email</option>
                    <option value="SMS">SMS Text Only</option>
                    <option value="EMAIL">Email Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary City:</label>
                  <input
                    type="text"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="e.g. Austin"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Zip Code:</label>
                  <input
                    type="text"
                    value={profileZip}
                    onChange={(e) => setProfileZip(e.target.value)}
                    placeholder="e.g. 78701"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Emergency Backup Guardian (Optional):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={profileEmergencyName}
                    onChange={(e) => setProfileEmergencyName(e.target.value)}
                    placeholder="Contact Name (e.g. Aunt Sarah)"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                  <input
                    type="tel"
                    value={profileEmergencyPhone}
                    onChange={(e) => setProfileEmergencyPhone(e.target.value)}
                    placeholder="Contact Phone"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={profileSaving || !profileName.trim()}
                  className="flex-1 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {profileSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Save Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFETY LIMITS & GUARDRAILS MODAL */}
      {isLimitsModalOpen && activeElder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-white shadow-2xl relative space-y-5">
            <button
              onClick={() => setIsLimitsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-black/5 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Adjust Safety Limits for {activeElder.fullName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Fine-tune financial guardrails, automated hold thresholds, and fraud alerts.
                  </p>
                </div>
              </div>
            </div>

            {limitsError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium">
                {limitsError}
              </div>
            )}

            <form onSubmit={handleSaveLimits} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Family Approval Threshold ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="10"
                      step="5"
                      value={limitThreshold}
                      onChange={(e) => setLimitThreshold(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Transactions over this hold for review
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Daily Maximum Cap ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="50"
                      step="25"
                      value={limitDailyCap}
                      onChange={(e) => setLimitDailyCap(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Cumulative limit across 24 hours
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Monthly Budget ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="100"
                      step="50"
                      value={limitMonthlyBudget}
                      onChange={(e) => setLimitMonthlyBudget(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Target monthly spending ceiling
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Absolute Single Transaction Ceiling ($):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="50"
                      step="50"
                      value={limitTransactionCap}
                      onChange={(e) => setLimitTransactionCap(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-purple-600 outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Hard block limit for any single purchase
                  </span>
                </div>
              </div>

              {/* Guardrails Checkboxes */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={limitNewMerchant}
                    onChange={(e) => setLimitNewMerchant(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-semibold text-slate-800">
                      Require approval for first-time or unknown merchants
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Stops initial checkout at newly visited shops until verified.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={limitUnusual}
                    onChange={(e) => setLimitUnusual(e.target.checked)}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-semibold text-slate-800">
                      AI Anomaly &amp; Off-Hours Fraud Protection
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Flags irregular midnight spending or suspicious recipient patterns.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={limitsSaving}
                  className="flex-1 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {limitsSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Save Limits &amp; Apply Guardrails</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLimitsModalOpen(false)}
                  className="px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
