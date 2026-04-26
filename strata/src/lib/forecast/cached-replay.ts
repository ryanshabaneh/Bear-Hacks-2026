import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { publishForecast } from "@/lib/sse/bus";

export type CachedFixtureEvent = {
  idx: number;
  receivedAt?: number;
  relativeReceivedMs: number;
  stamps: Record<string, number>;
  cold: { encoder: boolean; decoder: boolean; decoderPast: boolean };
  gpuProbe: {
    hasNavigatorGpu: boolean;
    adapterOk: boolean;
    vendor: string | null;
    error: string | null;
  };
};

export type CachedFixture = {
  name: string;
  capturedAt: string;
  audioSec: number;
  wallSec: number;
  chunkCount: number;
  chunkSeconds: number;
  dispatchedAt: number;
  texts: string[];
  events: CachedFixtureEvent[];
};

const CACHE_DIR = path.join(
  path.resolve(process.cwd(), ".."),
  "dcp",
  "cache",
);

export async function loadFixture(name: string): Promise<CachedFixture> {
  const filePath = path.join(CACHE_DIR, `${name}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(
      `Cache fixture not found: ${filePath}. Capture a real run first: cd dcp && node capture-cache.mjs <audio.mp3> ${name}`,
    );
  }
  return JSON.parse(raw) as CachedFixture;
}

const REGIONS = ["NA-east", "NA-west", "EU", "APAC"] as const;

function pickRegion(idx: number): string {
  return REGIONS[idx % REGIONS.length];
}

function hashFromTokens(text: string, idx: number): string {
  let h = 0x811c9dc5 ^ idx;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + idx.toString(16).padStart(4, "0");
}

export async function runCachedReplay(
  forecastId: string,
  fixtureName: string,
  options: { paceFactor?: number } = {},
): Promise<void> {
  const paceFactor = options.paceFactor ?? 0.05;
  const fixture = await loadFixture(fixtureName);

  const forecast = await prisma.forecast.findUnique({
    where: { id: forecastId },
    include: {
      slices: {
        orderBy: [{ chunkIndex: "asc" }, { attemptNumber: "asc" }],
      },
    },
  });
  if (!forecast) return;

  const sliceByIdx = new Map<number, (typeof forecast.slices)[number]>();
  for (const s of forecast.slices) {
    if (!sliceByIdx.has(s.chunkIndex)) sliceByIdx.set(s.chunkIndex, s);
  }

  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "active", frontOpenedAt: new Date() },
  });

  publishForecast(forecastId, {
    type: "front:opening",
    forecastId,
    total: fixture.chunkCount,
    ts: Date.now(),
  });

  const sortedEvents = [...fixture.events].sort(
    (a, b) => a.relativeReceivedMs - b.relativeReceivedMs,
  );

  let elapsed = 0;
  for (const ev of sortedEvents) {
    const target = ev.relativeReceivedMs * paceFactor;
    const wait = Math.max(0, target - elapsed);
    if (wait > 0) await sleep(wait);
    elapsed = target;

    const slice = sliceByIdx.get(ev.idx);
    if (!slice) continue;

    const text = fixture.texts[ev.idx] ?? "";
    const region = pickRegion(ev.idx);
    const cyclesConsumed = Math.max(
      8,
      Math.round((ev.stamps.workerEnd - ev.stamps.workerStart) / 1800),
    );
    const outputHash = hashFromTokens(text, ev.idx);
    const nodePubkey = `node_${(0x10000 + ev.idx * 0x4d7).toString(16).slice(-8)}`;

    await prisma.slice.update({
      where: { id: slice.id },
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
        sliceId: slice.id,
        nodePubkey,
        nodeRegionGlyph: region,
        outputHash,
        schedulerSig: "cached-replay-valid",
      },
    });

    await prisma.forecast.update({
      where: { id: forecastId },
      data: { budgetCyclesUsed: { increment: cyclesConsumed } },
    });

    publishForecast(forecastId, {
      type: "slice:arrived",
      forecastId,
      chunkIndex: slice.chunkIndex,
      timestampStart: slice.timestampStart,
      timestampEnd: slice.timestampEnd,
      outputHash,
      nodeRegion: region,
      cyclesConsumed,
      text,
      ts: Date.now(),
    });
  }

  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "sealed", sealedAt: new Date() },
  });

  await prisma.catchment.create({
    data: {
      forecastId,
      bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
      audioHoursSealed: forecast.audioHoursTotal,
      slicesCompleted: fixture.chunkCount,
      slicesTotal: fixture.chunkCount,
    },
  });

  publishForecast(forecastId, {
    type: "catchment:sealed",
    forecastId,
    bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
    slicesCompleted: fixture.chunkCount,
    slicesTotal: fixture.chunkCount,
    audioHoursSealed: forecast.audioHoursTotal,
    ts: Date.now(),
  });

  await createSettlement(forecastId, forecast.budgetCents);
}

async function createSettlement(forecastId: string, grossCents: number) {
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
