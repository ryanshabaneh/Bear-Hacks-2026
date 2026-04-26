import Link from 'next/link';
import { LogoutButton } from './LogoutButton';

export function AppShell({
  role,
  email,
  children,
}: {
  role: 'distributor' | 'client';
  email: string;
  children: React.ReactNode;
}) {
  const nav =
    role === 'distributor'
      ? [
          { href: '/distributor', label: 'Overview' },
          { href: '/distributor/sites', label: 'Sites' },
        ]
      : [
          { href: '/client', label: 'Overview' },
          { href: '/client/forecasts', label: 'Forecasts' },
          { href: '/client/forecasts/new', label: 'New Forecast' },
        ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Strata
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs uppercase tracking-widest">
              {role}
            </span>
            <span className="text-slate-400 hidden sm:inline">{email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        <nav className="flex md:flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
