'use client';

import React, { useState } from 'react';
import { DemoPersonaKey, SessionUser } from '@/types';
import { Shield, Eye, CheckCircle2 } from 'lucide-react';

interface DemoPersonaBarProps {
  currentUser: SessionUser | null;
  onPersonaSwitched?: (user: SessionUser) => void;
}

const PERSONAS: Array<{
  key: DemoPersonaKey;
  label: string;
  sublabel: string;
  role: string;
  badgeColor: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'thomas',
    label: 'Mr. Thomas',
    sublabel: 'Protected Elder',
    role: 'Protected User',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: <Shield className="w-3.5 h-3.5 text-emerald-700" />,
  },
  {
    key: 'maya',
    label: 'Maya',
    sublabel: 'Daughter (Approver)',
    role: 'Caregiver (Approver)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />,
  },
  {
    key: 'david',
    label: 'David',
    sublabel: 'Son (Approver)',
    role: 'Caregiver (Approver)',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />,
  },
  {
    key: 'sarah',
    label: 'Sarah',
    sublabel: 'Granddaughter (View-Only)',
    role: 'Caregiver (Auditor)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: <Eye className="w-3.5 h-3.5 text-amber-700" />,
  },
];

export function DemoPersonaBar({ currentUser, onPersonaSwitched }: DemoPersonaBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSwitch = async (key: DemoPersonaKey) => {
    setLoading(key);
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: key }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        if (onPersonaSwitched) {
          onPersonaSwitched(data.user);
        } else {
          window.location.reload();
        }
      } else {
        alert(data.error || 'Failed to switch demo persona');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      alert(`Network error: ${msg}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 text-xs px-4 py-2 border-b border-slate-800 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wider uppercase text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
            Hackathon Demo Mode
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Switch authenticated persona to test server-side role enforcement:
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {PERSONAS.map((p) => {
            const isActive = currentUser?.email.includes(p.key);
            const isPending = loading === p.key;

            return (
              <button
                key={p.key}
                onClick={() => handleSwitch(p.key)}
                disabled={isPending}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all font-medium border text-xs ${
                  isActive
                    ? 'bg-slate-800 text-white border-blue-500 shadow-sm ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                title={`Switch to ${p.label} - ${p.sublabel}`}
              >
                {p.icon}
                <span>{p.label}</span>
                <span className="text-[10px] text-slate-400 hidden lg:inline">({p.sublabel})</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
