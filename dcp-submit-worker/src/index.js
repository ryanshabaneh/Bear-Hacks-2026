const express = require("express");
const { z } = require("zod");
const { timingSafeEqual } = require("node:crypto");
const { initDCP } = require("./dcp");
const { runForecast } = require("./forecast");

const app = express();
app.use(express.json({ limit: "10mb" }));

const SubmitBody = z.object({
  forecastId: z.string(),
  forecastSpec: z.object({
    audioHoursTotal: z.number(),
    languageScope: z.string(),
    outputFormats: z.array(z.string()),
    budgetCents: z.number().int(),
  }),
  slices: z.array(
    z.object({
      chunkIndex: z.number().int(),
      timestampStart: z.number(),
      timestampEnd: z.number(),
      inputUrl: z.string(),
      attemptNumber: z.number().int(),
    }),
  ),
  callbackUrl: z.string().url(),
});

function verifyBearer(req) {
  const expected = process.env.DCP_WORKER_SHARED_SECRET;
  if (!expected) return false;
  const auth = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/.exec(auth);
  if (!match) return false;
  const provided = match[1];
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post("/submit", async (req, res) => {
  if (!verifyBearer(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
  }

  res.json({ ok: true, accepted: true });

  const { forecastId, slices, callbackUrl } = parsed.data;

  runForecast({ forecastId, slices, callbackUrl }).catch((err) => {
    console.error(`[forecast ${forecastId}] failed`, err);
  });
});

const PORT = Number(process.env.PORT || 3001);

initDCP()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[strata submit-worker] listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[strata submit-worker] init failed", err);
    process.exit(1);
  });
