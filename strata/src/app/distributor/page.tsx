import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DistributorDashboard() {
  const session = await getSession();
  if (!session) return null;

  const distributor = await prisma.distributor.findUnique({
    where: { userId: session.userId },
    include: { sites: true, slots: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Distributor dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          {distributor?.displayName ?? session.email} · 68% revenue share
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Sites" value={distributor?.sites.length ?? 0} />
        <Stat label="Compute slots" value={distributor?.slots.length ?? 0} />
        <Stat label="Sky right now" value="—" hint="Live in Phase 3" />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-medium">SliceTicker</h2>
        <p className="text-sm text-slate-400 mt-2">
          Live earnings stream wires up in Phase 3 (SSE on{' '}
          <code className="text-xs">/api/distributors/{session.userId}/stream</code>).
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
