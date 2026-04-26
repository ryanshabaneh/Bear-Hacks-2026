# Strata Architecture

Master reference: `strata-workflow.pdf`. When any other doc conflicts, PDF wins.

---

## The Seven Phases

1. **Distributor onboards.** Sign up (Auth0), add site, verify ownership via `/.well-known/strata.json`, get embed snippet.
2. **Client onboards.** Sign up (Auth0), fund Stripe, Strata escrows DCC.
3. **Job submission.** Client types intent, Gemma 4 translates to JSON, Strata dispatches via DCP.
4. **Node execution.** Random visitor lands on Distributor's site, embed quietly runs Gemma rollouts on slices.
5. **Verifier pass.** Second job grades the rollouts, weighted vote picks the winning answer.
6. **Results delivery.** Client gets answers + single-shot vs swarm comparison numbers.
7. **Payout.** Distributor accumulates DCC -> Stripe Connect -> bank.

---

## System Architecture

```
                        AUTH0 (real)
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
  DISTRIBUTOR DASHBOARD            CLIENT DASHBOARD
  - add site, verify              - fund balance (Stripe mock)
  - create slot                   - type intent (plain English)
  - copy embed snippet            - Gemma 4 translates -> JSON
  - view live earnings            - validate & submit
          |                       - view results + comparison
          |                                 |
          |     Next.js App (Vercel)        |
          |     one project, role-gated     |
          |     Prisma + SQLite (dev)       |
          |     Neon Postgres (prod)        |
          |                                 |
          |         STRATA API              |
          |    POST /api/jobs               |
          |    POST /api/slots              |
          |    GET  /api/embed/:slotId      |
          |    POST /api/slices/:id/result  |
          |    GET  /api/jobs/:id/stream    |
          |                                 |
          v                                 v
  EMBED (Cloudflare Pages)         DCP SUBMIT WORKER (Vultr)
  - strata.js IIFE                 - Node.js + dcp-client
  - runtime iframe                 - compute.for() x2:
  - footer chip UI                   1. rollout job (Phase 4)
  - DCP Worker in iframe             2. verifier job (Phase 5)
          |                        - listens for results
          v                        - writes to Strata API
  NODE BROWSER                              |
  - loads Gemma via WebGPU                  v
  - executes rollout slices        DCP SCHEDULER
  - executes verifier slices       (scheduler.distributed.computer)
  - progress() heartbeats         - slices jobs
  - returns results                - escrows DCC
                                   - dispatches to workers
                                     in matching Compute Group
```

---

## DCP Integration (from dcp-docs)

### Server-Side: DCP Submit Worker

Runs on Vultr VM (or local with ngrok fallback). This is the core DCP integration point.

**Rollout Job (Phase 4):**
```javascript
const compute = require('dcp/compute');

const inputSet = aimeProblems.flatMap(problem =>
  Array.from({ length: nRollouts }, (_, i) => ({
    problem: problem.text,
    problemId: problem.id,
    rolloutIndex: i,
    config: { temp: 0.7, style: "step-by-step", seed: baseSeed + i }
  }))
);

async function rolloutWorkFn(input) {
  // Load Gemma (cached after first slice in session)
  // Run inference on AIME problem
  // Return { chain_of_thought, final_answer, tokens_used }
  progress();
  // ... Gemma inference ...
  return result;
}

const job = compute.for(inputSet, rolloutWorkFn);
job.computeGroups = [{ joinKey, joinSecret }];
job.public = { name: "Tessera reasoning eval", description: "..." };

job.on('result', (ev) => {
  // ev.result.result = { chain_of_thought, final_answer, tokens_used }
  // ev.sort = slice index
  // POST to Strata API /api/slices/:id/result
});

job.on('status', (ev) => {
  // ev.total, ev.distributed, ev.computed
  // Push to Client dashboard via SSE
});

job.on('error', (ev) => {
  // ev.sliceIndex, ev.message
  // Log and handle retry
});

const results = await job.exec(compute.marketValue);
// After all 240 rollouts return -> trigger Phase 5
```

**Verifier Job (Phase 5):**
```javascript
// Group rollout results by problem
// For each problem, create verifier slices
const verifierInputSet = problems.map(p => ({
  problem: p.text,
  problemId: p.id,
  candidate_answer: rolloutResults[p.id].final_answer,
  reasoning: rolloutResults[p.id].chain_of_thought
}));

async function verifierWorkFn(input) {
  // Different Node runs as judge
  // "is this reasoning correct? score 0-10 + justification"
  progress();
  // ... Gemma inference as judge ...
  return { score, justification, correct: boolean };
}

const verifierJob = compute.for(verifierInputSet, verifierWorkFn);
verifierJob.computeGroups = [{ joinKey, joinSecret }];

// IMPORTANT: dispatched to different Nodes than rollout generators
// DCP handles this naturally since scheduler picks available workers

const verifierResults = await verifierJob.exec(compute.marketValue);
// Aggregate: count distinct answers, weight by verifier score, pick winner
```

**Key DCP constraints (from docs):**
- Work functions are stringified via `Function.prototype.toString()` -- cannot close over local variables
- Must call `progress()` at least once per ~30 seconds or ENOPROGRESS kills the slice
- Progress values must increase: `progress(0.1)`, `progress(0.5)`, `progress(1.0)`
- Results arrive via `job.on('result', ev)` where `ev.sort` = slice index
- `job.on('status', ev)` gives `total`, `distributed`, `computed` counts
- ENOFUNDS pauses the job; ENOPROGRESS cancels it
- `compute.marketValue` or `compute.marketValue(ratio, max)` for pricing
- Private Compute Groups via `job.computeGroups = [{ joinKey, joinSecret }]`

### Browser-Side: Node Worker (inside embed runtime iframe)

```html
<!-- Runtime iframe loads dcp-client from scheduler -->
<script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
```

```javascript
// Inside runtime iframe
const worker = new dcp.worker.Worker({
  paymentAddress: STRATA_PAYMENT_ADDRESS,
  maxWorkingSandboxes: 1,
  computeGroups: [{ joinKey, joinSecret }]
});

worker.start();
// Worker now pulls slices from DCP scheduler
// Work function (rollout or verifier) executes in sandbox
// Results sent back to scheduler -> submit worker
```

**Browser capabilities (from dcp-docs `calculate-capabilities`):**
- `environment.offscreenCanvas` -- for WebGL/WebGPU rendering
- `environment.fdlibm` -- for deterministic math (Chrome/Firefox yes, Safari no)
- WebGPU not yet in DCP's formal capability system but available via `navigator.gpu`
- Gemma model loads via `@huggingface/transformers` with `device: "webgpu"` (from tessera-test)

### Gemma Model Loading (from tessera-test/index.html)

```javascript
const { pipeline } = await import(
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest"
);

const generator = await pipeline(
  "text-generation",
  "onnx-community/gemma-3-1b-it-ONNX",
  { dtype: "q4", device: "webgpu" }
);

// ~2GB download on first load, cached in browser after
// First slice: 2-10s warm load (or 2-3min cold)
// Subsequent slices: instant (model in memory)
```

**Integration challenge:** The work function inside DCP's sandbox is stringified and runs in an isolated V8 environment. Loading Gemma inside a DCP sandbox requires either:
1. The work function itself doing a dynamic import of transformers.js (if the sandbox allows network access)
2. Pre-loading the model outside the sandbox and passing it via a mechanism the sandbox can access
3. Using `require()` which is available in the sandbox for CommonJS modules

This is the highest-risk integration point. Test early at T+2.

---

## Data Model (Prisma)

```
User
  id, auth0Sub, email, role (distributor|client|admin)

Distributor (1:1 with User)
  id, displayName, stripeConnectAccountId, status

Client (1:1 with User)
  id, displayName, stripeCustomerId, balanceCents

Site
  id, distributorId, domain, verificationToken, verified

ComputeSlot
  id, siteId, distributorId, name, active

Job
  id, clientId, name, description, status (queued|rollouts|verifying|done|failed)
  workFnTemplate, inputSetConfig, inputCount
  nRollouts, useVerifier
  budgetCents, perSliceCents
  dcpJobId (rollout), dcpVerifierJobId
  pcgJoinKey, pcgJoinSecret

Slice
  id, jobId, index, phase (rollout|verifier)
  status (pending|claimed|completed|failed)
  nodeSession, resultHash, resultData (JSON)

Settlement
  id, jobId, distributorId, slotId
  grossCents, distributorCents (68%), strataCents (32%)
```

---

## Demo Workload: Best-of-N Reasoning Eval

**The pitch:** Sarah (ML PhD student) wants to evaluate Gemma 4 on AIME 2024. Instead of paying $1200 on AWS, she pays $87 on Strata AND gets better results because of best-of-N.

**Numbers:**
- 30 AIME problems x 8 rollouts = 240 rollout slices (Phase 4)
- 30 problems x ~8 verifier slices = ~240 verifier slices (Phase 5)
- Total: ~480 slices across two compute.for() calls
- Each slice: 10-30s of Gemma inference
- Results: single-shot accuracy ~23%, swarm accuracy ~58%, improvement +35pp

**Client targeting: TBD.** Still brainstorming who the ideal Clients are. Current candidates from the spec: research labs, newsrooms, nonprofits, indie developers. The AIME eval demo works for any of these but the marketing framing may shift.

---

## Demo Path (5 minutes, from PDF)

**Pre-stage:**
- Distributor account pre-created
- Client account pre-created
- Embed already on a fake demo site
- ~6 team laptops pre-warmed as Nodes with Gemma cached

**Live demo, in order:**
1. Sarah signs into Client dashboard (skip live -- start logged in)
2. Sarah types intent in plain English. Gemma 4 translator emits JSON. Validate & Submit.
3. Switch to Distributor dashboard -- show live earnings tick as Nodes complete slices
4. Switch back to Client dashboard -- results stream in problem-by-problem
5. Final comparison panel: swarm beats single-shot. Read the number out loud.
6. (Optional) Open embed-enabled demo site, show footer chip + explainer modal

**What to cut:** Phases 1-2 (signup) and Phase 7 (payout) live as screenshots in deck/Devpost. Phases 3-6 are the live path.

---

## Prize Targets

| Track | Prize | How Strata hits it |
|---|---|---|
| Overall 1st-3rd | $3K-$1.1K CAD + hardware | Full polished web app, deployed, novel compute marketplace |
| Best Use of DCP | $660 CAD | Strata IS the missing dcp-distribute-client. Two compute.for() calls (rollout + verifier). PCG. Real DCP integration. |
| Best Use of Gemma 4 | Google Swag | Gemma 4 runs twice: as translator (Phase 3) and as the compute workload (Phase 4+5). Browser-side via WebGPU. |
| Best UI/UX Design | $700 CAD | Two polished dashboards + footer chip (novel web pattern) + live streaming results |
| Best Use of Auth0 | Wireless Headphones | Real Auth0 Universal Login for Distributor + Client signup |
| Best Demo Video | $100 GC | 90-second demo video per script |
| Most Fun | $400 CAD | Live tile-fill / result streaming is engaging |

Stretch: Google Cloud Vision ($850 if we add a vision workload template), Vultr ($monitor if DCP submit worker runs there).

---

## Build Phases and Task Assignment

Team: 4 people. **FE** (frontend), **BE1**, **BE2**, **BE3** (backend).

### Build Phase 1: Skeleton + DCP Proof (Hours 0-6)

Goal: app boots, DCP works end-to-end with one slice, auth stubs in place.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| Next.js scaffold + Prisma + SQLite + schema from data model above | BE1 | 2 | App boots, `npm run build` green, DB migrated |
| Auth0 tenant setup + stub-mode auth (cookie-based, env-gated `AUTH_MODE=stub\|auth0`) | BE2 | 2 | Login works in stub mode, role picker, session cookie |
| DCP proof-of-concept: `compute.for()` on Vultr/local, one Gemma rollout slice, result received | BE3 | 4 | Node.js submits job, browser worker picks it up, result returns |
| Gemma-in-browser proof: load model in iframe, run one inference, measure timing | BE3 | 2 | (parallel with DCP proof -- same person, different test) |
| Design system: `globals.css` @theme tokens, shadcn init, AppShell layout (topbar + sidebar + content) | FE | 3 | Shell renders, tokens applied, shadcn components available |
| Landing page + role picker (Distributor/Client) | FE | 1 | `/` and `/signup` routes render |

**Phase 1 exit:** Vercel preview deploys on push. Stub auth works. DCP `compute.for()` returns one result. Gemma loads in browser.

### Build Phase 2: Vertical Slices per Surface (Hours 6-14)

Goal: each dashboard has its core flow working end-to-end with mock data where needed.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Distributor onboarding flow** (add site, verify via `/.well-known/strata.json`, get embed snippet) | BE1 | 4 | Flows A.1-A.5 working with stub auth |
| **Distributor dashboard** (sites list, slots, earnings KPIs with mock data, embed snippet copy) | FE | 4 | Dashboard renders, empty states, KPI tiles |
| **Client dashboard** (job list, balance card, job submission form, results view) | FE | 4 | Dashboard renders, job form works, results table shell |
| **Client onboarding + job submission API** (create job, fund balance mock, Stripe Elements mock) | BE2 | 4 | POST /api/jobs creates Job + Slices in DB, mock balance deduction |
| **DCP submit worker: rollout job pipeline** (take Job from DB, build inputSet from AIME problems, call compute.for(), listen for results, write Slice rows) | BE3 | 6 | Full Phase 4 pipeline: Job -> compute.for() -> results -> DB |
| **Embed runtime IIFE + iframe** (strata.js injects iframe, iframe loads dcp-client, worker.start(), footer chip UI) | BE1 | 4 | Embed loads on a test page, DCP worker starts, footer chip visible |

**Phase 2 exit:** Distributor can add site + get snippet. Client can submit a job. DCP dispatches rollout slices. Embed loads and worker starts. Dashboards render with shell data.

### Build Phase 3: Integration + Verifier (Hours 14-22)

Goal: end-to-end demo path works once. Verifier pass implemented. Live streaming.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Verifier job pipeline** (Phase 5): after rollouts complete, group by problem, second compute.for() with judge work function, aggregate scores, pick winners | BE3 | 6 | Two-phase compute works: rollout -> verify -> final answers |
| **Gemma 4 translator** (Phase 3): client types plain English, Gemma translates to job JSON (template, model, n_rollouts, input_set). Runs client-side or via HF API | BE2 | 4 | Text input -> structured JSON -> pre-filled job form |
| **SSE/WebSocket live streaming**: job status, slice completion, earnings tick. `/api/jobs/:id/stream` pushes events as DCP results arrive | BE1 | 4 | Client dashboard updates live. Distributor earnings tick live. |
| **Results delivery UI** (Phase 6): results table (Problem | Single-shot | Swarm), accuracy comparison, download CSV | FE | 4 | Results page shows comparison panel with real numbers |
| **Embed runtime: consent + explainer modal** (footer chip states, pause toggle, "What is this?" modal) | FE | 2 | Footer chip interactive, explainer modal opens |
| **Settlement calculation**: on job complete, compute 68/32 split, write Settlement rows, update Distributor earnings | BE2 | 2 | Payout numbers show on Distributor dashboard |
| **Wire end-to-end**: Client submits -> DCP rollouts -> DCP verify -> results stream -> settlement | ALL | 2 | Full demo path runs once on production URLs |

**Phase 3 exit:** Demo path works end-to-end. Record backup video at this checkpoint.

### Build Phase 4: Polish + Demo Prep (Hours 22-30)

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Distributor earnings panel**: real Settlement data, live tick animation, payout UI (mocked Stripe Connect) | FE | 3 | Earnings panel polished with settle-tone accent |
| **Client billing panel**: Stripe Elements card capture (test mode), balance display, cost breakdown | FE | 2 | Billing page looks production-ready |
| **Real Auth0 swap-in**: flip `AUTH_MODE=auth0`, configure callbacks on production URL, test full login flow | BE2 | 2 | Real Auth0 login works on Vercel |
| **Resilience: demo fallback mode**: if DCP scheduler unreachable, run jobs synchronously in-process with mock latency | BE3 | 2 | Fallback mode tested, labeled in UI |
| **Multiple Node simulation**: open 5-6 tabs as Nodes, verify parallel slice execution, Gemma cached after first load | BE3 | 2 | 6 Nodes contribute simultaneously |
| **Dashboard SSE polish**: reconnection on drop, loading states, empty states | BE1 | 2 | No broken states during demo |
| **5x end-to-end dry runs on conference WiFi** (or phone hotspot) | ALL | 3 | Stable demo path |

### Build Phase 5: Demo Video + Submit (Hours 30-36)

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Record demo video** (90 seconds, per PDF demo path) | FE + BE3 | 2 | Video uploaded to Devpost |
| **Pitch deck + judge talking points** | BE1 + BE2 | 2 | Slide deck ready |
| **Devpost long-form description** | ALL | 1 | Submission complete |
| **Final dry-runs** (4x full demo) | ALL | 2 | Everything works |
| **Submit on Devpost** at T-35:50 | ALL | 0.5 | Submitted before deadline |

---

## Per-Person Ownership Map

### FE (Frontend)
- Design system + tokens + shadcn setup
- AppShell (topbar + sidebar + content slot)
- Landing page + signup
- Distributor dashboard (sites, slots, earnings, embed snippet)
- Client dashboard (jobs, balance, submission form, results)
- Results comparison panel (Phase 6 UI -- the money shot)
- Footer chip + explainer modal (Phase 4 UI)
- Demo video recording

### BE1 (Backend 1)
- Next.js scaffold + Prisma schema + migrations
- Distributor onboarding API (sites, slots, verification)
- Embed runtime (strata.js IIFE + runtime iframe)
- SSE live streaming infrastructure
- Dashboard SSE polish + reconnection

### BE2 (Backend 2)
- Auth0 setup (stub + real)
- Client onboarding + job submission API
- Gemma 4 translator (plain English -> JSON)
- Settlement calculation (68/32 split)
- Stripe mock integration (Elements + Connect)

### BE3 (Backend 3 -- DCP Lead)
- DCP proof-of-concept (compute.for + browser worker)
- Gemma-in-browser proof (WebGPU model loading)
- Rollout job pipeline (Phase 4: AIME -> compute.for -> results)
- Verifier job pipeline (Phase 5: second compute.for -> aggregate -> winners)
- Demo fallback mode (synchronous if scheduler down)
- Node simulation (multiple tabs as workers)

---

## Key Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemma can't load inside DCP sandbox (stringified work fn can't dynamic-import) | HIGH | Critical | Test at T+2. Fallback: pre-load model in iframe, pass to sandbox via shared state. Or: work fn fetches model via allowed URL. |
| Conference WiFi blocks `scheduler.distributed.computer` | Medium | Total demo failure | Phone hotspot as primary. Fallback mode (in-process sync). Pre-recorded video. |
| 30s ENOPROGRESS kills Gemma inference slices (model loading takes >30s on cold start) | Medium | Slices fail | Call `progress()` during model download stages. Pre-warm Gemma on demo laptops before demo. |
| Cross-origin iframe CSP issues on demo Distributor site | Medium | Embed doesn't load | Demo Distributor is a page we control with permissive CSP. |
| Auth0 callback misconfiguration on Vercel production URL | High | Login broken | Lock to one production URL. Configure callbacks at T+0. Test at T+22, T+30, T+34. |
| Verifier job takes too long (480 total slices with only 6 Node laptops) | Medium | Demo runs slow | Pre-compute some results. Reduce to N=4 rollouts if needed. Show subset live. |

---

## DCP-Specific Notes (from docs)

**What DCP provides that we use:**
- `compute.for(inputSet, workFn, args)` -- job submission
- `job.on('result'|'status'|'error'|'complete')` -- event streaming
- `job.computeGroups = [{ joinKey, joinSecret }]` -- private compute
- `compute.marketValue` -- market-rate pricing
- DCC escrow via Bank
- Browser sandbox with `progress()` heartbeat
- `work.public` for job metadata (name, description)

**What DCP does NOT provide (we build):**
- Verifier/consensus mechanism -- we implement as a second compute.for() call
- Distributor onboarding -- we build the signup + verification
- Revenue split (68/32) -- we calculate from DCC ledger
- Footer chip / consent UI -- we build in the embed runtime
- Gemma model loading inside work functions -- we figure out the integration
- Job templates / natural language translation -- we build with Gemma 4

**DCP capabilities system (from calculate-capabilities):**
- `environment.fdlibm` -- deterministic math
- `environment.offscreenCanvas` -- canvas rendering
- `details.offscreenCanvas.bigTexture*` -- WebGL texture sizes
- `engine.es7` -- ES7 compliance
- WebGPU: not formally in capability system yet, but available via `navigator.gpu`
- No native consensus/reputation system

---

## Open Questions

1. **Client targeting** -- who are the ideal Clients? Research labs, newsrooms, nonprofits, indie devs? Affects marketing copy and demo framing.
2. **Gemma-in-sandbox feasibility** -- can the DCP sandbox dynamic-import transformers.js and load a 2GB model? Test at T+2 before committing.
3. **Rollout count for demo** -- 8 rollouts x 30 problems = 240 slices. With 6 Node laptops, each handling ~40 slices at 15s each = ~10 min. Acceptable? Reduce to N=4 if too slow.
4. **Single PCG or per-job PCG** -- one global PCG simplifies demo. Per-job is cleaner. Start with global, note as v2 fix.
5. **Verifier dispatch to different Nodes** -- DCP scheduler picks available workers naturally, but doesn't guarantee a different Node than the rollout generator. For demo: acceptable. For prod: need a mechanism.
