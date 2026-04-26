import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDistributorBalance } from "@/lib/payments/balance";
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
  if (session.user.role !== "distributor") redirect("/client");

  const balance = session.user.distributorId
    ? await getDistributorBalance(session.user.distributorId)
    : { todayCents: 0, lifetimeCents: 0 };
  const todayUsd = (balance.todayCents / 100).toFixed(2);

  return (
    <AppShell role="distributor" email={session.user.email}>
      <div className="flex flex-col gap-6 pt-2">
        <SliceTicker liveDemoFallback className="self-start" />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Audio-hours served · MO</UnitLabel>
            <MonoNumber className="cirrus-text-display">1,247</MonoNumber>
          </div>
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Sky density · 1HR rolling</UnitLabel>
            <MonoNumber className="cirrus-text-display" style={{ color: "var(--color-coral-500)" }}>
              94%
            </MonoNumber>
          </div>
          <div className="cirrus-card p-4 flex flex-col gap-2">
            <UnitLabel>Earnings · day · USD</UnitLabel>
            <MonoNumber className="cirrus-text-display">${todayUsd}</MonoNumber>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <FrontOpening
            forecastId="j3f"
            title="Lighthouse Studio · 4 episodes"
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
              { chunkIndex: 0, timestampStart: 0, timestampEnd: 30, arrivedAt: Date.now() - 60_000 },
              { chunkIndex: 1, timestampStart: 30, timestampEnd: 60, arrivedAt: Date.now() - 50_000 },
              { chunkIndex: 2, timestampStart: 60, timestampEnd: 90, arrivedAt: Date.now() - 30_000 },
              { chunkIndex: 3, timestampStart: 90, timestampEnd: 120, arrivedAt: Date.now() - 800 },
            ]}
            latestLine={{ timestamp: "00:01:30", text: "and that's where we picked up the trail of–" }}
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
        </section>

        <section className="flex flex-col gap-2">
          <UnitLabel>Recent attestations</UnitLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <AttestationReceipt
              attestation={{
                sliceTimestampStart: 0,
                sliceTimestampEnd: 30,
                outputHash: "a3f8d2c891c2",
                nodeRegion: "NA",
                cyclesConsumed: 14,
                quorum: { k: 2, agreed: true },
                oracleSampled: false,
                schedulerSig: "valid",
              }}
            />
            <AttestationReceipt
              attestation={{
                sliceTimestampStart: 30,
                sliceTimestampEnd: 60,
                outputHash: "b8e4f9a317d6",
                nodeRegion: "EU",
                cyclesConsumed: 13,
                quorum: { k: 2, agreed: true },
                oracleSampled: true,
                oracleAgreed: true,
                schedulerSig: "valid",
              }}
            />
            <AttestationReceipt
              attestation={{
                sliceTimestampStart: 60,
                sliceTimestampEnd: 90,
                outputHash: "c2a1d4f6e802",
                nodeRegion: "NA",
                cyclesConsumed: 15,
                quorum: { k: 2, agreed: true },
                oracleSampled: false,
                schedulerSig: "valid",
              }}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
