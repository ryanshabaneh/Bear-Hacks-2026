# DCP Integration — Submit Worker + Two-Phase Compute

The DCP submit worker is a **separate Node.js process** from the Next.js app. It owns the `~/.dcp/` keystores, calls `compute.for()`, listens for slice results, and POSTs them back to the Next.js app via `/api/jobs/:id/slice-result`.

Owner: BE3.

## Setup ([dcp-submit-worker/])

Sibling directory to the Next.js app, NOT inside it.

```bash
mkdir dcp-submit-worker && cd dcp-submit-worker
npm init -y
npm i dcp-client express dotenv
npm i -D nodemon
```

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
    "dcp-client": "latest",
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
```

The `~/.dcp/default.keystore` and `~/.dcp/id.keystore` files must exist on the machine running this — see [01-preflight.md §1](01-preflight.md#1-dcp-keystore--funding-be3).

## Why a separate process?

- DCP keystores live in `~/.dcp/` and the wallet API is sync/file-based — it doesn't fit Next.js serverless functions
- Job lifetimes are minutes, not request-scoped — needs a long-lived process
- Vercel functions max out at 5 min; rollout job can run 10+ min
- Keeps DCC private keys off the public-facing app

## Topology

```
Next.js app (Vercel)            DCP Submit Worker (Vultr or ngrok-tunneled local)
   |                                  |
   | POST /submit (job spec) -------> |
   |                                  |---compute.for() rollout job---> DCP scheduler
   |                                  |                                       |
   |                                  |<--results stream (job.on 'result')----|
   | <--- POST /api/jobs/:id/slice-result |
   |                                  |
   | (rollouts complete trigger)      |
   |                                  |---compute.for() verifier job--> DCP scheduler
   | <--- POST /api/jobs/:id/slice-result |
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
const { runRollout } = require('./rollout');
const { runVerifier } = require('./verifier');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/submit', async (req, res) => {
  const { jobId, jobSpec, callbackUrl } = req.body;
  // Acknowledge sync; run async
  res.json({ accepted: true });
  try {
    const rolloutResults = await runRollout(jobId, jobSpec, callbackUrl);
    if (jobSpec.use_verifier) {
      await runVerifier(jobId, jobSpec, rolloutResults, callbackUrl);
    }
  } catch (e) {
    console.error('Job failed:', e);
    await fetch(`${callbackUrl}/api/jobs/${jobId}/failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message }),
    });
  }
});

initDCP().then(() => app.listen(3000, () => console.log('Submit worker on :3000')));
```

The Next.js `POST /api/jobs` handler creates the Job + Slices in DB, then calls `POST $DCP_SUBMIT_WORKER_URL/submit` with the spec and its own callback URL (Vercel preview URL or localhost during dev).

## Phase 4 — Rollout job ([dcp-submit-worker/src/rollout.js])

```js
const { getCompute, getWallet } = require('./dcp');

async function runRollout(jobId, jobSpec, callbackUrl) {
  const compute = getCompute();
  const wallet  = getWallet();

  // Build slice input — one element per (problem, rollout) pair
  const inputSet = [];
  for (const problem of jobSpec.input_set) {
    for (let i = 0; i < jobSpec.n_rollouts; i++) {
      inputSet.push({
        problemId:    problem.id,
        problemText:  problem.text,
        rolloutIndex: i,
        seed:         i * 7 + 13,
      });
    }
  }

  // Work function — STRINGIFIED. Cannot close over outer-scope variables.
  // Choose ONE of three Gemma execution paths per the spike result (see 01-preflight.md):
  //   Path A: dynamic-import transformers.js inside sandbox
  //   Path B: postMessage to runtime iframe that holds the model
  //   Path C: fetch() to localhost inference endpoint (fallback)
  // Below shows Path A — replace per spike outcome.
  async function rolloutWorkFn(input, modelId) {
    progress(0);
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest');
    progress(0.1);
    const generator = await pipeline('text-generation', modelId, { dtype: 'q4', device: 'webgpu' });
    progress(0.5);
    const out = await generator(
      [{ role: 'user', content: `Solve this AIME problem. Show your reasoning, then put your final 3-digit integer answer on a line by itself.\n\n${input.problemText}` }],
      { max_new_tokens: 512, temperature: 0.7 }
    );
    progress(1);
    const text = out[0].generated_text;
    const answerMatch = text.match(/\b(\d{1,3})\b\s*$/);
    return {
      problemId:        input.problemId,
      rolloutIndex:     input.rolloutIndex,
      chain_of_thought: text,
      final_answer:     answerMatch ? answerMatch[1].padStart(3, '0') : null,
      tokens_used:      out[0].generated_text.length,
    };
  }

  const job = compute.for(inputSet, rolloutWorkFn, [jobSpec.model]);
  job.public.name        = `Strata: ${jobSpec.name} — rollouts`;
  job.public.description = jobSpec.description || 'Best-of-N reasoning rollouts';
  job.computeGroups = [{
    joinKey:    process.env.STRATA_GROUP_KEY,
    joinSecret: process.env.STRATA_GROUP_SECRET,
  }];

  const paymentAccount = await wallet.get('default');

  // Tell Next.js the DCP job id
  job.on('accepted', () => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/accepted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dcpJobId: job.id, total: inputSet.length, phase: 'rollout' }),
    });
  });

  job.on('result', (ev) => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/slice-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sliceIndex: ev.sort,
        phase:      'rollout',
        result:     ev.result,
        computed:   job.status.computed,
        total:      job.status.total,
      }),
    });
  });

  job.on('status', (ev) => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'rollout', total: ev.total, distributed: ev.distributed, computed: ev.computed }),
    });
  });

  job.on('error', (ev) => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/slice-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sliceIndex: ev.sliceIndex, message: ev.message, phase: 'rollout' }),
    });
  });

  const results = await job.exec(compute.marketValue, paymentAccount);
  return Array.from(results);
}

module.exports = { runRollout };
```

## Phase 5 — Verifier job ([dcp-submit-worker/src/verifier.js])

```js
const { getCompute, getWallet } = require('./dcp');

async function runVerifier(jobId, jobSpec, rolloutResults, callbackUrl) {
  const compute = getCompute();
  const wallet  = getWallet();

  // Group rollouts by problem
  const byProblem = {};
  for (const r of rolloutResults) {
    if (!byProblem[r.problemId]) byProblem[r.problemId] = [];
    byProblem[r.problemId].push(r);
  }

  // For each problem, create one verifier slice per distinct candidate answer
  const verifierInput = [];
  for (const [problemId, rollouts] of Object.entries(byProblem)) {
    const problemText = jobSpec.input_set.find(p => p.id === problemId).text;
    for (const r of rollouts) {
      verifierInput.push({
        problemId,
        problemText,
        candidate: r.final_answer,
        reasoning: r.chain_of_thought,
      });
    }
  }

  async function verifierWorkFn(input, modelId) {
    progress(0);
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest');
    progress(0.1);
    const generator = await pipeline('text-generation', modelId, { dtype: 'q4', device: 'webgpu' });
    progress(0.5);
    const judgePrompt = `You are grading an AIME problem solution. Score the reasoning 0-10 (10 = airtight, 0 = nonsense). Output ONLY the score.\n\nProblem: ${input.problemText}\nProposed answer: ${input.candidate}\nReasoning: ${input.reasoning}\n\nScore:`;
    const out = await generator([{ role: 'user', content: judgePrompt }], { max_new_tokens: 8 });
    progress(1);
    const scoreMatch = out[0].generated_text.match(/\b(10|\d)\b/);
    return {
      problemId: input.problemId,
      candidate: input.candidate,
      score:     scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
    };
  }

  const job = compute.for(verifierInput, verifierWorkFn, [jobSpec.model]);
  job.public.name = `Strata: ${jobSpec.name} — verifier`;
  job.computeGroups = [{
    joinKey:    process.env.STRATA_GROUP_KEY,
    joinSecret: process.env.STRATA_GROUP_SECRET,
  }];

  const paymentAccount = await wallet.get('default');

  job.on('accepted', () => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/accepted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dcpJobId: job.id, total: verifierInput.length, phase: 'verifier' }),
    });
  });

  job.on('result', (ev) => {
    fetch(`${callbackUrl}/api/jobs/${jobId}/slice-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sliceIndex: ev.sort, phase: 'verifier', result: ev.result, computed: job.status.computed, total: job.status.total }),
    });
  });

  const verifierResults = Array.from(await job.exec(compute.marketValue, paymentAccount));

  // Aggregate: weighted vote per problem
  const winners = pickWinners(verifierResults);
  await fetch(`${callbackUrl}/api/jobs/${jobId}/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ winners }),
  });
  return winners;
}

function pickWinners(verifierResults) {
  const byProblem = {};
  for (const r of verifierResults) {
    byProblem[r.problemId] ??= {};
    byProblem[r.problemId][r.candidate] ??= [];
    byProblem[r.problemId][r.candidate].push(r.score);
  }
  const winners = {};
  for (const [problemId, candidates] of Object.entries(byProblem)) {
    let best = { answer: null, score: -1 };
    for (const [answer, scores] of Object.entries(candidates)) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (mean > best.score) best = { answer, score: mean };
    }
    winners[problemId] = best;
  }
  return winners;
}

module.exports = { runVerifier, pickWinners };
```

## Next.js side — slice-result handler ([app/api/jobs/[id]/slice-result/route.ts])

```ts
import { prisma } from '@/lib/db';
import { broadcastSSE } from '@/lib/sse';
import { requireWorkerAuth, pickDistributorForSlice, getJobPerSliceCents } from '@/lib/worker-callbacks';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  requireWorkerAuth(req);  // throws 401 if Authorization header missing/wrong — see 06-auth0.md
  const jobId = params.id;
  const { sliceIndex, phase, result, computed, total } = await req.json();

  await prisma.slice.updateMany({
    where: { jobId, index: sliceIndex, phase },
    data: { status: 'completed', resultData: JSON.stringify(result), completedAt: new Date() },
  });

  broadcastSSE(`job:${jobId}`, { type: 'slice_complete', sliceIndex, phase, result, computed, total });

  const distributorId = await pickDistributorForSlice(jobId);
  const sliceCents = await getJobPerSliceCents(jobId);
  const distributorCents = Math.floor(sliceCents * 0.68);
  const strataCents      = sliceCents - distributorCents;

  const slot = await prisma.computeSlot.findFirst({ where: { distributorId, active: true } });
  await prisma.settlement.create({
    data: { jobId, distributorId, slotId: slot!.id, grossCents: sliceCents, distributorCents, strataCents },
  });
  broadcastSSE(`distributor:${distributorId}`, { type: 'earnings_tick', amountCents: distributorCents });

  return new Response(null, { status: 204 });
}
```

The other six callback routes (`accepted`, `status`, `done`, `failed`, `slice-error`, plus the Distributor `stream`) follow the same shape — short handlers that persist + broadcast. Stub them out as you wire each event.

## Helpers ([src/lib/worker-callbacks.ts])

```ts
import { prisma } from './db';

export function requireWorkerAuth(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`) {
    throw new Response('Unauthorized', { status: 401 });
  }
}

// Demo-grade: round-robin among Distributors with at least one active slot.
// Production: thread the Node session id from DCP back through the slice metadata.
export async function pickDistributorForSlice(jobId: string): Promise<string> {
  const distributors = await prisma.distributor.findMany({
    where: { slots: { some: { active: true } } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (distributors.length === 0) throw new Error('no active distributors');
  // Cheap deterministic round-robin: hash jobId + slice count
  const sliceCount = await prisma.slice.count({ where: { jobId, status: 'completed' } });
  return distributors[sliceCount % distributors.length].id;
}

export async function getJobPerSliceCents(jobId: string): Promise<number> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { perSliceCents: true } });
  return job?.perSliceCents ?? 12; // default 12¢/slice
}
```

## Distributor SSE route ([app/api/distributors/[id]/stream/route.ts])

```ts
import { getSession } from '@/lib/auth';
import { subscribeSSE } from '@/lib/sse';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const distributor = await prisma.distributor.findUnique({ where: { id: params.id } });
  if (!distributor || distributor.userId !== session.userId) return new Response('Forbidden', { status: 403 });

  const stream = new ReadableStream({
    start(controller) {
      const unsub = subscribeSSE(`distributor:${params.id}`, controller);
      req.signal.addEventListener('abort', () => { unsub(); controller.close(); });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
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

`/api/jobs/[id]/stream/route.ts`:
```ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const stream = new ReadableStream({
    start(controller) {
      const unsub = subscribeSSE(`job:${params.id}`, controller);
      req.signal.addEventListener('abort', () => { unsub(); controller.close(); });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
```

**Note on SSE + Vercel:** SSE works on Vercel for up to 5 minutes per connection. Frontend reconnects on close. For demos longer than 5 min, consider running the Next.js app on Vultr alongside the submit worker.

## Pricing

`compute.marketValue` lets DCP pick market rate. For predictable demo cost, use:
```js
const results = await job.exec(compute.marketValue(0.5, 0.001), paymentAccount);
// (ratio, max DCC per slice)
```

## Key gotchas (from [docs/dcp-docs/](../docs/dcp-docs/))

1. **Work functions are stringified.** No closures over outer scope. All data through `datum` or the `args` array (third arg to `compute.for()`).
2. **`progress()` is mandatory** — at least once per ~30s or ENOPROGRESS kills the slice. Call it during model download stages too (model load can exceed 30s).
3. **Progress values must monotonically increase**: `progress(0)`, `progress(0.5)`, `progress(1)`. Plain `progress()` is also OK but values are preferred.
4. **Keystores live on disk** (`~/.dcp/`). Never reference them from frontend or Vercel functions.
5. **ENOFUNDS pauses the job; ENOPROGRESS cancels it.** Pre-fund and call `progress()` defensively.
6. **`localExec()` for testing** — `npm i dcp-worker` then `await job.localExec()` runs slices on the submit worker machine. Use during BE3 development.

## Fallback mode (Risk 1 mitigation)

If DCP scheduler is unreachable from conference WiFi, the submit worker falls back to in-process synchronous execution with mock latency. Set `DCP_MODE=fallback` env var. Implementation: same `runRollout`/`runVerifier` shape but call `rolloutWorkFn` directly in a loop with `await new Promise(r => setTimeout(r, 200))` between slices, posting results to the same callback URL. Demo path works, the "real DCP scheduler" claim weakens.
