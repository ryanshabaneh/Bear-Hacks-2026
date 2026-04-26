# Strata Architecture

Master reference: `strata-workflow.pdf`. When any other doc conflicts, PDF wins.

Locked direction (2026-04-25): single vertical, creator-economy transcription via Whisper-WebGPU on browser DCP workers. Atmospheric vocabulary on user-facing surfaces; technical primitives in code.

---

## The Seven Phases

1. **Distributor onboards.** Sign up (Auth0), add site, verify ownership via `/.well-known/strata.json`, get embed snippet.
2. **Client onboards.** Sign up (Auth0), fund Stripe, Strata escrows DCC.
3. **Forecast composed.** Client drops audio (RSS / YouTube / file upload), optionally types plain English (Gemma 4 1B browser-WebGPU translates to Forecast spec). Strata slices into 30s chunks and dispatches via DCP.
4. **Front opens, Rain falls.** Random visitor lands on a Distributor's site, embed runtime quietly runs Whisper-WebGPU on assigned chunks (Slices). Each chunk runs k=2 redundantly across two Nodes.
5. **Quorum + oracle.** Strata server-side compares semantic hashes from the k=2 attempts. Matched pairs collapse to one accepted Slice. 1-3% sample re-runs against a server-side Whisper oracle for spot-check. Mismatches reissue.
6. **Catchment delivery.** Slices assemble in timestamp order (not arrival order). Client downloads SRT + VTT + JSON + plain bundle, with Attestation log included by default.
7. **Payout.** Distributor accumulates DCC → Stripe Connect → bank. 68% Distributor / 32% Strata.

---

## System Architecture

```
                        AUTH0 (real, SDK v4.19)
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
  DISTRIBUTOR DASHBOARD            CLIENT DASHBOARD
  - add site, verify              - fund balance (Stripe mock)
  - create slot                   - Forecast Composer (RSS/YouTube/upload)
  - copy embed snippet            - Gemma 4 plain-English translator (stretch)
  - SliceTicker live earnings     - Forecast Detail (CycleBudgetMeter,
          |                         CatchmentAssembling, CapabilityBloom)
          |                                 |
          |     Next.js 16.2 App Router     |
          |     Prisma 6.19 + SQLite (dev)  |
          |     Neon Postgres (prod)        |
          |     @base-ui/react, shadcn 4.5  |
          |                                 |
          |         STRATA API              |
          |    POST /api/forecasts          |
          |    POST /api/slots              |
          |    GET  /api/embed/:slotId/config|
          |    POST /api/scheduler/slice-callback|
          |    GET  /api/forecasts/:id/stream|
          |                                 |
          v                                 v
  EMBED (Cloudflare Pages)         DCP SUBMIT WORKER (Vultr / ngrok)
  - strata.js IIFE                 - Node.js + dcp-client (pinned)
  - runtime iframe (embed.strata.app)  - one compute.for() per Forecast
  - footer chip UI                   with k=2 redundancy
  - DCP Worker in iframe           - server-side semantic-hash quorum
          |                        - server-side oracle Whisper for 1-3% spot
          v                        - Catchment assembly in timestamp order
  NODE BROWSER                              |
  - loads Whisper-base ONNX                 v
    via WebGPU (Whisper-tiny       DCP SCHEDULER
    via WASM-SIMD fallback)        (scheduler.distributed.computer)
  - executes 30s audio Slices      - slices jobs
  - progress() heartbeats          - escrows DCC
  - returns transcript + hash      - dispatches to public
                                     DCP worker pool
```

---

## DCP Integration (from dcp-docs)

### Server-Side: DCP Submit Worker

Runs on Vultr VM (or local with ngrok fallback). One `compute.for()` per Forecast. No second verifier job — k=2 quorum and oracle spot-check are server-side, not a second DCP dispatch.

```javascript
const compute = require('dcp/compute');

// Build inputSet: each Forecast becomes N chunks × 2 (k=2 redundancy).
const inputSet = chunkManifest.flatMap(chunk =>
  [1, 2].map(attemptNumber => ({
    chunkIndex:    chunk.index,
    chunkUrl:      chunk.cdnUrl,           // RemoteDataPattern, pre-registered
    timestampStart: chunk.tsStart,
    timestampEnd:   chunk.tsEnd,
    attemptNumber,
  }))
);

// Work function bundle is Strata-hosted, version-pinned.
// Loaded inside the sandbox via the bundle URL (Option B), or content-addressed (Option C).
const job = compute.for(inputSet, whisperWorkFn);
// No `job.computeGroups` — public DCP network. See 01-preflight.md §2.
job.public = { name: "Strata transcription", description: "Forecast " + forecastId };

job.on('result', (ev) => {
  // ev.result.result = { chunkIndex, attemptNumber, srt, semanticHash, cyclesConsumed }
  // POST to Strata API /api/scheduler/slice-callback
  // Server compares this semantic hash to the other attempt's hash.
  // Match → mark Slice completed. Mismatch → reissue or escalate to oracle.
});

job.on('status', (ev) => {
  // ev.total, ev.distributed, ev.computed
  // Push to Forecast Detail via SSE.
});

job.on('error', (ev) => {
  // ev.sliceIndex, ev.message — log and reissue.
});

const results = await job.exec(compute.marketValue);
// After all Slices return → Catchment assembly → seal.
```

**Key DCP constraints (from /docs/dcp-docs/):**
- Work functions are stringified via `Function.prototype.toString()` — cannot close over local variables
- Must call `progress()` at least once per ~30 seconds or ENOPROGRESS kills the slice
- Progress values must increase: `progress(0)`, `progress(0.3)`, `progress(0.5)`, `progress(1)`
- Results arrive via `job.on('result', ev)` where `ev.sort` = slice index
- ENOFUNDS pauses the job; ENOPROGRESS cancels it
- `compute.marketValue` (or `compute.marketValue(ratio, max)`) for pricing
- No IndexedDB, no WebSocket, no Playwright inside the sandbox
- RemoteDataPattern is the only fetch surface inside the sandbox; all chunk URLs and the model URL must be pre-registered

### Browser-Side: Node Worker (inside embed runtime iframe)

```html
<!-- Runtime iframe loads dcp-client from scheduler -->
<script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
```

```javascript
// Inside runtime iframe at https://embed.strata.app/runtime.html
const worker = new dcp.worker.Worker({
  paymentAddress: STRATA_PAYMENT_ADDRESS,
  maxWorkingSandboxes: 1,
});

worker.start();
// Worker pulls Slices from DCP scheduler.
// Whisper work function executes in sandbox.
// Results sent back to scheduler → submit worker.
```

**Browser capabilities (from dcp-docs `calculate-capabilities`):**
- `environment.offscreenCanvas` — for WebGPU rendering
- `environment.fdlibm` — deterministic math (Chrome/Firefox yes, Safari no)
- WebGPU not yet in DCP's formal capability system but available via `navigator.gpu`
- `OfflineAudioContext` for audio decode inside the sandbox

### Whisper-WebGPU Model Loading

```javascript
// Inside the work function (delivered as a Strata-hosted version-pinned bundle).
// transformers.js v3 is bundled, NOT runtime-imported from jsdelivr.

const { pipeline } = transformersBundle;

const transcriber = await pipeline(
  'automatic-speech-recognition',
  'Xenova/whisper-base',                  // ~150MB ONNX, fetched as RemoteDataPattern
  { dtype: 'fp32', device: 'webgpu' }     // falls back to WASM-SIMD + 'Xenova/whisper-tiny' if no WebGPU
);

// Cold start: ~6-12s on WebGPU, ~4-8s on WASM-SIMD fallback.
// Warm slices in same tab: near-instant (model in memory).
// V8 sandbox has no persistent worker cache: every NEW tab is a cold start.
```

**Integration lock:** the work function bundle is Strata-hosted and version-pinned (Option B in [08-risks.md Risk 1](08-risks.md)). The Whisper model file is a separate RemoteDataPattern URL passed in slice input. Audio chunks are RemoteDataPattern URLs registered with the scheduler. All three fetch destinations must be RemoteDataPattern-registered with the scheduler before the Forecast submits.

This is the highest-risk integration point. Test early at T+2.

---

## Data Model (Prisma)

Source-of-truth shape for the locked transcription runtime. `Forecast` replaces `Job`; `Catchment` is the assembled bundle; `Attestation` is the per-Slice signed receipt. Site and ComputeSlot keep their technical names in code; user-facing copy uses atmospheric nouns.

```
User
  id, auth0Sub, email, role (distributor|client|admin)

Distributor (1:1 with User)
  id, displayName, dcpPaymentAddress, stripeConnectAccountId, status

Client (1:1 with User)
  id, displayName, stripeCustomerId, balanceCents, tier (provisional|verified|trusted),
  completedAudioHoursTotal, daysSinceSignup

Site
  id, distributorId, domain, verificationToken, verified

ComputeSlot
  id, siteId, distributorId, name, embedKey, allowedCategories, active

Forecast
  id, clientId, status (queued|active|sealing|sealed|failed),
  inputManifestUrl, audioHoursTotal, languageScope, outputFormats,
  webhookUrl, budgetCents, frontOpenedAt, sealedAt
  workFunctionVersion (e.g. "strata-whisper-v1")

Slice
  id, forecastId, chunkIndex, timestampStart, timestampEnd, inputUrl,
  attemptNumber (1, 2, 99=oracle), status (issued|running|completed|failed|dropped),
  nodePubkey, outputHash, outputText, cyclesConsumed, issuedAt, completedAt

Catchment
  id, forecastId (unique), bundleUrl, audioHoursSealed,
  slicesCompleted, slicesTotal, sealedAt

Attestation
  id, sliceId (unique), nodePubkey, nodeRegionGlyph, outputHash, schedulerSig, ts

Settlement
  id, forecastId, distributorId, slotId, grossCents,
  distributorCents (68%), strataCents (32%)
```

Atmospheric vocab map (user-facing only): `Forecast` is the job spec; `Slice` is one chunk's work; `Catchment` is the delivered bundle; `Attestation` is the per-Slice receipt; `Sky` is the aggregate of online Nodes at any moment; `Front` is the dispatch event; `Rain` is one Slice falling on one Node.

Tier promotion is automatic, no admin UI:
- Provisional → Verified at 50 audio-hours completed AND 7 days since signup AND zero anomalies.
- Verified → Trusted at 5,000 audio-hours completed AND 60 days since signup AND zero anomalies.
- Capability ceilings (audio-hours/month): Provisional 100 / Verified 10,000 / Trusted 1,000,000. Submit worker rejects new Forecasts once a Client's monthly ceiling is hit.

---

## Demo Workload: Creator-Economy Transcription

**The pitch:** Maya runs a podcast network. Four new episodes a week, ~40 audio-hours/month. She drops them in the Forecast Composer. Whisper runs across browser tabs on indie-blog Distributor sites. SRT comes back at $0.04 per audio-hour.

**Numbers (30-60 min demo fixture):**
- 60-120 chunks (30s each) × k=2 redundancy = 120-240 dispatched cycles
- Each cycle: ~10s Whisper-base WebGPU inference (warm)
- On 6 Nodes: ~3-4 min wall-clock for the full Catchment to seal
- Cost: 30-60 min × $0.04/audio-hour = $0.02-0.04
- Comparison: same workload on Rev human ($45-90), Rev AI ($0.60-1.20), OpenAI Whisper API ($0.18-0.36), AssemblyAI batch ($0.06-0.12)

**Client targeting (locked):** creators — podcasters, YouTubers, course creators, content farms. The Composer's three input tabs (RSS / YouTube channel URL / file upload) are all creator-shaped.

---

## Demo Path (5 minutes, from PDF)

See [07-demo-script.md](07-demo-script.md) for the full narrated script. Summary:

**Pre-stage:**
- Distributor account pre-created
- Client account pre-created
- Embed already on a fake creator-content demo site
- 6 team browser tabs pre-warmed as Nodes with Whisper bundle in memory

**Live demo, in order:**
1. Maya signs into Client dashboard (skip live — start logged in)
2. Maya drops audio in Forecast Composer. Gemma 4 translator emits Forecast spec JSON. Open Front.
3. Switch to Distributor dashboard — show SliceTicker, Catchment ticking up
4. Switch back to Client dashboard — Catchment fills column-by-column in timestamp order
5. Final cost panel: $0.04/audio-hour vs Rev / Rev AI / Whisper API / AssemblyAI. Read the wedge out loud.
6. (Optional) Open embed-enabled demo site, show footer chip + explainer modal

**What to cut:** Phases 1-2 (signup) and Phase 7 (payout) live as screenshots in deck/Devpost. Phases 3-6 are the live path.

---

## Prize Targets

| Track | Prize | How Strata hits it |
|---|---|---|
| Overall 1st-3rd | $3K-$1.1K CAD + hardware | Polished web app, deployed, novel creator-economy compute marketplace |
| Best Use of DCP | $660 CAD | Strata is the missing dcp-distribute-client. One `compute.for()` per Forecast with k=2 redundancy + server-side semantic-hash quorum + oracle spot-check. Real PCG. Real DCP integration. |
| Best Use of Gemma 4 | Google Swag | Gemma 4 1B in browser-WebGPU as the Forecast Composer's plain-English-to-spec translator. Cheap to wire if the Whisper-WebGPU spike succeeds (same `transformers.js` v3 dependency). |
| Best UI/UX Design | $700 CAD | Two polished dashboards, atmospheric signature components (CycleBudgetMeter as barometric gauge, SliceTicker, CatchmentAssembling), footer chip, prefers-reduced-motion fallback. |
| Best Use of Auth0 | Wireless Headphones | Real Auth0 Universal Login (SDK v4) for Distributor + Client signup. Custom `account_type` claim via Login Action, role-gated layouts. |
| Best Demo Video | $100 GC | 90-second video per [07-demo-script.md](07-demo-script.md). |
| Most Fun | $400 CAD | CatchmentAssembling fills column-by-column in timestamp order — engaging to watch. |

Stretch: Vultr ($monitor) if DCP submit worker runs there.

---

## Build Phases and Task Assignment

Team: 4 people. **FE** (frontend, Kelly), **BE1**, **BE2**, **BE3** (DCP lead).

### Build Phase 1: Skeleton + Whisper-on-DCP Spike (Hours 0-6)

Goal: app boots, DCP works end-to-end with one Whisper Slice, auth stubs in place.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| Next.js 16.2 scaffold + Prisma 6 + SQLite + schema (User/Distributor/Client/Site/ComputeSlot + new Forecast/Slice/Catchment/Attestation) | BE1 | 2 | App boots, `npm run build` green, DB migrated |
| Auth0 v4.19 tenant setup + stub-mode auth (cookie-based, env-gated `AUTH_MODE=stub\|auth0`) | BE2 | 2 | Login works in stub mode, role picker, session cookie |
| DCP proof-of-concept: `compute.for()` on Vultr/local, one Whisper-base Slice, transcript received | BE3 | 4 | Submit worker dispatches, browser worker picks it up, transcript returns |
| Whisper-in-browser proof: load Whisper-base ONNX in iframe via transformers.js v3, decode 30s clip on WebGPU, measure timing | BE3 | 2 | (parallel with DCP proof — same person, different test) |
| Design system: `globals.css` @theme tokens, shadcn 4.5 + @base-ui/react primitives, AppShell layout | FE | 3 | Shell renders, tokens applied, atmospheric palette |
| Landing page + role picker (Distributor/Client) with atmospheric copy | FE | 1 | `/` and `/signup` routes render |

**Phase 1 exit:** Vercel preview deploys on push. Stub auth works. DCP `compute.for()` returns one Whisper transcript. WebGPU loads Whisper-base in browser.

### Build Phase 2: Vertical Slices per Surface (Hours 6-14)

Goal: each dashboard has its core flow working end-to-end with mock data where needed.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Distributor onboarding flow** (add site, verify via `/.well-known/strata.json`, get embed snippet) | BE1 | 4 | Onboarding works with stub auth |
| **Distributor dashboard** (sites list, slots, SliceTicker live earnings, embed snippet copy) | FE | 4 | Dashboard renders, KPI tiles, atmospheric components |
| **Client dashboard** (Forecast list, balance card, Forecast Composer, Forecast Detail shell) | FE | 4 | Dashboard renders, Composer works, Catchment table shell |
| **Client onboarding + Forecast submission API** (POST /api/forecasts creates Forecast + Slices, mock balance deduction) | BE2 | 4 | API creates Forecast + Slice rows in DB |
| **DCP submit worker: Forecast pipeline** (take Forecast from DB, build inputSet from chunk manifest with k=2 redundancy, call compute.for(), listen for results, write Slice rows + Attestation rows) | BE3 | 6 | End-to-end Forecast pipeline (one Forecast through quorum) |
| **Embed runtime IIFE + iframe** (strata.js injects iframe at embed.strata.app, iframe loads dcp-client + version-pinned Whisper bundle, footer chip UI with atmospheric copy) | BE1 | 4 | Embed loads on test page, DCP worker starts, footer chip visible |

**Phase 2 exit:** Distributor can add site + get snippet. Client can submit a Forecast. DCP dispatches Slices. Embed loads and worker starts. Dashboards render with shell data.

### Build Phase 3: Quorum + Catchment Assembly (Hours 14-22)

Goal: end-to-end demo path works once. Quorum + oracle implemented. Live streaming.

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Quorum + oracle logic** (server-side): semantic-hash compare on k=2 attempts, third-attempt retry on mismatch, 1-3% oracle spot-check via server-side Whisper, Attestation rows on accept | BE3 | 6 | Slices reach `completed` deterministically, Attestations written |
| **Auto-tier-promotion**: inline check on Slice callback + daily cron sweep, Provisional→Verified at 50hrs+7d, Verified→Trusted at 5000hrs+60d | BE2 | 3 | Tier transitions in DB, dashboard tier badge |
| **Capability-ceiling enforcement**: submit worker rejects new Forecasts once monthly ceiling hit; UI shows "ceiling reached" | BE2 | 1 | Ceiling math + UI surface |
| **SSE live streaming**: Forecast status, Slice completion, earnings tick. `/api/forecasts/:id/stream` pushes events as quorum accepts | BE1 | 4 | Forecast Detail updates live. Distributor SliceTicker live. |
| **Catchment assembly + delivery UI** (Phase 6 UI): Slices populate in timestamp order, CycleBudgetMeter ticks down, counterfactual cost panel ticks up, SRT bundle download on seal | FE | 4 | Catchment Detail shows comparison panel + signature components |
| **Embed runtime: consent + explainer modal** (footer chip states, pause toggle, "What is this?" modal) | FE | 2 | Footer chip interactive, explainer modal opens |
| **Settlement calculation**: on Forecast seal, compute 68/32 split, write Settlement rows, update Distributor earnings | BE2 | 2 | Payout numbers show on Distributor dashboard |
| **Wire end-to-end**: Client submits → DCP dispatches → quorum accepts → Catchment seals → settlement | ALL | 2 | Full demo path runs once on production URLs |

**Phase 3 exit:** Demo path works end-to-end. Record backup video at this checkpoint.

### Build Phase 4: Polish + Demo Prep (Hours 22-30)

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Distributor earnings panel**: real Settlement data, SliceTicker live tick animation, payout UI (mocked Stripe Connect) | FE | 3 | Earnings panel polished |
| **Client billing panel**: Stripe Elements card capture (test mode), balance display, cost breakdown | FE | 2 | Billing page production-ready |
| **Real Auth0 v4 swap-in**: flip `AUTH_MODE=auth0`, configure callbacks on production URL, test full login flow | BE2 | 2 | Real Auth0 login works on Vercel |
| **Pre-baked Catchment fallback**: if DCP scheduler unreachable, replay one canonical Forecast's Slice/Attestation set via SSE. UI labels fallback explicitly. NO hidden synchronous mode. | BE3 | 2 | Pre-baked Catchment tested, labeled in UI |
| **Multiple Node simulation**: open 5-6 tabs as Nodes, verify parallel Slice execution, Whisper warm after first Slice in tab | BE3 | 2 | 6 Nodes contribute simultaneously |
| **Dashboard SSE polish**: reconnection on drop, loading states, empty states | BE1 | 2 | No broken states during demo |
| **5x end-to-end dry runs on conference WiFi** (or phone hotspot) | ALL | 3 | Stable demo path |

### Build Phase 5: Demo Video + Submit (Hours 30-36)

| Task | Owner | Hours | Deliverable |
|---|---|---|---|
| **Record demo video** (90 seconds, per [07-demo-script.md](07-demo-script.md)) | FE + BE3 | 2 | Video uploaded to Devpost |
| **Pitch deck + judge talking points** | BE1 + BE2 | 2 | Slide deck ready |
| **Devpost long-form description** | ALL | 1 | Submission complete |
| **Final dry-runs** (4x full demo) | ALL | 2 | Everything works |
| **Submit on Devpost** at T-35:50 (Sun 2026-04-26 09:50 EDT) | ALL | 0.5 | Submitted before 10:00 EDT deadline |

---

## Per-Person Ownership Map

### FE (Frontend, Kelly)
- Design system + atmospheric tokens + shadcn 4.5 + @base-ui/react primitives
- AppShell (topbar + sidebar + content slot)
- Landing page + signup with role picker
- Distributor dashboard (sites, slots, SliceTicker, embed snippet)
- Client dashboard (Forecasts, balance, Forecast Composer, Catchment Detail)
- Forecast Detail with signature components (CycleBudgetMeter, CatchmentAssembling, CapabilityBloom)
- Footer chip + explainer modal
- Demo video recording

### BE1 (Backend 1)
- Next.js 16.2 scaffold + Prisma 6 schema + migrations
- Distributor onboarding API (sites, slots, verification)
- Embed runtime (strata.js IIFE + runtime iframe at embed.strata.app)
- SSE live streaming infrastructure
- Dashboard SSE polish + reconnection

### BE2 (Backend 2)
- Auth0 v4.19 setup (stub + real)
- Client onboarding + Forecast submission API
- Auto-tier-promotion logic + capability-ceiling enforcement
- Settlement calculation (68/32 split)
- Stripe mock integration (Elements + Connect)

### BE3 (Backend 3 — DCP Lead)
- DCP proof-of-concept (compute.for + browser worker)
- Whisper-in-browser proof (WebGPU model loading via transformers.js v3)
- Forecast pipeline with k=2 redundancy
- Quorum logic (semantic-hash compare + third-attempt retry)
- Oracle spot-check (1-3% sample via server-side Whisper)
- Pre-baked Catchment fallback (NOT synchronous in-process — must keep DCP claims honest)
- Node simulation (multiple tabs as workers)
- Stretch: Gemma 4 1B browser-WebGPU translator for Forecast Composer

---

## Key Technical Risks

See [08-risks.md](08-risks.md) for the full ranked list. Risk 1 (Whisper-WebGPU sandbox load) is the spike everything depends on; resolve at T+2.

---

## DCP-Specific Notes (from docs)

**What DCP provides that we use:**
- `compute.for(inputSet, workFn, args)` — job submission
- `job.on('result'|'status'|'error'|'complete')` — event streaming
- `compute.marketValue` — market-rate pricing
- DCC escrow via Bank
- Browser sandbox with `progress()` heartbeat
- `work.public` for job metadata (name, description)
- RemoteDataPattern for sandbox-side fetch

**What DCP does NOT provide (we build):**
- Quorum / oracle / attestation — we implement server-side: k=2 hash compare, 1-3% oracle spot-check, signed Slice receipts
- Distributor onboarding — we build signup + verification
- Revenue split (68/32) — we calculate from DCC ledger
- Footer chip / consent UI — we build in the embed runtime
- Whisper-WebGPU model loading inside work functions — we ship a Strata-hosted version-pinned bundle
- Forecast Composer / plain-English translation — we build with Gemma 4 1B browser-WebGPU as a stretch surface
- Auto-tier-promotion — we run a daily sweep + inline check on Slice callbacks

**DCP capabilities system (from calculate-capabilities):**
- `environment.fdlibm` — deterministic math
- `environment.offscreenCanvas` — WebGPU rendering
- `details.offscreenCanvas.bigTexture*` — WebGL/WebGPU texture sizes
- `engine.es7` — ES7 compliance
- WebGPU: not formally in capability system yet, but available via `navigator.gpu`
- `OfflineAudioContext` for audio decode inside the sandbox
- No native consensus/reputation system

**V8 sandbox restrictions (verified):**
- No WebSocket
- No IndexedDB
- No Playwright / no DOM scraping
- Audio fetched via RemoteDataPattern only
- Dynamic `import()` only from allowed origins (Strata-hosted bundle URL is the primary path; jsdelivr `@latest` is NOT used)

---

## Open Questions

1. **Whisper-in-sandbox feasibility** — can the DCP V8 sandbox load a Strata-hosted bundle and fetch the ~150MB Whisper-base ONNX as RemoteDataPattern, while accessing `navigator.gpu` and `OfflineAudioContext`? Test at T+2 before committing.
2. **Audio fixture pinning** — what specific 30-60 min fixture do we ship with for the demo? Affects cold-start narration timing and the cost-comparison numbers in the Catchment-sealed beat.
3. **Single PCG vs per-Forecast PCG** — one global PCG simplifies demo. Per-Forecast is cleaner for production. Start with global, note as v2 fix.
4. **Gemma 4 translator scope** — is the Forecast Composer's plain-English translator a default-on Gemma 4 surface (claims the MLH track), or hidden behind a "show advanced" toggle? Decision affects pre-warm checklist.
