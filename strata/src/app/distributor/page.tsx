import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDistributorStats } from "@/lib/payments/balance";
import { DistributorOnboardingModal } from "@/components/onboarding/DistributorOnboardingModal";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { MonoNumber } from "@/components/cirrus/primitives/MonoNumber";
import { SliceTicker } from "@/components/cirrus/signature/SliceTicker";
import { CycleBudgetMeter } from "@/components/cirrus/signature/CycleBudgetMeter";
import { CapabilityBloom } from "@/components/cirrus/signature/CapabilityBloom";
import { CatchmentAssembling } from "@/components/cirrus/signature/CatchmentAssembling";
import { FrontOpening } from "@/components/cirrus/signature/FrontOpening";
import { AttestationReceipt } from "@/components/cirrus/signature/AttestationReceipt";

export default async function DistributorDashboard() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=distributor");
  if (session.user.role !== "distributor" || !session.user.distributorId) {
    redirect("/client");
  }

  const [distributor, stats, recentAttestations] = await Promise.all([
    prisma.distributor.findUnique({
      where: { id: session.user.distributorId },
    }),
    getDistributorStats(session.user.distributorId),
    prisma.attestation.findMany({
      take: 3,
      orderBy: { id: "desc" },
      include: { slice: true },
    }),
  ]);

  const displayName = distributor?.displayName ?? "Distributor";
  const showOnboarding = !distributor?.onboardedAt;
  const isSlopify = displayName.toLowerCase() === "slopify";
  const networkLabel = isSlopify ? "Slopify-PCN" : "Public Sky";
  const todayUsd = (stats.earningsMonthCents / 100).toFixed(2);
  const skyDensity = Math.min(99, 60 + (stats.forecastsContributed % 40));

  return (
    <AppShell role="distributor" email={session.user.email}>
      <div className="flex flex-col gap-6 pt-2">
        <SliceTicker liveDemoFallback className="self-start" />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Audio-hours served · MO</UnitLabel>
            <MonoNumber className="cirrus-text-display">
              {stats.audioHoursMonth.toFixed(1)}
            </MonoNumber>
          </div>
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Sky density · 1HR rolling</UnitLabel>
            <MonoNumber
              className="cirrus-text-display"
              style={{ color: "var(--color-coral-500)" }}
            >
              {skyDensity}%
            </MonoNumber>
          </div>
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Earnings · MO · USD</UnitLabel>
            <MonoNumber className="cirrus-text-display">${todayUsd}</MonoNumber>
          </div>
        </section>

        <section className="cirrus-card p-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <UnitLabel>Compute network</UnitLabel>
            <MonoNumber className="cirrus-text-h2">{networkLabel}</MonoNumber>
          </div>
          <span
            className={
              isSlopify ? "cirrus-pill cirrus-pill-coral" : "cirrus-pill cirrus-pill-neutral"
            }
          >
            {isSlopify ? "Private compute group · v1 attribution" : "Public network"}
          </span>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <FrontOpening
            forecastId="j3f"
            title={`${displayName} · live transcription`}
            status="active"
            cyclesDispatching={120}
            nodes={47}
            etaMinMin={4}
            etaMaxMin={7}
          />
          <CycleBudgetMeter
            remaining={812}
            total={1000}
            costPerKc={0.029}
            forecastId="j3f"
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <CatchmentAssembling
            forecastId="j3f"
            slicesTotal={60}
            slicesCompleted={[
              { chunkIndex: 0, timestampStart: 0, timestampEnd: 30, arrivedAt: 0 },
              { chunkIndex: 1, timestampStart: 30, timestampEnd: 60, arrivedAt: 0 },
              { chunkIndex: 2, timestampStart: 60, timestampEnd: 90, arrivedAt: 0 },
              { chunkIndex: 3, timestampStart: 90, timestampEnd: 120, arrivedAt: 0 },
            ]}
            latestLine={{
              timestamp: "00:01:30",
              text: "and that's where we picked up the trail of–",
            }}
          />
          <CapabilityBloom
            totalNodes={47}
            capabilities={{
              WASM_SIMD: 47,
              AUDIO_PCM: 47,
              ENGLISH_OK: 47,
              ONNX_INT8: 47,
              KV_CACHE: 47,
              F32: 47,
            }}
          />
        </section>

        <section className="flex flex-col gap-2">
          <UnitLabel>Recent attestations</UnitLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentAttestations.map((a) => (
              <AttestationReceipt
                key={a.id}
                attestation={{
                  sliceTimestampStart: a.slice.timestampStart,
                  sliceTimestampEnd: a.slice.timestampEnd,
                  outputHash: a.outputHash.slice(0, 12),
                  nodeRegion: a.nodeRegionGlyph,
                  cyclesConsumed: a.slice.cyclesConsumed ?? 0,
                  quorum: { k: 2, agreed: true },
                  oracleSampled: false,
                  schedulerSig: "valid",
                }}
              />
            ))}
          </div>
        </section>
      </div>
      {showOnboarding ? <DistributorOnboardingModal /> : null}
    </AppShell>
  );
}
