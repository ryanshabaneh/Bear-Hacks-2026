import { prisma } from "@/lib/db/prisma";
import { publishForecast } from "@/lib/sse/bus";
import { runCachedReplay } from "./cached-replay";

const REGIONS = ["NA-east", "NA-west", "EU", "APAC"] as const;
const HARDCODE_LINES = [
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
  fixtureName?: string;
  distributorIds?: string[];
};

type DispatchMode = "cached" | "live" | "hardcode";

function readMode(): DispatchMode {
  const raw = (process.env.DCP_MODE ?? "live").toLowerCase();
  if (raw === "cached") return "cached";
  if (raw === "hardcode") return "hardcode";
  return "live";
}

export async function dispatchForecast({
  forecastId,
  fixtureName,
  distributorIds = [],
}: DispatchOptions): Promise<void> {
  const mode = readMode();

  if (mode === "live") {
    void runLive(forecastId).catch((err) => {
      console.error(`[dispatch] live run failed for ${forecastId}:`, err);
      void recordFailure(forecastId, err);
    });
    return;
  }

  if (mode === "cached") {
    const name = fixtureName ?? process.env.DCP_CACHED_FIXTURE ?? "slopify-demo";
    void runCachedReplay(forecastId, name).catch((err) => {
      console.error(`[dispatch] cached replay failed for ${forecastId}:`, err);
      void recordFailure(forecastId, err);
    });
    return;
  }

  void runHardcodeReplay(forecastId, distributorIds).catch((err) => {
    console.error("[dispatch] hardcode replay error", err);
  });
}

async function runLive(forecastId: string) {
  const forecast = await prisma.forecast.findUnique({
    where: { id: forecastId },
    include: { slices: { orderBy: [{ chunkIndex: "asc" }] } },
  });
  if (!forecast) throw new Error(`forecast ${forecastId} not found`);

  const fileScheme = "file://";
  const audioPath = forecast.inputManifestUrl.startsWith(fileScheme)
    ? forecast.inputManifestUrl.slice(fileScheme.length)
    : process.env.DCP_LIVE_AUDIO_PATH;
  if (!audioPath) {
    throw new Error(
      "No audio path on forecast.inputManifestUrl and DCP_LIVE_AUDIO_PATH not set",
    );
  }

  const path = await import("node:path");
  const libPath = path.resolve(process.cwd(), "..", "dcp", "lib.mjs");
  const lib = await import(/* webpackIgnore: true */ `file://${libPath}`);

  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "active", frontOpenedAt: new Date() },
  });

  const samples = await lib.decodeAudio(audioPath);
  const chunks = lib.chunkAudio(samples);
  const total = chunks.length;

  await prisma.slice.deleteMany({ where: { forecastId } });
  const newSlices = await Promise.all(
    Array.from({ length: total }, (_, idx) =>
      prisma.slice.create({
        data: {
          forecastId,
          chunkIndex: idx,
          timestampStart: idx * 30,
          timestampEnd: idx * 30 + 30,
          inputUrl: audioPath,
          attemptNumber: 1,
          status: "issued",
        },
      }),
    ),
  );

  const sliceByIdx = new Map<number, (typeof newSlices)[number]>();
  for (const s of newSlices) sliceByIdx.set(s.chunkIndex, s);

  publishForecast(forecastId, {
    type: "front:opening",
    forecastId,
    total,
    ts: Date.now(),
  });

  const result = (await lib.transcribeChunks(chunks, {
    bidPrice: Number(process.env.DCP_BID_PRICE ?? 1),
    returnTimings: true,
  })) as {
    texts: string[];
    dispatchedAt: number;
    events: Array<{
      idx: number;
      stamps: { workerStart: number; workerEnd: number } & Record<string, number>;
    }>;
  };

  for (const event of result.events) {
    const idx = event.idx as number;
    const slice = sliceByIdx.get(idx);
    if (!slice) continue;
    const text = result.texts[idx] ?? "";
    const region = REGIONS[idx % REGIONS.length];
    const cyclesConsumed = Math.max(
      8,
      Math.round((event.stamps.workerEnd - event.stamps.workerStart) / 1800),
    );
    const outputHash = randomHex(12);
    const nodePubkey = `node_${randomHex(8)}`;

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
        schedulerSig: "live-dcp-valid",
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

  const audioHoursSealed = Number((samples.length / 16000 / 3600).toFixed(3));
  await prisma.forecast.update({
    where: { id: forecastId },
    data: {
      status: "sealed",
      sealedAt: new Date(),
      audioHoursTotal: audioHoursSealed,
    },
  });

  await prisma.catchment.create({
    data: {
      forecastId,
      bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
      audioHoursSealed,
      slicesCompleted: total,
      slicesTotal: total,
    },
  });

  publishForecast(forecastId, {
    type: "catchment:sealed",
    forecastId,
    bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
    slicesCompleted: total,
    slicesTotal: total,
    audioHoursSealed,
    ts: Date.now(),
  });

  await createSettlement(forecastId, forecast.budgetCents);
}

async function runHardcodeReplay(forecastId: string, _distributorIds: string[]) {
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
    const text = HARDCODE_LINES[i % HARDCODE_LINES.length];
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
        schedulerSig: "hardcode-replay-valid",
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
  }

  const audioHoursSealed = forecast.audioHoursTotal;
  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "sealed", sealedAt: new Date() },
  });

  await prisma.catchment.create({
    data: {
      forecastId,
      bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
      audioHoursSealed,
      slicesCompleted: total,
      slicesTotal: total,
    },
  });

  publishForecast(forecastId, {
    type: "catchment:sealed",
    forecastId,
    bundleUrl: `https://strata.local/catchments/${forecastId}.zip`,
    slicesCompleted: total,
    slicesTotal: total,
    audioHoursSealed,
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

async function recordFailure(forecastId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "failed" },
  });
  publishForecast(forecastId, {
    type: "forecast:failed",
    forecastId,
    reason: message,
    ts: Date.now(),
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
