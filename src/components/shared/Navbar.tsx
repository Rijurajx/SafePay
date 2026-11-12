'use client';

import React from 'react';
import { SessionUser } from '@/types';
import { Shield, LogOut, CheckCircle2, Eye, User } from 'lucide-react';
import { SafePayLogo } from '@/components/brand/SafePayLogo';

interface NavbarProps {
  user: SessionUser | null;
  onLogout?: () => void;
}

export function Navbar({ user, onLogout }: NavbarProps) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <SafePayLogo size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-lg tracking-tight">SafePay</span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              A little shelter for every payment.
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.fullName}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>

              {/* Dynamic Role Badge */}
              {user.email.includes('thomas') && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <Shield className="w-3.5 h-3.5" />
                  Protected User
                </span>
              )}
              {user.email.includes('maya') && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Caregiver (Approver)
                </span>
              )}
              {user.email.includes('david') && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Caregiver (Approver)
                </span>
              )}
              {user.email.includes('sarah') && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  <Eye className="w-3.5 h-3.5" />
                  Caregiver (View-Only)
                </span>
              )}

              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>Not logged in (Use demo switcher above)</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
