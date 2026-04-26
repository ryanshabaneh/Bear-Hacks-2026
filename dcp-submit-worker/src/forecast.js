const { getCompute, getWallet } = require("./dcp");
const { postCallback } = require("./callback");

const WORK_FUNCTION_VERSION = "strata-whisper-v1";

async function whisperWorkFn(input) {
  progress(0);
  const { transcribe } = await import(input.bundleUrl);
  progress(0.2);
  const result = await transcribe({
    audioUrl: input.chunkUrl,
    modelUrl: input.modelUrl,
    timestampStart: input.timestampStart,
    timestampEnd: input.timestampEnd,
    onProgress: (p) => {
      progress(0.2 + p * 0.7);
    },
  });
  progress(0.95);
  return {
    forecastId: input.forecastId,
    chunkIndex: input.chunkIndex,
    attemptNumber: input.attemptNumber,
    srtText: result.srtText,
    semanticHash: result.semanticHash,
    cyclesConsumed: result.cyclesConsumed,
    modelUsed: result.modelUsed,
    deviceUsed: result.deviceUsed,
  };
}

async function runForecast({ forecastId, slices, callbackUrl }) {
  const compute = getCompute();
  const wallet = getWallet();
  const account = await wallet.get("bearhacks");

  const bundleUrl = process.env.WHISPER_WORK_BUNDLE_URL;
  const modelUrl = process.env.WHISPER_MODEL_URL;
  if (!bundleUrl || !modelUrl) {
    throw new Error("WHISPER_WORK_BUNDLE_URL or WHISPER_MODEL_URL not set");
  }

  const inputSet = slices.map((s) => ({
    forecastId,
    chunkIndex: s.chunkIndex,
    attemptNumber: s.attemptNumber,
    timestampStart: s.timestampStart,
    timestampEnd: s.timestampEnd,
    chunkUrl: s.inputUrl,
    bundleUrl,
    modelUrl,
  }));

  const job = compute.for(inputSet, whisperWorkFn);
  job.public.name = `Strata: Forecast ${forecastId}`;
  job.public.description = `Whisper transcription, ${slices.length} slices`;

  job.on("accepted", () => {
    void postCallback(callbackUrl, {
      phase: "accepted",
      forecastId,
      dcpJobId: job.id,
      total: slices.length,
    });
  });

  job.on("status", (ev) => {
    void postCallback(callbackUrl, {
      phase: "status",
      forecastId,
      distributed: ev.distributed,
      computed: ev.computed,
    });
  });

  job.on("result", (ev) => {
    const result = ev.result?.result ?? ev.result;
    if (!result) return;
    void postCallback(callbackUrl, {
      phase: "result",
      forecastId,
      chunkIndex: result.chunkIndex,
      attemptNumber: result.attemptNumber,
      nodePubkey: ev.workerAddress ?? "unknown",
      nodeRegion: ev.region ?? "unknown",
      outputHash: result.semanticHash,
      outputText: result.srtText ?? "",
      cyclesConsumed: result.cyclesConsumed ?? 0,
      schedulerSig: ev.signature ?? "scheduler-sig",
    });
  });

  job.on("error", (ev) => {
    void postCallback(callbackUrl, {
      phase: "error",
      forecastId,
      chunkIndex: ev.sliceIndex,
      message: ev.message ?? String(ev),
    });
  });

  try {
    await job.exec(compute.marketValue, account);
    void postCallback(callbackUrl, {
      phase: "done",
      forecastId,
      bundleUrl: `https://cdn.strata.app/catchments/${forecastId}.zip`,
      audioHoursSealed:
        slices.reduce((acc, s) => acc + (s.timestampEnd - s.timestampStart), 0) / 3600,
      slicesCompleted: slices.length,
      slicesTotal: slices.length,
    });
  } catch (err) {
    void postCallback(callbackUrl, {
      phase: "failed",
      forecastId,
      reason: err && err.message ? err.message : String(err),
    });
    throw err;
  }
}

module.exports = { runForecast, WORK_FUNCTION_VERSION };
