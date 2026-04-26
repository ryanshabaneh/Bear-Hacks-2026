'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignupButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<'distributor' | 'client' | null>(null);

  async function stubLogin(role: 'distributor' | 'client') {
    setBusy(role);
    try {
      const res = await fetch('/api/auth/stub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email: `${role}@demo.strata.app` }),
      });
      if (!res.ok) {
        console.error('stub login failed', await res.text());
        setBusy(null);
        return;
      }
      router.push(`/${role}`);
      router.refresh();
    } catch (err) {
      console.error('stub login error', err);
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={() => stubLogin('distributor')}
        disabled={busy !== null}
        className="rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-100 px-5 py-4 text-left transition disabled:opacity-50"
      >
        <div className="text-base font-medium">Continue as Distributor</div>
        <div className="text-xs text-slate-400 mt-1">
          {busy === 'distributor' ? 'Signing in…' : 'Host the embed, earn 68% revenue'}
        </div>
      </button>
      <button
        onClick={() => stubLogin('client')}
        disabled={busy !== null}
        className="rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-100 px-5 py-4 text-left transition disabled:opacity-50"
      >
        <div className="text-base font-medium">Continue as Client</div>
        <div className="text-xs text-slate-400 mt-1">
          {busy === 'client' ? 'Signing in…' : 'Submit Forecasts, get transcripts back'}
        </div>
      </button>
    </div>
  );
}
