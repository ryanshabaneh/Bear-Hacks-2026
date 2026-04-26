import { prisma } from "@/lib/db/prisma";
import { publishForecast, publishDistributor } from "@/lib/sse/bus";

const REGIONS = ["NA-east", "NA-west", "EU", "APAC"] as const;
const DEMO_LINES = [
  "and that's where we picked up the trail of–",
  "we kept walking even though the path was unfamiliar.",
  "the air felt thinner up there, but somehow clearer.",
  "she said it like it was the most obvious thing in the world.",
  "by the time we got back, the sky had turned coral.",
  "no one expected it would take that long to seal.",
  "the recording cuts in here — bear with me.",
  "what surprised me most was how quiet everything got.",
];

export type DispatchOptions = {
  forecastId: string;
  distributorIds?: string[];
};

export async function dispatchForecast({ forecastId, distributorIds = [] }: DispatchOptions): Promise<void> {
  const workerUrl = process.env.DCP_SUBMIT_WORKER_URL;
  const sharedSecret = process.env.DCP_WORKER_SHARED_SECRET;
  const mode = (process.env.DCP_MODE ?? "demo").toLowerCase();

  if (mode === "live" && workerUrl && sharedSecret) {
    await dispatchToWorker(forecastId, workerUrl, sharedSecret);
    return;
  }

  void runDemoReplay(forecastId, distributorIds).catch((err) => {
    console.error("[dispatch] demo replay error", err);
  });
}

async function dispatchToWorker(forecastId: string, workerUrl: string, sharedSecret: string) {
  const forecast = await prisma.forecast.findUnique({
    where: { id: forecastId },
    include: { slices: true, client: true },
  });
  if (!forecast) throw new Error(`forecast ${forecastId} not found`);

  const callbackUrl = `${process.env.APP_BASE_URL?.split(",")[0] ?? "http://localhost:3000"}/api/scheduler/slice-callback`;

  const res = await fetch(`${workerUrl.replace(/\/$/, "")}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sharedSecret}`,
    },
    body: JSON.stringify({
      forecastId,
      forecastSpec: {
        audioHoursTotal: forecast.audioHoursTotal,
        languageScope: forecast.languageScope,
        outputFormats: JSON.parse(forecast.outputFormats),
        budgetCents: forecast.budgetCents,
      },
      slices: forecast.slices.map((s) => ({
        chunkIndex: s.chunkIndex,
        timestampStart: s.timestampStart,
        timestampEnd: s.timestampEnd,
        inputUrl: s.inputUrl,
        attemptNumber: s.attemptNumber,
      })),
      callbackUrl,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`worker /submit failed: ${res.status} ${body}`);
  }
}

async function runDemoReplay(forecastId: string, distributorIds: string[]) {
  const forecast = await prisma.forecast.findUnique({
    where: { id: forecastId },
    include: { slices: { orderBy: [{ chunkIndex: "asc" }, { attemptNumber: "asc" }] } },
  });
  if (!forecast) return;

  const uniqueChunks = Array.from(
    new Map(forecast.slices.map((s) => [s.chunkIndex, s])).values(),
  );

  const total = uniqueChunks.length;

  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "active", frontOpenedAt: new Date() },
  });

  publishForecast(forecastId, {
    type: "front:opening",
    forecastId,
    total,
    ts: Date.now(),
  });

  for (let i = 0; i < uniqueChunks.length; i++) {
    await sleep(1000 + Math.random() * 1500);

    const chunk = uniqueChunks[i];
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const cyclesConsumed = 12 + Math.floor(Math.random() * 6);
    const outputHash = randomHex(12);
    const text = DEMO_LINES[i % DEMO_LINES.length];
    const nodePubkey = `node_${randomHex(8)}`;

    await prisma.slice.update({
      where: { id: chunk.id },
      data: {
        status: "completed",
        nodePubkey,
        outputHash,
        outputText: text,
        cyclesConsumed,
        completedAt: new Date(),
      },
    });

    await prisma.attestation.create({
      data: {
        sliceId: chunk.id,
        nodePubkey,
        nodeRegionGlyph: region,
        outputHash,
        schedulerSig: "demo-replay-valid",
      },
    });

    await prisma.forecast.update({
      where: { id: forecastId },
      data: { budgetCyclesUsed: { increment: cyclesConsumed } },
    });

    publishForecast(forecastId, {
      type: "slice:arrived",
      forecastId,
      chunkIndex: chunk.chunkIndex,
      timestampStart: chunk.timestampStart,
      timestampEnd: chunk.timestampEnd,
      outputHash,
      nodeRegion: region,
      cyclesConsumed,
      text,
      ts: Date.now(),
    });

    for (const distributorId of distributorIds) {
      publishDistributor(distributorId, {
        type: "slice:landed",
        distributorId,
        outcome: "landed",
        region,
        ts: Date.now(),
      });
    }
  }

  const audioHoursSealed = forecast.audioHoursTotal;
  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "sealed", sealedAt: new Date() },
  });

  await prisma.catchment.create({
    data: {
      forecastId,
      bundleUrl: `https://cdn.strata.app/catchments/${forecastId}.zip`,
      audioHoursSealed,
      slicesCompleted: total,
      slicesTotal: total,
    },
  });

  await createDemoSettlement(forecastId, forecast.budgetCents);

  publishForecast(forecastId, {
    type: "catchment:sealed",
    forecastId,
    bundleUrl: `https://cdn.strata.app/catchments/${forecastId}.zip`,
    slicesCompleted: total,
    slicesTotal: total,
    audioHoursSealed,
    ts: Date.now(),
  });
}

async function createDemoSettlement(forecastId: string, grossCents: number) {
  const slot = await prisma.computeSlot.findFirst({
    where: { active: true },
    orderBy: { id: "asc" },
  });
  if (!slot) return;

  const distributorCents = Math.round(grossCents * 0.8);
  const strataCents = grossCents - distributorCents;

  await prisma.settlement.create({
    data: {
      forecastId,
      distributorId: slot.distributorId,
      slotId: slot.id,
      grossCents,
      distributorCents,
      strataCents,
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomHex(bytes: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes * 2; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}
