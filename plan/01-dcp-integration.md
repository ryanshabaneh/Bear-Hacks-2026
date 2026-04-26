# DCP Integration — Concrete Patterns

## Init (backend, Node.js)

```js
const { init } = require('dcp-client');
await init('https://scheduler.distributed.computer');
const compute = require('dcp/compute');
const wallet  = require('dcp/wallet');
```

Keystores live in `~/.dcp/`. The `default.keystore` is the payment account (pre-funded with DCC). The `id.keystore` is the identity key.

## Phase 3 — Job submission (rollout job)

Input set: one object per slice. 30 problems × 8 rollouts = 240 slices.

```js
// Build input set: each element = one slice
const inputSet = [];
for (const problem of problems) {
  for (let rolloutIdx = 0; rolloutIdx < N_ROLLOUTS; rolloutIdx++) {
    inputSet.push({ problem, rolloutIdx, seed: rolloutIdx * 42 });
  }
}

// Work function runs inside the browser worker sandbox
// Cannot close over variables — all data comes through the input datum or args
function rolloutWorkFunction(datum, modelId) {
  // datum = { problem, rolloutIdx, seed }
  // This function runs inside a DCP sandbox (browser WebWorker or Node v8)
  // Gemma inference happens here via the 'onnx-gemma' module
  progress(0);
  const result = require('onnx-gemma').infer(modelId, datum.problem, {
    seed: datum.seed,
    max_tokens: 512,
    temperature: 0.7,
  });
  progress(1);
  return {
    problem: datum.problem,
    rolloutIdx: datum.rolloutIdx,
    chain_of_thought: result.reasoning,
    final_answer: result.answer,
    tokens_used: result.tokens,
  };
}

const job = compute.for(inputSet, rolloutWorkFunction, ['gemma-3-1b-it']);
job.public.name = 'Strata: Tessera reasoning eval';
job.public.description = 'Best-of-N rollouts for AIME problems';

// Compute Group: only Strata-registered workers pick this up
job.computeGroups = [{ joinKey: process.env.STRATA_GROUP_KEY, joinSecret: process.env.STRATA_GROUP_SECRET }];

// Payment
const paymentAccount = await wallet.get('default');
job.setSlicePaymentOffer(compute.marketRate);

// Listen for real-time progress
job.on('accepted', () => console.log('Job accepted, id:', job.id));
job.on('result', (ev) => {
  // ev.result = the object returned by rolloutWorkFunction
  // Emit to client via WebSocket
  broadcastSliceResult(ev);
});
job.on('error', (ev) => console.error('Slice error:', ev));

const results = await job.exec(compute.marketRate, paymentAccount);
```

## Phase 5 — Verifier job

After all rollouts return, group by problem, then run a second job to grade.

```js
// Build verifier input: one slice per (problem, candidate-answer) pair
// Group rollouts by problem first
const grouped = groupByProblem(rolloutResults); // Map<problem, answer[]>

const verifierInput = [];
for (const [problem, answers] of grouped.entries()) {
  for (const answer of answers) {
    verifierInput.push({ problem, candidate: answer.final_answer, reasoning: answer.chain_of_thought });
  }
}

function verifierWorkFunction(datum, modelId) {
  // datum = { problem, candidate, reasoning }
  progress(0);
  const score = require('onnx-gemma').judge(modelId, datum.problem, datum.candidate, datum.reasoning);
  progress(1);
  return { problem: datum.problem, candidate: datum.candidate, score }; // score 0-10
}

const verifierJob = compute.for(verifierInput, verifierWorkFunction, ['gemma-3-1b-it']);
verifierJob.public.name = 'Strata: Verifier pass';
verifierJob.computeGroups = [{ joinKey: process.env.STRATA_GROUP_KEY, joinSecret: process.env.STRATA_GROUP_SECRET }];

const verifierResults = await verifierJob.exec(compute.marketRate, paymentAccount);
```

## Aggregation (after verifier)

```js
function pickWinners(verifierResults) {
  // Group by problem
  const byProblem = {};
  for (const r of verifierResults) {
    if (!byProblem[r.problem]) byProblem[r.problem] = {};
    if (!byProblem[r.problem][r.candidate]) byProblem[r.problem][r.candidate] = [];
    byProblem[r.problem][r.candidate].push(r.score);
  }
  const winners = {};
  for (const [problem, candidates] of Object.entries(byProblem)) {
    let bestAnswer = null, bestScore = -1;
    for (const [answer, scores] of Object.entries(candidates)) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (mean > bestScore) { bestScore = mean; bestAnswer = answer; }
    }
    winners[problem] = { answer: bestAnswer, score: bestScore };
  }
  return winners;
}
```

## Compute Groups — what to set up

Strata needs its own Compute Group so that only Strata-registered worker nodes (visitor browsers running embed.js) pick up Strata jobs. The group key + secret come from the DCP Portal or can be generated.

Set in env:
```
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=<secret from DCP portal>
```

Workers (embed.js) must join the same group:
```js
// In embed.js / worker.js
const worker = new dcp.Worker({
  paymentAddress: DISTRIBUTOR_PAYMENT_ADDRESS,
  computeGroups: [{ joinKey: 'strata-2026', joinSecret: '<secret>' }],
});
await worker.start();
```

## Real-time status (WebSocket)

Backend emits events to frontend via WebSocket as slices complete:

```js
// On job.on('result') in backend
ws.send(JSON.stringify({
  type: 'slice_complete',
  jobId,
  sliceIndex: ev.sort,
  result: ev.result,
  computed: job.status.computed,
  total: job.status.total,
}));

// Distributor earnings tick
ws.send(JSON.stringify({
  type: 'earnings_tick',
  distributorId,
  amount: 0.12,          // DCC earned for this slice
  sliceFor: 'Tessera reasoning eval',
}));
```

## localExec for testing (no real workers needed)

During development, replace `job.exec()` with `job.localExec()` to run slices on the local machine. Requires `npm i dcp-worker`.

```js
// For testing without a worker network
const results = await job.localExec();
```

## Key gotchas from the docs

1. **Work functions cannot close over variables.** Everything the work function needs must come through `datum` (the input element) or the `arguments` array passed as the third arg to `compute.for()`.
2. **`progress()` is mandatory** — called at least once per slice. Slices that don't call progress within ~30s are killed by the scheduler.
3. **Work function is stringified** before sending to workers. No local imports; use DCP module system (`require()` inside the sandbox).
4. **Keystore management**: On Node.js backend, keystores live in `~/.dcp/`. Never expose private keys to the frontend.
5. **ENOFUNDS**: Listen for it and handle re-escrow gracefully in production. For hackathon, pre-fund enough DCC.
