import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { CycleBudgetMeter } from "@/components/cirrus/signature/CycleBudgetMeter";
import { CapabilityBloom } from "@/components/cirrus/signature/CapabilityBloom";
import { ForecastDetailLive } from "./ForecastDetailLive";

export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client") redirect("/distributor");

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    include: {
      slices: { orderBy: [{ chunkIndex: "asc" }, { attemptNumber: "asc" }] },
      catchment: true,
    },
  });

  if (!forecast) notFound();
  if (forecast.clientId !== session.user.clientId) redirect("/client");

  const slicesTotal = new Set(forecast.slices.map((s) => s.chunkIndex)).size;
  const completedSlices = forecast.slices.filter((s) => s.status === "completed");

  const initialSnapshot = {
    id: forecast.id,
    status: forecast.status,
    audioHoursTotal: forecast.audioHoursTotal,
    budgetCents: forecast.budgetCents,
    budgetCyclesUsed: forecast.budgetCyclesUsed,
    slicesTotal,
    completedSlices: completedSlices.map((s) => ({
      chunkIndex: s.chunkIndex,
      timestampStart: s.timestampStart,
      timestampEnd: s.timestampEnd,
      text: s.outputText ?? undefined,
      arrivedAt: s.completedAt?.getTime() ?? Date.now(),
    })),
    catchment: forecast.catchment
      ? {
          bundleUrl: forecast.catchment.bundleUrl,
          slicesCompleted: forecast.catchment.slicesCompleted,
        }
      : null,
  };

  const totalKilocycles = Math.max(1, Math.round(forecast.budgetCents / 2.9));

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-6 pt-2">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <UnitLabel>Forecast · {forecast.id.slice(-4).toUpperCase()}</UnitLabel>
            <h1 className="cirrus-text-h1">
              {Math.round(forecast.audioHoursTotal * 60)} min audio
            </h1>
          </div>
          <StatusPill status={forecast.status} />
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          <ForecastDetailLive
            forecastId={forecast.id}
            slicesTotal={slicesTotal}
            initialCompleted={initialSnapshot.completedSlices}
          />
          <div className="flex flex-col gap-4">
            <CycleBudgetMeter
              remaining={Math.max(0, totalKilocycles - Math.round(forecast.budgetCyclesUsed))}
              total={totalKilocycles}
              costPerKc={0.029}
              forecastId={forecast.id.slice(-4)}
            />
            <CapabilityBloom
              totalNodes={47}
              capabilities={{
                WEBGPU: 31,
                AUDIO: 47,
                HEAP_1GB: 38,
                WASM: 16,
                EN_OK: 47,
                F32: 47,
              }}
            />
          </div>
        </section>

        <CostComparePanel audioHours={forecast.audioHoursTotal} />
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "queued") return <Pill tone="neutral">Queued</Pill>;
  if (status === "active") return <Pill tone="coral">Front open</Pill>;
  if (status === "sealing") return <Pill tone="butter">Catchment sealing</Pill>;
  if (status === "sealed") return <Pill tone="sage">Catchment sealed</Pill>;
  if (status === "failed") return <Pill tone="coral">Failed</Pill>;
  return <Pill tone="neutral">{status}</Pill>;
}

function CostComparePanel({ audioHours }: { audioHours: number }) {
  const rows: Array<{ name: string; rate: number; emphasis?: boolean; muted?: boolean }> = [
    { name: "Strata", rate: 0.04, emphasis: true },
    { name: "AssemblyAI", rate: 0.12 },
    { name: "Whisper API", rate: 0.36 },
    { name: "Rev AI", rate: 1.2 },
    { name: "Rev human", rate: 90, muted: true },
  ];
  return (
    <section className="cirrus-card p-4 flex flex-col gap-2 max-w-[480px]">
      <UnitLabel>Cost · live</UnitLabel>
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between cirrus-text-mono-id"
          style={{ opacity: row.muted ? 0.5 : 1 }}
        >
          <span style={{ fontWeight: row.emphasis ? 500 : 400, color: row.emphasis ? "var(--color-coral-700)" : undefined }}>
            {row.name}
          </span>
          <span className="cirrus-num" style={{ fontWeight: row.emphasis ? 500 : 400 }}>
            ${(audioHours * row.rate).toFixed(3)}
          </span>
        </div>
      ))}
    </section>
  );
}
