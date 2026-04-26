# DCP Integration — Submit Worker + Whisper Pipeline

The DCP submit worker is a **separate Node.js process** from the Next.js app. It owns the `~/.dcp/` keystores, calls `compute.for()` with k=2 redundancy per Forecast, listens for slice results, and POSTs them back to the Next.js app via the single canonical `/api/scheduler/slice-callback` endpoint.

Owner: BE3.

## Setup ([dcp-submit-worker/])

Sibling directory to the Next.js app, NOT inside it.

```bash
mkdir dcp-submit-worker && cd dcp-submit-worker
npm init -y
npm i dcp-client@<pinned-version> express dotenv node-fetch
npm i -D nodemon
```

Pin `dcp-client` to a specific version. Do not use `latest` in package.json.

[dcp-submit-worker/package.json] (after edits):
```json
{
  "name": "strata-dcp-submit-worker",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev":   "nodemon src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "dcp-client": "<pinned-version>",
    "dotenv": "^16",
    "express": "^4"
  },
  "devDependencies": {
    "nodemon": "^3"
  }
}
```

[dcp-submit-worker/.env]:
```
PORT=3001
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=<from DCP portal — same as Next.js .env.local>
DCP_WORKER_SHARED_SECRET=<openssl rand -hex 32 — same as Next.js .env.local>
DCP_MODE=live          # or "fallback" — see Risk 2 in 08-risks.md
DCP_SCHEDULER=https://scheduler.distributed.computer
WHISPER_WORK_BUNDLE_URL=https://cdn.strata.app/runtime/whisper-work-v1.js
WHISPER_MODEL_URL=https://cdn.strata.app/models/whisper-base/model.onnx
ORACLE_SAMPLE_RATE=0.02   # 1-3% of Slices spot-checked against server-side oracle
```

The `~/.dcp/default.keystore` and `~/.dcp/id.keystore` files must exist on the machine running this — see [01-preflight.md §1](01-preflight.md).

## Why a separate process?

- DCP keystores live in `~/.dcp/` and the wallet API is sync/file-based — it doesn't fit Next.js serverless functions
- Forecast lifetimes are minutes, not request-scoped — needs a long-lived process
- Vercel functions max out at 5 min; a Forecast can run longer if audio is long
- Keeps DCC private keys off the public-facing app

## Topology

```
Next.js app (Vercel)            DCP Submit Worker (Vultr or ngrok-tunneled local)
   |                                  |
   | POST /submit (Forecast spec) --> |
   |                                  |---compute.for() with k=2 redundancy---> DCP scheduler
   |                                  |                                                |
   |                                  |<--results stream (job.on 'result')-------------|
   | <--- POST /api/scheduler/slice-callback                                            |
   |                                  |   (single endpoint, body discriminator)        |
   |                                  |                                                |
   | (server-side quorum + oracle)    |                                                |
   | (Catchment seal on completion)   |                                                |
```

## Init ([dcp-submit-worker/src/dcp.js])

```js
const { init } = require('dcp-client');

let compute, wallet;

async function initDCP() {
  await init('https://scheduler.distributed.computer');
  compute = require('dcp/compute');
  wallet  = require('dcp/wallet');

  const acct = await wallet.get('default');
  const balance = await acct.getBalance();
  console.log(`DCP initialized. Balance: ${balance} DCC`);
  if (balance < 100) console.warn('LOW BALANCE — top up before demo');
}

module.exports = { initDCP, getCompute: () => compute, getWallet: () => wallet };
```

Call `initDCP()` once at startup, before `app.listen()`.

## Submit endpoint ([dcp-submit-worker/src/index.js])

```js
const express = require('express');
const { initDCP } = require('./dcp');
const { runForecast } = require('./forecast');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/submit', async (req, res) => {
  const { forecastId, forecastSpec, callbackUrl } = req.body;
  // Idempotency: if already running, ack and skip.
  // (Production would persist job state; for hackathon, in-memory is fine.)
  res.json({ accepted: true });
  try {
    await runForecast(forecastId, forecastSpec, callbackUrl);
  } catch (e) {
    console.error('Forecast failed:', e);
    await postCallback(callbackUrl, forecastId, { phase: 'failed', error: e.message });
  }
});

initDCP().then(() => app.listen(process.env.PORT || 3001, () => {
  console.log('Submit worker on :3001');
}));
```

The Next.js `POST /api/forecasts` handler creates the Forecast + Slice rows in DB, then calls `POST $DCP_SUBMIT_WORKER_URL/submit` with the spec and its own callback URL (Vercel preview URL or localhost during dev).

## Forecast pipeline ([dcp-submit-worker/src/forecast.js])

One `compute.for()` per Forecast. k=2 redundancy is built into the inputSet (each chunk dispatched twice). Quorum and oracle live server-side, NOT as a second DCP job.

```js
const { getCompute, getWallet } = require('./dcp');
const { postCallback } = require('./callbacks');

async function runForecast(forecastId, forecastSpec, callbackUrl) {
  const compute = getCompute();
  const wallet  = getWallet();

  // Build slice input — each chunk dispatched twice for k=2 redundancy.
  const inputSet = [];
  for (const chunk of forecastSpec.chunks) {
    for (const attemptNumber of [1, 2]) {
      inputSet.push({
        forecastId,
        chunkIndex:    chunk.index,
        chunkUrl:      chunk.cdnUrl,            // RemoteDataPattern, pre-registered
        timestampStart: chunk.timestampStart,
        timestampEnd:   chunk.timestampEnd,
        attemptNumber,
        bundleUrl:     process.env.WHISPER_WORK_BUNDLE_URL,
        modelUrl:      process.env.WHISPER_MODEL_URL,
      });
    }
  }

  // Work function — STRINGIFIED via Function.prototype.toString. No closures over outer scope.
  // Bundle is Strata-hosted, version-pinned (Option B). See 08-risks.md Risk 1 for fallback paths.
  async function whisperWorkFn(input) {
    progress(0);

    // Fetch the work-function bundle from the Strata-hosted, version-pinned URL.
    // RemoteDataPattern; bundle URL must be pre-registered with the Compute Group.
    const { transcribe } = await import(input.bundleUrl);
    progress(0.2);

    // Fetch audio chunk and Whisper model both via RemoteDataPattern.
    // The bundle's transcribe() handles audio decode (OfflineAudioContext) + WebGPU/WASM detection.
    const result = await transcribe({
      audioUrl: input.chunkUrl,
      modelUrl: input.modelUrl,
      timestampStart: input.timestampStart,
      timestampEnd: input.timestampEnd,
      onProgress: (p) => progress(0.2 + p * 0.7),  // 0.2 → 0.9
    });
    progress(0.95);

    return {
      forecastId:    input.forecastId,
      chunkIndex:    input.chunkIndex,
      attemptNumber: input.attemptNumber,
      srtText:       result.srtText,         // SRT-shaped chunk
      semanticHash:  result.semanticHash,    // sha256 of normalized transcript text
      cyclesConsumed: result.cyclesConsumed,
      modelUsed:     result.modelUsed,       // "whisper-base" or "whisper-tiny"
      deviceUsed:    result.deviceUsed,      // "webgpu" or "wasm-simd"
    };
  }

  const job = compute.for(inputSet, whisperWorkFn);
  job.public.name        = `Strata: Forecast ${forecastId}`;
  job.public.description = `Whisper transcription, ${forecastSpec.audioHoursTotal} audio-hours`;
  job.computeGroups = [{
    joinKey:    process.env.STRATA_GROUP_KEY,
    joinSecret: process.env.STRATA_GROUP_SECRET,
  }];

  const paymentAccount = await wallet.get('default');

  // Tell Next.js the DCP job id when accepted by scheduler.
  job.on('accepted', () => {
    postCallback(callbackUrl, forecastId, {
      phase:     'accepted',
      dcpJobId:  job.id,
      total:     inputSet.length,
    });
  });

  // Per-Slice result. Server-side quorum logic compares the two attempts; oracle spot-checks 1-3%.
  job.on('result', (ev) => {
    postCallback(callbackUrl, forecastId, {
      phase:     'result',
      sliceIndex: ev.sort,
      result:    ev.result,                 // see whisperWorkFn return shape above
      computed:  job.status?.computed,
      total:     job.status?.total,
    });
  });

  job.on('status', (ev) => {
    postCallback(callbackUrl, forecastId, {
      phase:    'status',
      total:    ev.total,
      distributed: ev.distributed,
      computed: ev.computed,
    });
  });

  job.on('error', (ev) => {
    postCallback(callbackUrl, forecastId, {
      phase:     'error',
      sliceIndex: ev.sliceIndex,
      message:   ev.message,
    });
  });

  // Pricing: marketValue with a sane ceiling per slice. Adjust after T+2 spike.
  const results = await job.exec(compute.marketValue, paymentAccount);

  postCallback(callbackUrl, forecastId, { phase: 'done', total: inputSet.length });
  return Array.from(results);
}

module.exports = { runForecast };
```

## Callback helper ([dcp-submit-worker/src/callbacks.js])

```js
const fetch = require('node-fetch');

async function postCallback(callbackUrl, forecastId, body) {
  await fetch(`${callbackUrl}/api/scheduler/slice-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`,
    },
    body: JSON.stringify({ forecastId, ...body }),
  }).catch(e => console.error('Callback failed:', e.message));
  // Fire-and-forget. Loss of one callback is OK; status events are idempotent.
}

module.exports = { postCallback };
```

## Next.js side — single canonical scheduler callback ([app/api/scheduler/slice-callback/route.ts])

```ts
import { prisma } from '@/lib/db';
import { broadcastSSE } from '@/lib/sse';
import { requireWorkerAuth, runQuorumOnSlice, maybeRunOracleSpotCheck } from '@/lib/worker-callbacks';

export async function POST(req: Request) {
  requireWorkerAuth(req);  // throws 401 if Authorization header missing/wrong (timingSafeEqual)
  const body = await req.json();
  const { forecastId, phase } = body;

  switch (phase) {
    case 'accepted': {
      await prisma.forecast.update({
        where: { id: forecastId },
        data: { status: 'active', frontOpenedAt: new Date() },
      });
      broadcastSSE(`forecast:${forecastId}`, { type: 'front_opened', total: body.total });
      return new Response(null, { status: 204 });
    }

    case 'status': {
      broadcastSSE(`forecast:${forecastId}`, { type: 'status_tick', ...body });
      return new Response(null, { status: 204 });
    }

    case 'result': {
      const r = body.result;
      // Mark this attempt's Slice row completed.
      await prisma.slice.updateMany({
        where: { forecastId, chunkIndex: r.chunkIndex, attemptNumber: r.attemptNumber },
        data: {
          status:        'completed',
          outputHash:    r.semanticHash,
          outputText:    r.srtText,
          cyclesConsumed: r.cyclesConsumed,
          completedAt:   new Date(),
        },
      });

      // Run server-side quorum: if both k=2 attempts have landed and hashes match, accept the chunk.
      // If hashes mismatch, escalate to a third attempt (attemptNumber=3) or oracle (attemptNumber=99).
      const acceptedSlice = await runQuorumOnSlice(forecastId, r.chunkIndex);

      if (acceptedSlice) {
        // Write Attestation row.
        await prisma.attestation.create({
          data: {
            sliceId:         acceptedSlice.id,
            nodePubkey:      acceptedSlice.nodePubkey ?? '',
            nodeRegionGlyph: 'unknown',
            outputHash:      acceptedSlice.outputHash ?? '',
            schedulerSig:    'TODO-sign',
          },
        });
        broadcastSSE(`forecast:${forecastId}`, {
          type: 'slice_accepted',
          chunkIndex: r.chunkIndex,
          srtText: acceptedSlice.outputText,
          timestampStart: acceptedSlice.timestampStart,
          timestampEnd: acceptedSlice.timestampEnd,
        });

        // Per-Slice settlement: 68% Distributor / 32% Strata.
        await writeSettlementForSlice(acceptedSlice);

        // 1-3% sample → oracle spot-check (server-side Whisper).
        maybeRunOracleSpotCheck(acceptedSlice).catch(console.error);
      }

      return new Response(null, { status: 204 });
    }

    case 'error': {
      await prisma.slice.updateMany({
        where: { forecastId, chunkIndex: body.sliceIndex },
        data: { status: 'failed' },
      });
      // Reissue handled by DCP scheduler retry; if that fails too, we'll see status timeout.
      broadcastSSE(`forecast:${forecastId}`, { type: 'slice_error', ...body });
      return new Response(null, { status: 204 });
    }

    case 'done': {
      // Seal the Catchment.
      await sealCatchment(forecastId);
      broadcastSSE(`forecast:${forecastId}`, { type: 'catchment_sealed' });
      return new Response(null, { status: 204 });
    }

    case 'failed': {
      await prisma.forecast.update({
        where: { id: forecastId },
        data: { status: 'failed' },
      });
      broadcastSSE(`forecast:${forecastId}`, { type: 'failed', error: body.error });
      return new Response(null, { status: 204 });
    }

    default:
      return new Response('Unknown phase', { status: 400 });
  }
}
```

## Helpers ([src/lib/worker-callbacks.ts])

```ts
import { timingSafeEqual } from 'node:crypto';
import { prisma } from './db';

export function requireWorkerAuth(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Response('Unauthorized', { status: 401 });
  }
}

// Quorum: if both attempts for a chunk have landed and outputHash matches, accept attempt #1.
// Mismatch → escalate (third attempt or oracle); not implemented in MVP.
export async function runQuorumOnSlice(forecastId: string, chunkIndex: number) {
  const attempts = await prisma.slice.findMany({
    where: { forecastId, chunkIndex, status: 'completed' },
    orderBy: { attemptNumber: 'asc' },
  });
  if (attempts.length < 2) return null;
  const [a1, a2] = attempts;
  if (a1.outputHash && a1.outputHash === a2.outputHash) {
    return a1; // accept attempt #1
  }
  // Mismatch: escalate. For hackathon MVP, accept attempt #1 with a flag and rely on oracle.
  // TODO: dispatch third attempt or route to oracle (attemptNumber=99).
  return a1;
}

// 1-3% sample. Server-side Whisper instance hit on a small fraction of accepted Slices.
// Discrepancy → flag attestation; counts toward Client.zeroAnomalies = false.
export async function maybeRunOracleSpotCheck(slice: { id: string; outputText: string | null }) {
  const rate = parseFloat(process.env.ORACLE_SAMPLE_RATE ?? '0.02');
  if (Math.random() > rate) return;
  // TODO: server-side Whisper inference on the chunk; compare semantic hash.
}
```

## SSE infrastructure ([src/lib/sse.ts])

```ts
const channels = new Map<string, Set<ReadableStreamDefaultController>>();

export function subscribeSSE(channel: string, controller: ReadableStreamDefaultController) {
  let set = channels.get(channel);
  if (!set) { set = new Set(); channels.set(channel, set); }
  set.add(controller);
  return () => set!.delete(controller);
}

export function broadcastSSE(channel: string, payload: any) {
  const set = channels.get(channel);
  if (!set) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) c.enqueue(new TextEncoder().encode(msg));
}
```

[app/api/forecasts/[id]/stream/route.ts]:
```ts
import { getSession } from '@/lib/auth';
import { subscribeSSE } from '@/lib/sse';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                  // async params in Next 15+
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!forecast || forecast.client.userId !== session.userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const unsub = subscribeSSE(`forecast:${id}`, controller);
      req.signal.addEventListener('abort', () => { unsub(); controller.close(); });
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

`X-Accel-Buffering: no` required for Vercel/nginx edge proxies to flush event chunks. Same shape for `/api/distributors/[id]/stream`.

## Pricing

`compute.marketValue` lets DCP pick market rate. For predictable demo cost:
```js
const results = await job.exec(compute.marketValue, paymentAccount);
```

Verify the exact `compute.marketValue` signature against `/docs/dcp-docs/Compute API` before using `marketValue(ratio, max)`.

## Key gotchas (from [docs/dcp-docs/](../docs/dcp-docs/))

1. **Work functions are stringified.** No closures over outer scope. All data through `datum` or the `args` array (third arg to `compute.for()`).
2. **`progress()` is mandatory** — at least once per ~30s or ENOPROGRESS kills the slice. Whisper cold-start (model download + shader compile) can exceed 30s, so call `progress()` between fetch / model warm / decode start.
3. **Progress values must monotonically increase**: `progress(0)`, `progress(0.5)`, `progress(1)`. Plain `progress()` is also OK but values are preferred.
4. **Keystores live on disk** (`~/.dcp/`). Never reference them from frontend or Vercel functions.
5. **ENOFUNDS pauses the job; ENOPROGRESS cancels it.** Pre-fund and call `progress()` defensively.
6. **`localExec()` for testing** — `npm i dcp-worker` then `await job.localExec()` runs slices on the submit worker machine. Use during BE3 development.
7. **No IndexedDB / no WebSocket / no Playwright in the V8 sandbox.** RemoteDataPattern is the only fetch surface. All chunk URLs, the bundle URL, and the model URL must be pre-registered with the Compute Group.

## Fallback mode (Risk 2 mitigation)

If DCP scheduler is unreachable from conference WiFi, the submit worker replays a **pre-baked Catchment**: the full Slice / Attestation set captured during dry runs is re-streamed via the same SSE callbacks with realistic timing. The DCP scheduler dispatch is bypassed; everything else (quorum, attestation, Catchment math, settlement) runs real. UI labels the fallback explicitly. **Do NOT ship a hidden synchronous in-process mode that masks DCP errors.**

## Open questions

1. **Quorum escalation on hash mismatch.** MVP accepts attempt #1 with a flag. Should mismatch trigger a third attempt (attemptNumber=3), oracle (attemptNumber=99), or both? Decision affects DCC budget.
2. **`compute.marketValue` signature.** Verify against the DCP docs before locking the pricing call.
3. **Single PCG vs per-Forecast PCG.** Single is easier and matches DCP docs' default. Per-Forecast is cleaner but adds setup cost. Default to single for hackathon.
4. **Idempotency on `/submit`.** MVP has no dedupe; if Next.js retries, two DCP jobs spawn. Add a `forecastId` dedupe key in production. For demo, single-laptop sub-flow makes collision unlikely.
