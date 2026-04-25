---
type: project-probe
project: Tessera
context: hackathon
tier: 0
status: deep-probe-complete
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[sdk-probe-consolidated]]"
  - "[[pressure-test-cases-comparison]]"
  - "[[manufacturing-pivots-and-gemma]]"
  - "[[dcp-ml-runtime-audit]]"
  - "[[idea-dcp-saas-replacement]]"
  - "[[Case Study Distributive]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - sdk-probe
  - deep
  - source-verified
  - critical-findings
---

# DCP SDK deep probe (source-verified, 3-agent parallel sweep)

Three Explore agents ran in parallel against `~/dcp-sdks/{dcp-client, dcp-worker, use-dcp-worker}` covering: (1) module shipping + caching + memory, (2) capability API + pricing reality, (3) endpoints + lifecycle + runtime.

The findings change three major claims in our prior pressure-test files. Critical findings first, then detailed answers to all 10 unverified items, then per-case implications.

## Three findings that change the audit

### Finding 1: `job.requires()` does NOT exist in the public API

Earlier writeups (and the mandelbrot tutorial referenced in web search) claimed `job.requires('./module-name')` ships modules to workers. **Source contradicts this.**

Evidence: zero references to `.requires()` as a job method in dcp-client/lib, dist/dcp-client-bundle.js, or tests. The actual module-delivery mechanism is internal: a `moduleGroup` postMessage from supervisor to worker, populating `bravojs.pendingModuleDeclarations[moduleId]` (bravojs-env.js:293-312). Modules ship inline as code strings, content-addressed by string key.

Implication: **the cold-start strategy of "ship Gemma 4 E2B Q4 (1.5GB) via job.requires for cached reuse across slices" is not viable as designed.** Two remaining paths:

1. **RemoteDataPattern**: each slice fetches model weights from a CORS-enabled URL. No documented cache, so worker re-fetches per slice unless we layer caching in the work function (and the worker session lasts long enough for browser HTTP cache to help).
2. **Inline in work function source**: infeasible at 1.5GB given postMessage practical limits (~100MB browser, higher Node).

### Finding 2: Pricing is still placeholder, not live

The README's first-dev-release caveat we flagged in the shallow probe is confirmed by source. `marketRate` and `marketValue` are aliases, both placeholder constants. Bank/escrow events (`authorizeHold`, `authorizeFeeStructure`, `ENOFUNDS`) are protocol skeleton handlers with no transaction backend. Worker minimum wage defaults to **0 DCC/hour for CPU/GPU/in/out** in `etc/dcp-worker-config.js:37-42`.

Implication: **cost-savings pitch math is built on aspirational numbers.** We cannot honestly claim "DCP charges $X for this workload" because the X side is not metered. Options:

- Caveat hard in the pitch ("DCP's pricing engine is in beta; numbers shown are based on Distributive's published reference rates and the marketing-claimed $50 = 100k+ compute hours")
- Run on a private Compute Group on team hardware for the demo, where "cost" = electricity (real, defensible) and the "$X savings vs cloud" is the cloud side only
- Skip the cost narrative entirely; pitch on privacy/sovereignty/parallelism

### Finding 3: Job-side capability requirements API is NOT implemented

Workers report capabilities (verified earlier in calculate-capabilities.js). But the JOB side cannot declare `requires: { webgpu: true }` or `minHeap: 2048`. Slices land on whatever worker the scheduler picks.

Implication: **jobs that need WebGPU (Gemma E2B, Whisper-base for fast inference) can land on CPU-only workers and fail or run at 1/10th speed.** Compute Group filtering exists but only on the worker side (workers join via joinKey/joinSecret); jobs cannot specify "send only to this group" in `compute.for()` per the source agents found.

This may have been added in newer versions, or it may be specifiable through `dcpConfig` / job options not surfaced in the examples. Worth verifying directly with Distributive on hackathon weekend, but for now: **assume jobs land on any worker and design for the worst-case capability tier**.

## Detailed answers to all 10 unverified items from the shallow probe

### 1. `job.requires()` actual implementation

**Not a public user-facing API.** Internal mechanism only. `bravojs.pendingModuleDeclarations[moduleId]` populated via `moduleGroup` message from supervisor (bravojs-env.js:27-48). Cross-job persistence not documented; per-sandbox lifetime is the upper bound on caching.

### 2. Per-slice memory caps

**No explicit limits in source.** Searched dcp-worker-config.js, bootstrap.js, calculate-capabilities.js, bravojs-env.js for maxHeap, maxMemory, MAX_HEAP_SIZE, sandbox memory: zero matches. Practical limit = V8 Isolate default (~2GB on 64-bit Node, ~4GB in browser tab via pointer-compression cage). DCP does not advertise or enforce a per-slice ceiling.

For Gemma E2B Q4 (~1.5GB weights + ~500MB-1GB activations): operating right at the V8 default-heap edge. May OOM on workers with tight RAM.

### 3. RemoteDataPattern caching

**No cache mechanism visible** in bravojs-env.js or bootstrap.js. Per-slice re-fetch is the documented behavior. Worker-level caching depends on browser HTTP cache headers (Cache-Control, ETag) on the data-server side. The DCP layer does not memoize.

For our use cases: serving weights via RemoteDataPattern means each slice does a fresh HTTP fetch unless we set aggressive cache headers and pray for browser-cache hits. Even then, every new worker pays the full download.

### 4. Pricing reality

**Confirmed placeholder.** marketRate ≡ marketValue, both placeholder constants. No metering backend. Bank/escrow events skeleton-only. README:171 says "the value of DCC are not tied to anything... placeholder for testing/experimental purposes." MVP release will tie to actual work.

### 5. Pyodide ship pattern

**Pyodide bundle (~26MB) ships unconditionally to every sandbox.** Listed in `generated/sandbox-definitions.json` for all environments (browser, node, native, testing). Initialization is on-demand: `generatePyodideFunction()` at bravojs-env.js:154-288, called only if `worktime.name === 'pyodide'`.

So 26MB is loaded into memory even for non-Python jobs. Affects every sandbox's memory baseline.

### 6. Job capability requirement API

**Not implemented job-side.** Workers report capabilities. Jobs do not declare requirements. compute.for() accepts no `{ requires: { webgpu: true } }` option in the examples or library code.

### 7. dcp-evaluator-v8 source

Not in our cloned repos. Source is MIT but distribution is request-only. Worker communicates with evaluator via `dcpsaw://` custom socket protocol on `localhost:9000` (etc/dcp-worker-config.js:54-60). Worker uses StandaloneWorker abstraction (lib/standaloneWorker.workerFactory) to dispatch eval messages.

### 8. progress() timeout configurability

**30s timeout is hard, not configurable.** Throttling IS configurable: `sandboxConfig.progressThrottle` defaults to 100ms (bootstrap.js:112). progress() communicates via postMessage with `request: 'progress'`.

For long-running single inferences (e.g., Gemma E2B generating 200 tokens taking 10-30 sec), we need to call progress() inside the model's generation loop. transformers.js doesn't expose a clean callback for this; we'd hack it with setTimeout-based check or accept that inference >30s fails.

### 9. BravoJS module resolution

Modules use BravoJS (CommonJS-compatible). Modules delivered as code strings via supervisor postMessage, then `bravojs.pendingModuleDeclarations[moduleId]` resolves them. Standard `require('foo')` inside a work function resolves through bravojs's module memo. No HTTP fetch from a package server visible in source for runtime resolution; modules are pre-shipped.

### 10. Browser worker behavior (use-dcp-worker)

`new window.dcp.worker.DistributiveWorker(workerOptions)` creates the worker (useDCPWorker.tsx:560-632). Events: `start`, `stop`, `slice`, `error`, `fetch`, `result`. `dcpWorker.workingSandboxes.length` tracks active slice count. No explicit memory limits in the React hook; relies on `maxWorkingSandboxes` (undefined = auto-detect) and per-sandbox runtime limits.

## Additional findings beyond the 10 questions

**Slice retry semantics**: `work.reject(reason, retries=0)` (bootstrap.js:149-164). Second arg controls retry count, defaults to 0. Slice requeued to scheduler on rejection. ENOPROGRESS escalates via `request: 'noProgress'` postMessage; scheduler decides reassignment.

**KVIN custom types** registered: `dcpUrl$$DcpURL` (URL-like) and `dcpEth$$Address` (Ethereum address). Standard typed arrays handled. Functions stringified.

**Bootstrap order**: `script-load-wrapper.js` → `bravojs-init.js` → `access-lists.js` → `bootstrap.js` (finalScript: true). Bootstrap defines `self.progress`, `self.work`, `self.console`, postMessage interception. First user-callable API after `__sandboxLoaded` message fires.

**Evaluator communication**: `dcpsaw://localhost:9000/` custom socket abstraction. Custom protocol, not HTTP/WS. Evaluator binary external to the npm packages.

**Compute Groups (worker-side)**: dcp-worker-config.js:47-50 supports an array of groups with joinKey/joinSecret or joinKey/joinHash. Workers can join multiple groups simultaneously.

## Apply to LLM distributed case (Gemma 4 E2B Q4)

Updated viability assessment given source verification:

| Concern | Prior assessment | Source-verified reality | Verdict change |
|---|---|---|---|
| Module shipping (1.5GB weights) | "Use job.requires for caching" | job.requires doesn't exist as user API | **Worse**: must use RemoteDataPattern with no DCP-layer caching |
| Per-worker model caching | "Maybe via job.requires" | bravojs.pendingModuleDeclarations caches *internal* modules per sandbox lifetime, but not user data; RemoteDataPattern has no cache | **Worse**: rely on browser HTTP cache + same worker reuse |
| Per-slice memory cap | "~4GB V8 Isolate" | No explicit DCP-side cap; V8 default ~2GB Node, 4GB browser; Pyodide eats ~26MB always | Approximately same, slightly tighter due to Pyodide overhead |
| Capability filtering (need WebGPU) | "Spike-verify" | Not implemented job-side | **Much worse**: no way to require WebGPU workers; must design for CPU fallback OR run private Compute Group only |
| Cost narrative ("$X vs AWS") | "Live billing per ResultHandle metadata" | Pricing is placeholder, no metering | **Pivot needed**: pitch on parallelism / privacy not cost |

**Revised verdict on Gemma 4 E2B Q4 on DCP**:

- **Public network**: not viable as a hackathon demo. No way to require WebGPU, model ships 1.5GB per slice via RemoteDataPattern, slices may land on workers that timeout fetching the weights or OOM trying to load them.
- **Private Compute Group on team laptops**: viable. Pre-cache weights on each worker's filesystem (out of band), fetch via localhost RemoteDataPattern, all workers known to have WebGPU. Trade-off: pitch story changes from "public distributed compute" to "your own private compute group across known hardware."
- **Pivot to Qwen 2.5 0.5B Q4 (~400MB)**: more forgiving. Smaller bundle, still fits CPU+wasm path with acceptable latency. Loses Gemma sponsor track.
- **Drop LLM entirely from the hot path**: use dedicated single-task models (Whisper-base 150MB, YOLOv8n 12MB, sentence-transformers 80MB) where the compute primitive is well-suited.

## Apply to other cases

### Transcription (Whisper-base, ~150MB)

Better fit than Gemma. Smaller bundle, runs on commodity CPU at ~1x realtime, WebGPU bonus. Ship via RemoteDataPattern from CORS-enabled bucket. Each new worker pays one ~150MB download (manageable; ~3-10 seconds on broadband). Still no caching guarantee, but the per-slice cost-amortization is favorable: if a worker handles 10 audio chunks, the model load cost amortizes 10x.

**No capability requirement API limits us here as long as we're tolerant of the WASM-only path.** Whisper-base WASM is ~1x realtime on commodity laptops; 30-sec audio chunks may genuinely take 30-60 seconds end-to-end including load + inference, brushing against ENOPROGRESS. Mitigation: chunk at 15-sec instead of 30-sec, call progress() between mel-spectrogram and inference steps.

### Document extraction (Tesseract.js + LayoutLM)

**Best fit of any case.** Tesseract.js is ~5MB pure WASM, ships fast, runs anywhere. No WebGPU dependency. Memory footprint comfortable. progress() easy to interleave per page.

LayoutLM/Donut path heavier (134-300MB) but still well within reasonable bundle sizes. Same RemoteDataPattern caveat applies.

**Cold-start** is genuinely manageable for Tesseract: under 1 second model load. Per-page inference is 1-3 seconds. 100-page demo distributes cleanly across 5-10 workers, end-to-end ~30-60 seconds wall-clock.

### Video moderation (YOLOv8n 6-12MB)

**Lowest engineering risk of any case.** 6-12MB bundle ships in seconds. WASM-only path is fast enough for real-time at low fps. WebGPU is bonus. Per-frame slice is genuinely cheap (10-50ms inference + minimal pre/post).

The capability-API absence matters less here because YOLOv8n on CPU is acceptable. Workers without WebGPU still produce useful work.

### Embeddings (sentence-transformers all-MiniLM-L6-v2 80MB)

Comfortable bundle. WASM-only is fine for embeddings (forward pass only, no autoregressive generation). Cold-start sub-second for the encoder. Clean fit for layered hybrid (extract → embed → search).

### Federated learning architecture

Compute Group primitive does exist on worker side (joinKey/joinSecret). **Job-side group selection is the open question** that source did not conclusively answer. Worth direct verification with Distributive: can a job's compute.for() specify "deploy only to compute group X"?

If yes, federated learning architecture is real (each org runs its own private Compute Group, coordinator submits jobs to specific groups in turn).

If no, federated learning is blocked at the routing primitive level, and the hybrid pitch pivots to "single private Compute Group of trusted workers" rather than "multi-org federated."

## Updated framework audit (deltas from `dcp-ml-runtime-audit.md`)

The previous audit needs three revisions:

**E. Programming model**: prior claim "DCP is JS/wasm, not Python." Revision: **Pyodide is shipped to every sandbox** (libexec/sandbox/pyodide-core.js, ~26MB). Python is technically callable in work functions via Pyodide initialization. Tradeoff: Pyodide brings 26MB constant memory overhead per sandbox, on-demand init cost (~1-3 sec), and missing PyTorch (numpy/scipy/pandas yes, full ML stack no). For a hackathon, this is interesting but unlikely to change architecture decisions; we still ship JS work functions calling transformers.js.

**G. Determinism**: prior claim "no determinism on DCP." Revision: **fdlibm numerical determinism check is a real platform feature** (calculate-capabilities.js:28-43). The worker tests Math.exp() against reference values at startup. Workers that pass can be selected for jobs requiring reproducible math. Practical use is limited (the test is binary pass/fail, not a guarantee of bit-equivalent compute across all operations), but it exists.

**Cost narrative**: prior claim "DCP charges by CPU-hours/GPU-hours/data with live market rate." Revision: **pricing is still placeholder per source. No metering backend.** The cost-savings pitch is built on Distributive's marketing claims, not on metered consumption visible in the SDK. Must caveat in pitch.

## What to do with this information

Three concrete decisions for the team:

### Decision 1: Pricing pitch frame

The cost-savings story is not on solid ground if pricing is placeholder. Two options:

**Option A: pitch privacy/parallelism, not cost.** Honeyvision-shape pitch becomes "DCP gives you on-prem distributed compute that keeps data inside your firewall, replacing the cloud SaaS you can't use for compliance reasons." Cost is secondary. This works for document extraction, transcription medical, and the manufacturing pivots.

**Option B: pitch cost with heavy caveat.** "Distributive markets DCP at roughly $0.0005 per CPU-hour. AWS Transcribe Medical bills at $0.075 per audio-minute, which at typical real-time cost-per-CPU-hour conversion is ~$X. Our DCP run consumed N CPU-seconds. At Distributive's reference rate, that's $Y." This works if we frame it as "what DCP claims to charge" rather than "what we measured DCP charge."

I'd go with Option A for primary pitch, mention Option B math as supporting evidence with explicit caveat.

### Decision 2: Compute Group commitment

**Run the hackathon demo on a Private Compute Group of team hardware**, not on the public DCP network. Reasons:

- No job-side capability filtering means public network workers may not have WebGPU or sufficient heap
- Pricing being placeholder means we have no way to incentivize public workers vs private
- Cold-start dominance + no caching means every public worker re-downloads weights
- Demo reliability is the priority in 36 hours

Trade-off: the pitch story changes from "your job runs on a global volunteer network" to "your job runs on your own private Compute Group of trusted hardware." This is actually closer to the Honeyvision case study itself (which uses a private Compute Group on factory-floor PCs).

### Decision 3: Model size commitment

Drop Gemma 4 E2B Q4 (1.5GB) for the primary pitch. Instead:

- **For transcription**: Whisper-base.en quantized (~150MB)
- **For video**: YOLOv8n (~12MB)
- **For documents**: Tesseract.js (~5MB) + optionally LayoutLMv3-base (~134MB)
- **For embeddings**: sentence-transformers MiniLM (~80MB)

Each of these ships in seconds, runs on commodity CPU+wasm acceptably, and does not depend on WebGPU. The Gemma sponsor track loses, but the engineering risk drops dramatically.

If the team wants to pursue the Gemma 4 E2B path for the sponsor double-stack, plan for: private Compute Group only, pre-cached weights on each worker's filesystem out of band, and accept the ~30-90 sec first-slice cold-start.

## What to verify directly with Distributive on hackathon weekend

Some questions remain that cannot be answered from source. If a Distributive engineer is present at BearHacks, ask them:

1. Is there a job-side API to specify required Compute Group, required capabilities (WebGPU), or required worker memory? If so, what's the syntax?
2. Is the pricing/metering backend live in the production scheduler, or still placeholder per the README? If live, where can we see metered cost in the ResultHandle?
3. What's the practical maximum payload size for a slice input (KVIN-serialized)?
4. Does the scheduler do worker-pool capability matching automatically, or is it round-robin?
5. What's the recommended pattern for shipping models 100MB-2GB to workers without paying re-fetch cost per slice?
6. Is there a cache-control mechanism we can use to instruct the worker "fetch this URL once and reuse"?

These six questions would materially change the architecture.

## Sources (this probe)

All findings cite specific files. Key locations:

- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/bravojs-env.js` (modules, caching)
- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/bootstrap.js` (lifecycle, progress, retry)
- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/calculate-capabilities.js` (capability reporting)
- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/lift-webgpu.js` (WebGPU instrumentation)
- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/pyodide-core.js` (Pyodide presence)
- `/Users/kelly/dcp-sdks/dcp-client/libexec/sandbox/script-load-wrapper.js` (KVIN marshalling)
- `/Users/kelly/dcp-sdks/dcp-client/index.js` (init, KVIN custom types)
- `/Users/kelly/dcp-sdks/dcp-client/dcp-client.js` (browser entry, scheduler config loading)
- `/Users/kelly/dcp-sdks/dcp-client/README.md` (placeholder caveat at line 171)
- `/Users/kelly/dcp-sdks/dcp-client/examples/nodejs/simple-job.js`
- `/Users/kelly/dcp-sdks/dcp-client/examples/nodejs/remote-data/*.js`
- `/Users/kelly/dcp-sdks/dcp-worker/etc/dcp-worker-config.js` (minimum wage, compute groups, evaluator URL)
- `/Users/kelly/dcp-sdks/dcp-worker/lib/webgpu-info.js` (WebGPU detection)
- `/Users/kelly/dcp-sdks/use-dcp-worker/src/useDCPWorker.tsx` (browser worker lifecycle)
