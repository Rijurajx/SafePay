'use client';

import React, { useEffect, useState } from 'react';
import { DemoPersonaBar } from '@/components/shared/DemoPersonaBar';
import { Navbar } from '@/components/shared/Navbar';
import { SessionUser } from '@/types';
import {
  Shield,
  ShieldCheck,
  Users,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  ArrowRight,
  Database,
  Lock,
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
  const [loading, setLoading] = useState(true);
  const [caregiverLinks, setCaregiverLinks] = useState<FamilyLinkData[]>([]);
  const [elderLinks, setElderLinks] = useState<FamilyLinkData[]>([]);
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
    setLoading(true);
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
      setLoading(false);
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

  const isThomas = user?.email.includes('thomas');
  const isMaya = user?.email.includes('maya');
  const isDavid = user?.email.includes('david');
  const isSarah = user?.email.includes('sarah');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DemoPersonaBar currentUser={user} onPersonaSwitched={() => refreshSession()} />
      <Navbar user={user} onLogout={() => refreshSession()} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Loading authenticated session...
            </div>
          </div>
        ) : !user ? (
          /* Unauthenticated Landing */
          <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Milestone 1: Core Foundation & Secure Auth</h1>
            <p className="text-slate-600 mb-6 text-sm">
              The Next.js 15 App Router, PostgreSQL database schema with compound foreign keys, and role-independent
              authorization engine are fully operational. Select a synthetic persona to begin:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-6">
              <button
                onClick={() => {
                  fetch('/api/auth/demo-switch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ persona: 'thomas' }),
                  }).then(() => refreshSession());
                }}
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Mr. Thomas
                  </div>
                  <div className="text-xs text-slate-500">Protected User (Elder)</div>
                  <div className="text-xs text-emerald-700 font-medium mt-1">High-contrast, dignity-first UI</div>
                </div>
              </button>

              <button
                onClick={() => {
                  fetch('/api/auth/demo-switch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ persona: 'maya' }),
                  }).then(() => refreshSession());
                }}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Maya</div>
                  <div className="text-xs text-slate-500">Daughter (Primary Caregiver)</div>
                  <div className="text-xs text-blue-700 font-medium mt-1">Full approval & settings authority</div>
                </div>
              </button>

              <button
                onClick={() => {
                  fetch('/api/auth/demo-switch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ persona: 'david' }),
                  }).then(() => refreshSession());
                }}
                className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">David</div>
                  <div className="text-xs text-slate-500">Son (Co-Caregiver)</div>
                  <div className="text-xs text-indigo-700 font-medium mt-1">First-response approval rights</div>
                </div>
              </button>

              <button
                onClick={() => {
                  fetch('/api/auth/demo-switch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ persona: 'sarah' }),
                  }).then(() => refreshSession());
                }}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">Sarah</div>
                  <div className="text-xs text-slate-500">Granddaughter (View-Only)</div>
                  <div className="text-xs text-amber-700 font-medium mt-1">Auditor: Approvals blocked server-side</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div className="space-y-6">
            {/* Top Welcome Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Welcome back, {user.fullName}
                  </h1>
                  {user.isSynthetic && (
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                      Synthetic Demo Account
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Authenticated User ID: <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{user.id}</code>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>PostgreSQL Database Connected & Migrated</span>
              </div>
            </div>

            {/* Persona Specific View */}
            {isThomas ? (
              /* Mr. Thomas - Elder Accessible View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dignity & Independence Status Card */}
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-500 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Your Account is Protected</h2>
                      <p className="text-sm text-emerald-700 font-medium">Independent Spending Enabled</p>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                    You can make everyday purchases independently without interruptions. Unusual transactions or new
                    merchants will be reviewed with your trusted family for your safety.
                  </p>

                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 space-y-2 text-sm">
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Daily Protection Limit:</span>
                      <span className="font-bold text-slate-900">$2,500.00 USD</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Family Review Threshold:</span>
                      <span className="font-bold text-slate-900">&gt; $100.00 USD</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span>New Merchant Policy:</span>
                      <span className="font-bold text-emerald-800">Family Oversight Active</span>
                    </div>
                  </div>
                </div>

                {/* Family Circle Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Users className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Your Trusted Family Circle</h2>
                      <p className="text-sm text-slate-500">Caregivers with designated permissions</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {elderLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{link.caregiver?.fullName}</div>
                          <div className="text-xs text-slate-500">{link.relationship}</div>
                        </div>
                        <div>
                          {link.permission?.canApprovePayments ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Approver
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View Only
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Caregiver Relationship Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Key className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Caregiver Authority & Relationship</h2>
                      <p className="text-sm text-slate-500">Enforced by database relations, not user roles</p>
                    </div>
                  </div>

                  {caregiverLinks.length > 0 ? (
                    <div className="space-y-4">
                      {caregiverLinks.map((link) => (
                        <div key={link.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Protected Elder
                              </div>
                              <div className="font-bold text-slate-900 text-base">{link.elder?.fullName}</div>
                              <div className="text-xs text-slate-500">{link.relationship}</div>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                              Active Link
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Can View Transactions:</span>
                              {link.permission?.canViewTransactions ? (
                                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                                </span>
                              ) : (
                                <span className="font-semibold text-rose-700 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> Denied
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Can Approve Payments:</span>
                              {link.permission?.canApprovePayments ? (
                                <span className="font-semibold text-blue-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Authorized
                                </span>
                              ) : (
                                <span className="font-semibold text-amber-700 flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> View-Only (Restricted)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Can Manage Settings:</span>
                              {link.permission?.canManageSettings ? (
                                <span className="font-semibold text-indigo-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-500">Not Granted</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No active elder relationship links found.</div>
                  )}
                </div>

                {/* Interactive Server-Side Permission Verification Sandbox */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Server Authorization Sandbox</h2>
                        <p className="text-sm text-slate-500">Live API authorization check</p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      Click below to make a live API call to{' '}
                      <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">
                        POST /api/approvals/test-authorize
                      </code>{' '}
                      as <span className="font-semibold">{user.fullName}</span>.
                    </p>

                    {isSarah && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Sarah is View-Only:</strong> The server will reject this
                          request with <strong className="font-semibold">HTTP 403 Forbidden</strong> because her
                          relational permission explicitly denies payment approvals.
                        </div>
                      </div>
                    )}

                    {(isMaya || isDavid) && (
                      <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Authorized Approver:</strong> The server will validate your
                          active <code className="font-mono">FamilyLink</code> and authorize the action with{' '}
                          <strong className="font-semibold">HTTP 200 OK</strong>.
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <button
                      onClick={handleTestApprovalPermission}
                      disabled={testLoading}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {testLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Server Permissions...</span>
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
                        className={`mt-4 p-4 rounded-xl border text-xs space-y-1 ${
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
            )}

            {/* Architecture Invariants Status Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Milestone 1 Architecture Verification Summary</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-900 mb-1">PostgreSQL & Prisma 6</div>
                  <p className="text-slate-600">
                    Native UUID keys, composite foreign keys on Recipient & PaymentRequest, and exact Decimal(12,2)
                    handling.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-900 mb-1">Role-Independent Access</div>
                  <p className="text-slate-600">
                    Permissions are strictly derived from relational <code className="font-mono">FamilyLink</code>{' '}
                    records, never raw user labels.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-semibold text-slate-900 mb-1">Synthetic Persona Switcher</div>
                  <p className="text-slate-600">
                    Switches authenticated sessions via signed HTTP-only cookies; prohibited in production mode.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
