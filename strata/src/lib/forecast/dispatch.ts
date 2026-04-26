import { prisma } from "@/lib/db/prisma";
import { publishForecast } from "@/lib/sse/bus";
import { runCachedReplay } from "./cached-replay";

const REGIONS = ["NA-east", "NA-west", "EU", "APAC"] as const;
const HARDCODE_LINES = [
  "What's up everybody, welcome to the most powerful podcast. Alright, we're going to get into the next segment.",
  "I think we're going to be in the middle of the day. That's what we're going to do.",
  "I don't think I'm going to be a better person than you. We're not going to do anything. We're benevolent. We might be the most benevolent.",
  "I'm just saying, I'm just trying to get out of the way.",
  "I think I'll be like, I'm not a real man. I'm just going to say it again.",
  "I'm just going to shut up. I'm not sure if you can do anything.",
  "They've got to give 10% of their wealth. It's a charity or whatever. You don't have to give 10% of your wealth to charity, you pay two-five, and you don't even have to fight in the wars.",
  "This is why I think the other religions don't last in the world, because they're jealous.",
  "I think it's the first time I've been in the world for a year. I'm not sure. I don't know what to do.",
  "Yeah, I'm just going to work as they're right. I'm just going to do what I can do. I'm so happy.",
];

const SIMULATED_NODES = [
  { key: "node-slopify-northbeacon-01", origin: "Slopify", label: "Slopify (Northbeacon)", region: "NA-east" },
  { key: "node-slopify-northbeacon-02", origin: "Slopify", label: "Slopify (Northbeacon)", region: "NA-west" },
  { key: "node-pixelpost-zine-01",      origin: "Pixelpost", label: "Pixelpost (zine)", region: "EU" },
  { key: "node-driftcast-fm-01",        origin: "Driftcast", label: "Driftcast.fm", region: "APAC" },
  { key: "node-saltbox-coffee-01",      origin: "Saltbox", label: "Saltbox Coffee Wi-Fi", region: "NA-east" },
] as const;

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
  console.log(`[strata:dispatch] forecast=${forecastId.slice(-6)} mode=${mode}`);

  if (mode === "live") {
    void runLive(forecastId).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[strata:dispatch] live run failed forecast=${forecastId.slice(-6)} reason="${message}"`);
      void recordFailure(forecastId, err);
    });
    return;
  }

  if (mode === "cached") {
    const name = fixtureName ?? process.env.DCP_CACHED_FIXTURE ?? "slopify-demo";
    void runCachedReplay(forecastId, name).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[strata:dispatch] cached replay failed forecast=${forecastId.slice(-6)} reason="${message}"`);
      void recordFailure(forecastId, err);
    });
    return;
  }

  void runHardcodeReplay(forecastId, distributorIds).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[strata:dispatch] hardcode replay error reason="${message}"`);
  });
}

async function runLive(forecastId: string) {
  const tag = forecastId.slice(-4);
  const log = (verb: string, fields = "") =>
    console.log(`[strata ${tag}] ${verb.padEnd(10)} ${fields}`);

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

  const fileName = audioPath.split("/").pop() ?? "audio";
  log("received", `file=${fileName} forecast=${forecastId}`);

  const path = await import("node:path");
  const libPath = path.resolve(process.cwd(), "..", "dcp", "lib.mjs");
  log("dispatch", `loading lib.mjs from ${libPath}`);
  const lib = await import(/* webpackIgnore: true */ `file://${libPath}`);

  await prisma.forecast.update({
    where: { id: forecastId },
    data: { status: "active", frontOpenedAt: new Date() },
  });

  log("decoding", "ffmpeg → 16kHz mono float32");
  const samples = await lib.decodeAudio(audioPath);
  log("decoded", `${(samples.length / 16000).toFixed(1)}s audio (${samples.length} samples)`);
  const chunks = lib.chunkAudio(samples);
  const total = chunks.length;
  log("chunked", `${total} windows × 30s`);

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
  const bidPrice = Number(process.env.DCP_BID_PRICE ?? 1);
  log("dispatch", `submitted to scheduler, bid=$${bidPrice.toFixed(2)}, modules=3`);
  log("cold-start", "~20-30s expected for first slice (3 ONNX modules, ~70MB)");

  const writeLock = new Set<number>();
  let abandoned = false;
  const handleResult = async (event: {
    idx: number;
    text: string;
    stamps: { workerStart: number; workerEnd: number } & Record<string, number>;
  }) => {
    if (abandoned) return;
    const idx = event.idx;
    if (writeLock.has(idx)) return;
    writeLock.add(idx);
    const slice = sliceByIdx.get(idx);
    if (!slice) return;
    const text = event.text;
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
    const workerMs = event.stamps.workerEnd - event.stamps.workerStart;
    const sliceLabel = `${String(slice.chunkIndex).padStart(2, " ")}`;
    const preview = text.slice(0, 60).replace(/\s+/g, " ");
    const tail = text.length > 60 ? "..." : "";
    log(
      "slice",
      `${sliceLabel}  <- ${region.padEnd(7)} ${String(workerMs).padStart(5)}ms  cycles=${cyclesConsumed}  "${preview}${tail}"`,
    );
  };

  let result: {
    texts: string[];
    dispatchedAt: number;
    events: Array<{
      idx: number;
      stamps: { workerStart: number; workerEnd: number } & Record<string, number>;
    }>;
  };
  try {
    result = (await lib.transcribeChunks(chunks, {
      bidPrice,
      returnTimings: true,
      onProgress: (done: number, t: number) => log("progress", `${done}/${t}`),
      onResult: handleResult,
    })) as typeof result;
  } catch (error) {
    abandoned = true;
    const message = error instanceof Error ? error.message : String(error);
    log("failed", message);
    await recordFailure(forecastId, error);
    return;
  }
  log("returned", `${result.texts.length} transcripts from scheduler`);

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
  const totalCycles = result.events.reduce(
    (sum, event) =>
      sum +
      Math.max(8, Math.round((event.stamps.workerEnd - event.stamps.workerStart) / 1800)),
    0,
  );
  log("sealing", `${total}/${total} slices, ${(audioHoursSealed * 60).toFixed(1)}min audio, ${totalCycles} cycles`);

  await createSettlement(forecastId, forecast.budgetCents);
  const grossCents = forecast.budgetCents;
  const distributorCents = Math.round(grossCents * 0.8);
  const strataCents = grossCents - distributorCents;
  log(
    "settled",
    `$${(grossCents / 100).toFixed(4)} gross → $${(distributorCents / 100).toFixed(4)} distributor + $${(strataCents / 100).toFixed(4)} strata`,
  );
  log("sealed", `bundle=catchments/${forecastId}.zip`);
}

async function refreshSimulatedNodes(slicesDelta = 0) {
  const now = new Date();
  for (const node of SIMULATED_NODES) {
    await prisma.workerNode.upsert({
      where: { nodeKey: node.key },
      create: {
        nodeKey: node.key,
        origin: node.origin,
        label: node.label,
        slicesComputed: 0,
        lastHeartbeatAt: now,
      },
      update: {
        origin: node.origin,
        label: node.label,
        lastHeartbeatAt: now,
        slicesComputed: { increment: slicesDelta },
      },
    });
  }
}

async function bumpSimulatedNode(nodeKey: string) {
  await prisma.workerNode.update({
    where: { nodeKey },
    data: {
      lastHeartbeatAt: new Date(),
      slicesComputed: { increment: 1 },
    },
  });
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

  await refreshSimulatedNodes();
  const heartbeatTimer = setInterval(() => {
    void refreshSimulatedNodes().catch(() => {});
  }, 2000);

  try {
    for (let i = 0; i < uniqueChunks.length; i++) {
      await sleep(700 + Math.random() * 900);

      const chunk = uniqueChunks[i];
      const node = SIMULATED_NODES[i % SIMULATED_NODES.length];
      const region = node.region;
      const cyclesConsumed = 12 + Math.floor(Math.random() * 6);
      const outputHash = randomHex(12);
      const text = HARDCODE_LINES[i % HARDCODE_LINES.length];
      const nodePubkey = node.key;

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

      await bumpSimulatedNode(nodePubkey);

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
  } finally {
    clearInterval(heartbeatTimer);
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
