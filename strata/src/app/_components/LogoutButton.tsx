'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/stub/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-xs text-slate-400 hover:text-slate-100 transition"
    >
      Sign out
    </button>
  );
}
