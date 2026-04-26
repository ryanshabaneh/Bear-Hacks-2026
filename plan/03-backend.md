# Backend — Node.js DCP Orchestrator

## Responsibilities

- Auth0 JWT validation
- DCP job submission (compute.for) on behalf of Clients
- Result aggregation + verifier pass dispatch
- WebSocket → push real-time slice events to both dashboards
- Distributor earnings ledger (in-memory for hackathon, DB in prod)
- Serve embed.js

## Entry point

```
backend/
  src/
    index.js          # Express + WebSocket server
    dcp.js            # DCP init + job helpers
    jobs/
      rollout.js      # Phase 3 job
      verifier.js     # Phase 5 job
      aggregator.js   # Phase 5 aggregation
    routes/
      jobs.js         # POST /jobs, GET /jobs/:id
      distributors.js # GET /distributors/:id/earnings
    middleware/
      auth.js         # Auth0 JWT validation
    ws.js             # WebSocket broadcast helpers
  .env
  package.json
```

## Key routes

### POST /jobs

Client submits a job. Body: the JSON spec output by the Gemma translator.

```js
// Request body (from Gemma translator output)
{
  "template": "tessera_eval",
  "model": "gemma-3-1b-it",
  "n_rollouts": 8,
  "use_verifier": true,
  "input_set": ["AIME problem 1...", "AIME problem 2...", ...]
}

// Response
{ "jobId": "uuid", "slices": 240, "estimated_cost_usd": 90 }
```

### GET /jobs/:id/stream (WebSocket or SSE)

Streams slice completion events to the Client dashboard. Emits:
- `{ type: 'slice_complete', sliceIndex, result, computed, total }`
- `{ type: 'job_done', summary: { single_shot_accuracy, swarm_accuracy } }`

### GET /distributors/:id/earnings

Returns earnings for Distributor dashboard:
```js
{ today: 14.27, week: 89.40, pending: 89.40, recent: [...tick events] }
```

## DCP init (dcp.js)

```js
const { init } = require('dcp-client');

let compute, wallet;

async function initDCP() {
  await init('https://scheduler.distributed.computer');
  compute = require('dcp/compute');
  wallet  = require('dcp/wallet');
  console.log('DCP initialized');
}

module.exports = { initDCP, getCompute: () => compute, getWallet: () => wallet };
```

Call `initDCP()` once at server startup before any routes are hit.

## Job submission (rollout.js)

```js
const { getCompute, getWallet } = require('../dcp');
const { broadcast } = require('../ws');

async function submitRolloutJob(jobSpec, clientId) {
  const compute = getCompute();
  const wallet  = getWallet();

  const { input_set, n_rollouts, model } = jobSpec;

  // Build slice input array
  const inputSet = [];
  for (const problem of input_set) {
    for (let i = 0; i < n_rollouts; i++) {
      inputSet.push({ problem, rolloutIdx: i, seed: i * 7 + 13 });
    }
  }

  // Work function (stringified — no closures over outer scope)
  function rolloutWorkFn(datum, modelId) {
    progress(0);
    // For hackathon: simulate inference OR call a real model
    // Real path: require('strata-gemma').infer(modelId, datum.problem, datum.seed)
    const fakeAnswer = String(Math.floor(Math.random() * 999) + 1);
    progress(1);
    return {
      problem:        datum.problem,
      rolloutIdx:     datum.rolloutIdx,
      final_answer:   fakeAnswer,
      chain_of_thought: 'Step 1: ... Step 2: ...',
      tokens_used:    248,
    };
  }

  const job = compute.for(inputSet, rolloutWorkFn, [model]);
  job.public.name = 'Strata: Tessera eval';
  job.computeGroups = [{
    joinKey:    process.env.STRATA_GROUP_KEY,
    joinSecret: process.env.STRATA_GROUP_SECRET,
  }];

  const paymentAccount = await wallet.get('default');

  job.on('accepted', () => {
    broadcast(clientId, { type: 'job_accepted', jobId: job.id, total: inputSet.length });
  });

  job.on('result', (ev) => {
    broadcast(clientId, {
      type: 'slice_complete',
      sliceIndex: ev.sort,
      result: ev.result,
      computed: job.status.computed,
      total: job.status.total,
    });
    // Tick the Distributor's earnings (in-memory ledger)
    creditDistributor(ev);
  });

  job.on('error', (ev) => {
    broadcast(clientId, { type: 'slice_error', sliceIndex: ev.sliceIndex, message: ev.message });
  });

  const results = await job.exec(compute.marketRate, paymentAccount);
  return Array.from(results);
}

module.exports = { submitRolloutJob };
```

## Earnings ledger (in-memory, hackathon)

```js
// Simple in-memory store per distributor
const earnings = {}; // distributorId -> { today, week, ticks[] }

function creditDistributor(sliceEvent) {
  const DISTRIBUTOR_SHARE = 0.68;
  const amountDCC = 0.12 * DISTRIBUTOR_SHARE; // approx per slice

  // In real DCP, the payment goes directly via the DCP ledger.
  // Here we track it for the UI.
  const distributorId = lookupDistributorForSlice(sliceEvent);
  if (!earnings[distributorId]) earnings[distributorId] = { today: 0, week: 0, ticks: [] };
  earnings[distributorId].today  += amountDCC;
  earnings[distributorId].week   += amountDCC;
  earnings[distributorId].ticks.push({ amount: amountDCC, at: Date.now() });

  // Push to Distributor's dashboard WebSocket
  broadcast(distributorId, { type: 'earnings_tick', amount: amountDCC, sliceFor: sliceEvent.jobName });
}
```

## Auth0 middleware

```js
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
});

// Protect all /api routes
app.use('/api', checkJwt);

// Get account_type claim from token
function getAccountType(req) {
  return req.auth.payload['https://strata.com/account_type'];
}
```

## .env template

```
PORT=3001
AUTH0_DOMAIN=https://YOUR_TENANT.auth0.com/
AUTH0_AUDIENCE=https://strata-api
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=<from DCP portal>
DCP_SCHEDULER=https://scheduler.distributed.computer
```

## package.json deps

```json
{
  "dependencies": {
    "dcp-client": "latest",
    "express": "^4",
    "ws": "^8",
    "express-oauth2-jwt-bearer": "^1",
    "cors": "^2",
    "dotenv": "^16",
    "uuid": "^9"
  }
}
```
