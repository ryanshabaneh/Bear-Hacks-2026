import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ClientDashboard() {
  const session = await getSession();
  if (!session) return null;

  const client = await prisma.client.findUnique({
    where: { userId: session.userId },
    include: { jobs: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Client dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          {client?.displayName ?? session.email} · ${(client?.balanceCents ?? 0) / 100} balance
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Forecasts" value={client?.jobs.length ?? 0} />
        <Stat label="Active" value={client?.jobs.filter((j) => j.status !== 'done').length ?? 0} />
        <Stat label="Completed" value={client?.jobs.filter((j) => j.status === 'done').length ?? 0} />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-medium">Forecast Composer</h2>
        <p className="text-sm text-slate-400 mt-2">
          Audio upload, Gemma-translated job spec, and live Catchment streaming wire up in Phase 2-3.
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
