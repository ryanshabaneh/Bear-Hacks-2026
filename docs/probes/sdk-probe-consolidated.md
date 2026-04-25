---
type: project-probe
project: Tessera
context: hackathon
tier: 0
status: probe-consolidated
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[sdk-probe-deep]]"
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
  - source-verified
  - consolidated
---

# DCP SDK probe (consolidated, source-verified)

Source-of-truth reference for what the DCP SDK actually does, based on three cloned repos plus a 3-agent parallel deep probe of the source. Companion file `sdk-probe-deep.md` captures the engineering-decision implications; this file is the SDK *reference*.

## Repos and provenance

Three repos cloned at `~/dcp-sdks/`. All MIT-licensed.

| Repo | Version | Latest commit | Author of latest commit | Origin |
|---|---|---|---|---|
| dcp-client | 4.4.12 | 2024-09-25 | Eddie Roosenmaallen `<eddie@distributive.network>` | github.com/Distributed-Compute-Labs/dcp-client |
| dcp-worker | 3.3.13 | 2024-09-25 | Eddie Roosenmaallen `<eddie@distributive.network>` | github.com/Distributed-Compute-Labs/dcp-worker |
| use-dcp-worker | 5.1.0 | 2025-05-14 | Ryan Saweczko `<ryansaweczko@distributive.network>` | github.com/Distributive-Network/use-dcp-worker |

Original author of record (dcp-client `index.js` header): Wes Garland `<wes@kingsds.network>`, July 2019.

Example authors (dcp-client/examples/nodejs/): Wes Garland, Kevin Yu, Nazila Akhavan, all at distributive.network domain. Earliest example dated Aug 2019, most recent June 2024.

use-dcp-worker first version: 2023-02-23 per CHANGELOG.

### Naming history (the company has many names)

| Namespace | Where it appears | Status |
|---|---|---|
| KingsDS / kingsds.network | Older code comments, original Wes Garland email, `@kingsds/socket.io-client` and `@kingsds/xmlhttprequest-ssl` npm scopes | Predecessor company name (historical) |
| Distributed-Compute-Labs (GitHub) | dcp-client, dcp-worker hosted here | Current public mirror |
| Distributed-Compute-Protocol (GitLab) | dcp-worker package.json declares this as canonical | Current internal canonical |
| Distributive-Network (GitHub) | use-dcp-worker hosted here | Current React-side packages |
| distributive.network | All current author emails, marketing site | Current company domain |
| Distributive Corp. / Distributive Inc. | package.json author fields | Current legal name |

KingsDS rebranded to Distributive at some point before 2024.

### Sponsor relationship at BearHacks 2026

Direct. From the project schema in this folder:
- Sponsor track: "DCP Distributive | $660 | Real distributed compute, CEO-level judge, fake integrations will be caught"
- Confirmed judge: "Distributive CEO" (Dan Desjardins, also quoted in the Honeyvision case study)

Implications:
- The CEO knows this codebase intimately. Overclaims will be caught.
- Honest framing in the pitch is the right defensive posture.
- Asking the CEO at the event about pricing/metering status and unreleased changes is reasonable and probably welcomed.

### Codebase staleness

dcp-client and dcp-worker latest commits are 2024-09-25, ~7 months stale at hackathon time (2026-04-24). use-dcp-worker is more recent (2025-05-14). The "first-dev release" pricing-is-placeholder caveat in the README was current 7 months ago and has not been updated since.

This is a real signal. The public SDK release cadence is slow. The actual production scheduler at scheduler.distributed.computer may be ahead of the public packages, but we cannot assume so without verifying.

## Critical findings that change prior assumptions

These contradict things we previously claimed based on web search and tutorials. All source-verified.

### 1. `job.requires()` is NOT a public API

Earlier writeups (and the mandelbrot tutorial referenced in web search) claimed `job.requires('./module-name')` ships modules to workers. **Source contradicts this.** Zero references to `.requires()` as a job method in dcp-client/lib, dist/dcp-client-bundle.js, or tests.

Actual mechanism: internal `moduleGroup` postMessage from supervisor to worker, populating `bravojs.pendingModuleDeclarations[moduleId]` (bravojs-env.js:293-312). Modules ship inline as code strings, content-addressed by string key.

Implication: cannot ship a 1.5GB Gemma E2B model bundle via `job.requires`. Must use `RemoteDataPattern` (per-slice fetch) or inline in work function (infeasible at >100MB).

### 2. Pricing is still placeholder, not live

The README:171 caveat is confirmed by source. `marketRate` and `marketValue` are aliases, both placeholder constants. No metering backend in the source. Bank/escrow events (`authorizeHold`, `authorizeFeeStructure`, `ENOFUNDS`) are protocol skeleton handlers without transaction implementation. Worker minimum wage defaults to **0 DCC/hour for CPU/GPU/in/out** in `etc/dcp-worker-config.js:37-42`.

Implication: cost-savings narrative is built on Distributive's marketing claims, not on metered consumption. Must caveat in pitch or pivot to privacy-first framing.

### 3. Job-side capability requirements API is NOT implemented

Workers report capabilities at startup (verified in calculate-capabilities.js). Jobs **cannot** declare requirements like `requires: { webgpu: true }` or `minHeap: 2048`. compute.for() in the examples and library code accepts no such option.

Implication: jobs that need WebGPU (Gemma E2B, Whisper-base for fast inference) can land on CPU-only workers and fail or run at fallback speed. Compute Group filtering is **worker-side only** (workers join via joinKey/joinSecret); job-side selection of group was not conclusively found in source.

### 4. Pyodide ships unconditionally to every sandbox

`libexec/sandbox/pyodide-core.js` is a webpack-minified Pyodide bundle, ~26MB on disk. Listed in `generated/sandbox-definitions.json` for all environments (browser, node, native, testing). Loaded into memory baseline of every sandbox. Initialization is on-demand: `generatePyodideFunction()` at bravojs-env.js:154-288, called only if `worktime.name === 'pyodide'`.

Implication 1: Python *is* runnable in DCP sandbox via Pyodide. Contradicts the prior "JS/wasm only" claim in `dcp-ml-runtime-audit.md`. Researchers can ship Python work functions at performance/memory cost.

Implication 2: 26MB constant memory overhead per sandbox even for non-Python jobs. Tightens the practical heap available for ML model weights.

### 5. RemoteDataPattern has no DCP-layer caching

No cache mechanism visible in bravojs-env.js or bootstrap.js. Per-slice re-fetch is the documented behavior. Worker-level caching depends on browser HTTP cache headers (Cache-Control, ETag) on the data-server side. The DCP layer does not memoize.

Implication: shipping 100MB+ model weights via RemoteDataPattern means each worker re-downloads on every slice unless we set aggressive cache headers and the same worker handles multiple slices.

## API surface (source-verified)

### Initialization

```js
const { init, initSync, initcb } = require('dcp-client');

await init();                                                          // default scheduler
await init('https://scheduler.distributed.computer');                  // string URL
await init(new URL('https://scheduler.distributed.computer'));         // URL object
await init({ scheduler: { location: new URL('...') } });               // plain config object
await init('my-dcp-config.js');                                        // local config file
```

After init, modules injected into Node `require` memo:

| Module | Purpose |
|---|---|
| `dcp/compute` | Compute API: `compute.for`, `compute.run`, `compute.localExec`, `compute.marketRate`, `compute.marketValue` (aliases, placeholder) |
| `dcp/wallet` | Keystores, addresses, signing |
| `dcp/worker` | Embedded workers (browser/Node) |
| `dcp/dcp-config` | Running merged config object |
| `dcp/dcp-build` | Bundle version metadata |
| `dcp/cli` | yargs-based CLI utilities |
| `dcp/dcp-events` | Cross-platform EventEmitter |

In browser: `dcp['compute']`, `dcp['wallet']`, etc.

Default scheduler config loaded from `scheduler.location + 'etc/dcp-config.js'` at dcp-client.js:49. Default: `https://scheduler.distributed.computer/etc/dcp-config.js`.

### compute.for input forms

```js
compute.for([1,2,3,4], workFn);                                  // array
compute.for(1, 10, workFn);                                      // RangeObject (start, end)
compute.for(6, 16, 3, workFn);                                   // RangeObject with step (6, 9, 12, 15)
compute.for(["red","green","blue"], workFn);                     // array (other types)

const urls = [new URL('http://srv:1234/'), new URL('http://srv:2345/')];
compute.for(urls, workFn);                                       // each URL = one slice

const { RemoteDataPattern } = require('dcp/compute');
const remoteData = new RemoteDataPattern('http://srv:1234/slice-{slice}.json', 2);
compute.for(remoteData, workFn);                                 // URL pattern + slice count
```

`{slice}` placeholder replaced with 1-based slice index. Server must expose CORS headers for browser workers.

### Serialization

| Format | Content-Type | Use |
|---|---|---|
| JSON | `application/json` | Default |
| KVIN | `application/x-kvin` | Distributive's typed-array-aware serializer (preferred for ML data) |

KVIN custom types registered in dcp-client (index.js):
- `dcpUrl$$DcpURL` for URL-like objects
- `dcpEth$$Address` for Ethereum addresses
- Standard typed arrays handled (Float32Array, Uint8ClampedArray, etc.)
- Functions stringified

Function stringification is the actual mechanism by which work functions ship to workers. README explicit: "if you cannot eval() it, you cannot distribute it."

### Job execution and events

```js
const job = compute.for(...);

job.on('accepted', ({ id }) => ...);            // job accepted by scheduler
job.on('readystatechange', (newState) => ...);  // exec → deploying → authorizeHold → authorizeFeeStructure → deployed
job.on('result', (result) => ...);              // streamed per slice
job.on('console', (message) => ...);            // console.log from work function
job.on('error', (message) => ...);              // uncaught exception in work function
job.on('ENOFUNDS', (fundsRequired) => ...);     // insufficient bank balance (placeholder)

const results = await job.exec(compute.marketRate);   // both names work
const results = await job.exec(compute.marketValue);  // both placeholder constants
```

ENOFUNDS handler pattern (README:162-165):

```js
job.on("ENOFUNDS", (fundsRequired) => {
  await job.escrow(fundsRequired);
  job.resume();
});
```

Event-driven; no auto-retry. Currently a skeleton without metering backend.

### Work function constraints

- Must be string-stringifiable (`toString()`)
- No closures (stringification cannot capture environment)
- No native bindings (C++ Node functions)
- Must call `progress()` at least once per 30 seconds (hard timeout, not configurable)
- Work function code is `eval`'d on the worker

```js
function workFn(datum) {
  progress(1);    // mandatory; throttled by sandboxConfig.progressThrottle (default 100ms)
  // ... work
  return result;
}
```

ENOPROGRESS thrown if 30s elapses without progress() call. Throttling configurable via `sandboxConfig.progressThrottle` (default 100ms, bootstrap.js:112). Communication: `postMessage` with `request: 'progress'` to supervisor.

### Slice retry semantics

`work.reject(reason, retries=0)` (bootstrap.js:149-164). Second arg controls retry count, defaults to 0 (no auto-retry). Slice requeued to scheduler on rejection. Scheduler decides reassignment to a different worker. Backwards-compat: `work.reject(false)` is interpreted as `work.reject('false', 1)`.

ENOPROGRESS escalates via `request: 'noProgress'` postMessage; scheduler decides reassignment.

### Identity and bank accounts

Two keystores required:

1. App identity keystore (`~/.dcp/dcp-client/id.keystore`). Downloaded from https://portal.distributed.computer. Revocable.
2. Bank account keystore (`default.keystore`). Has withdraw access. **Cannot be revoked.** Lose it = lose your DCCs.

Currently end-user pays for work. README notes future versions will allow app-developer-pays model. DCC = Distributed Compute Coin, off-chain ledger managed by Bank with optional Ethereum movement.

## Sandbox internals

`dcp-client/libexec/sandbox/`:

| File | Purpose |
|---|---|
| `bootstrap.js` | Sandbox boot, defines `self.progress`, `self.work`, `self.console` |
| `script-load-wrapper.js` | Wraps subsequent script loads, KVIN marshalling fallback to JSON |
| `bravojs-init.js` / `bravojs-env.js` | BravoJS module system (CommonJS-compatible) |
| `lift-wasm.js` | WASM usage tracking + timing |
| `lift-webgl.js` | WebGL usage tracking |
| `lift-webgpu.js` | WebGPU full API wrapping with billing-grade timing |
| `pyodide-core.js` | Pyodide bundle (~26MB), Python in WASM |
| `calculate-capabilities.js` | Worker capability detection / reporting |
| `access-lists.js` | Allow-list rules |
| `deny-node.js` | Deny-list rules |
| `event-loop-virtualization.js` | Event loop emulation |
| `native-event-loop.js` | Native event loop adapter |
| `sa-ww-simulation.js` | Standalone-as-Web-Worker simulation (so same code runs identically in browser and Node) |
| `timer-classes.js` | Timer classes |
| `worktimes.js` | Worktime tracking |
| `wrap-event-listeners.js` | Event listener wrapping |

Bootstrap order: `script-load-wrapper.js` → `bravojs-init.js` → `access-lists.js` → `bootstrap.js` (finalScript). After bootstrap, `__sandboxLoaded` message fires and user work function can be called.

### WebGPU (lift-webgpu.js)

WebGPU is fully wrapped, not just exposed. All WebGPU classes wrapped for billing-grade timing: GPU, GPUAdapter, GPUDevice, GPUBuffer, GPUTexture, GPUShaderModule, GPUComputePipeline, GPURenderPipeline, GPUCommandEncoder, GPUComputePassEncoder, GPURenderPassEncoder, GPURenderBundleEncoder, GPUQueue, GPUQuerySet, GPUCanvasContext.

Promise-returning ops (requestDevice, mapAsync, onSubmittedWorkDone) timed via promise-finally. Blocking ops (createBuffer, dispatchWorkgroups) timed synchronously. GPUQueue.submit specially handled: starts a TimeInterval, immediately calls `onSubmittedWorkDone` to detect GPU completion, records actual GPU wall-clock per submit.

Strict invariant: if `globalThis.GPU` or `globalThis.navigator` are non-writable, sandbox crashes (`unrecoverable-evaluator`). Prevents jobs from bypassing scheduler decisions about GPU access. If `GPUQueue.prototype.submit` is non-writable, sandbox falls back to `forceDisableWebGPU = true` (CPU-only mode for that sandbox).

Native worker uses lazy `initWebGPU()`; browser worker uses `navigator.gpu`.

### Capability reporting (calculate-capabilities.js)

Each worker reports a capability descriptor at startup. Verified shape (calculate-capabilities.js:109-132):

```json
{
  "engine": { "es7": false, "spidermonkey": false },
  "environment": {
    "webgpu": true,           // tested via requestAdapter -> requestDevice -> destroy
    "offscreenCanvas": true,
    "fdlibm": true            // numerical math reference-value test
  },
  "browser": { "chrome": true },
  "details": {
    "offscreenCanvas": {
      "bigTexture4096": true,
      "bigTexture8192": true,
      "bigTexture16384": false,
      "bigTexture32768": false
    }
  },
  "discrete": true,           // sandbox accepts only one slice of a given job
  "useStrict": true
}
```

WebGPU test path (calculate-capabilities.js:55-65): `navigator.gpu.requestAdapter()` → `requestDevice()` → destroy. Any failure marks webgpu false.

`fdlibm` test (calculate-capabilities.js:28-43): specific Math.exp() values are checked at boot to verify worker's libm matches reference output. Provides partial numerical determinism.

**Capabilities are reported but jobs cannot require them** (see Critical Finding 3). The scheduler has the data; the API to use it from the job side is not implemented.

### Pyodide ship pattern

Bundle ships unconditionally to every sandbox (~26MB). Initialized on-demand only when work function's worktime is 'pyodide' (bravojs-env.js:95-96). Generates Python execution function at bravojs-env.js:154-288.

For non-Python jobs: 26MB sits in memory but is never deserialized into a Python interpreter. Memory baseline cost only.

For Python jobs: full Pyodide stack available (numpy, scipy, pandas have Pyodide builds; PyTorch does not as of last verification).

## Worker architecture

Two-tier:

```
DCP-Worker (Node.js, dcp-worker package)
    ↓ controls
dcp-evaluator-v8 (separate package, native binary)
    ↓ runs
slice work functions in V8+wasm+WebGPU sandbox
```

`dcp-evaluator-v8` ships separately. Source is MIT-licensed but distribution is request-only. Build: CMake + GN, V8-based.

Communication between dcp-worker and evaluator: custom `dcpsaw://` socket protocol on `localhost:9000` by default (etc/dcp-worker-config.js:54-60). Uses `StandaloneWorker` abstraction (lib/standaloneWorker.workerFactory).

### Worker startup conditions (dcp-worker README:44-50)

For a worker to accept a slice:
1. Evaluator must be startable (managed by `dcp-evaluator-manager`)
2. Worker must be running
3. Work available on scheduler suitable for this worker
4. Worker has correct capabilities (GPU?)
5. Job's payment exceeds worker's minimum wage (currently default 0)
6. Worker and job in same Compute Group

### Sandbox quantity per worker

> Generally one Sandbox per CPU core, although we might use more in order to work around system scheduler deficiencies, network overhead, etc. Sandboxes in the web browser are implemented using `window.Worker()`.

8-core machine ships up to 8 sandboxes, each handling one slice at a time. Browser workers use Web Workers as the isolation primitive.

### Compute Groups

Worker-side join (etc/dcp-worker-config.js:47-50):
```js
computeGroups: [
  { joinKey: 'scott', joinSecret: 'tiger' },
  { joinKey: 'scott', joinHash: '...' },
],
```

Workers can join multiple groups simultaneously. Job-side group selection: not conclusively found in source. May exist in newer config not in this repo, or via `dcpConfig.scheduler` overrides. Worth verifying with Distributive directly.

## Network protocol surface

| Layer | Endpoint / mechanism | Notes |
|---|---|---|
| Scheduler config | `${scheduler.location}etc/dcp-config.js` (dcp-client.js:49) | HTTP GET, default `https://scheduler.distributed.computer/etc/dcp-config.js` |
| Real-time | `@kingsds/socket.io-client` v4.5.4 | socket.io for live job/result events |
| HTTP layer | `@kingsds/xmlhttprequest-ssl` v2.1.0 polyfill | abstracts platform XHR |
| Bank | `bank.location` URL from dcpConfig | Defaults to bootstrap.distributed.computer |
| Worker→Evaluator | `dcpsaw://localhost:9000/` (etc/dcp-worker-config.js) | Custom socket protocol |
| Worker→Supervisor (in sandbox) | `postMessage` | Browser/native Web Worker semantics |
| Slice input fetch | HTTP from RemoteDataPattern URL | CORS required for browser workers |

Specific HTTP paths beyond `etc/dcp-config.js` are dynamically constructed at runtime in the minified bundle. Not surfaced as static constants in the source we examined.

## Limitations and constraints

| Constraint | Verified value | Source |
|---|---|---|
| `progress()` timeout | 30 seconds, hard, not configurable | README:234, bootstrap.js |
| `progress()` throttle | Configurable, default 100ms | bootstrap.js:112 (`sandboxConfig.progressThrottle`) |
| Work function form | Must be string-stringifiable, no closures, no native bindings | README:215 |
| Slice retry default | 0 retries (work.reject(reason, retries=0)) | bootstrap.js:149-164 |
| Per-slice memory cap | No explicit DCP-side limit; V8 default applies | searched config + sandbox files |
| V8 Isolate cap (Node) | ~2GB default | V8 platform default |
| V8 Isolate cap (browser) | ~4GB pointer-compression cage | V8 platform default |
| Pyodide overhead | ~26MB always-loaded per sandbox | sandbox-definitions.json + pyodide-core.js |
| Payload size limit | No documented limit; postMessage practical ~100MB browser | inferred |
| Worker minimum wage | Default 0 DCC/hour for CPU/GPU/in/out | etc/dcp-worker-config.js:37-42 |
| Job-side capability requirements | Not implemented | searched, no API found |
| Job-side Compute Group selection | Not conclusively found | unverified, likely needs Distributive confirmation |

## Confirming and revising prior pressure-test claims

| Claim | Verification status | Revision |
|---|---|---|
| `compute.for` is the input API | Confirmed multiple input forms | none |
| `progress()` mandatory | Confirmed, 30s hard timeout, throttle configurable | confirmed |
| Sandbox is V8 + Dawn WebGPU + WebAssembly | Confirmed in dcp-worker README | confirmed |
| RemoteDataPattern fetches per-slice from CORS-enabled URLs | Confirmed | **adds**: no DCP-layer caching |
| KVIN serialization for typed arrays | Confirmed | confirmed |
| WebGPU support | Confirmed, fully wrapped with billing-grade timing | confirmed |
| 4GB V8 Isolate memory cap | Indirectly confirmed (V8 default), Pyodide eats 26MB always | tightens by ~26MB |
| Work function is string-stringifiable | Confirmed README explicit | confirmed |
| Capability detection by scheduler | Confirmed, reporting is rich | **revises**: jobs cannot use capabilities (no job-side API) |
| `job.requires` ships modules | **CONTRADICTED** | API does not exist; modules ship via internal moduleGroup postMessage |
| Live billing per ResultHandle metadata | **CONTRADICTED** | Pricing is placeholder, no metering backend |
| `compute.marketValue` and `compute.marketRate` are dynamic | **CONTRADICTED** | Both are placeholder constants, aliases |
| `~/.dcp/default.keystore` for app identity | Confirmed | confirmed |
| Worker minimum wage gates job acceptance | Confirmed mechanism | **adds**: default is 0, not effectively gating anything until pricing live |

## Verified by deep probe (formerly UNVERIFIED items)

The 10 unverified items in the original shallow probe are now answered:

1. **`job.requires(modulePath)` implementation**: not a public API. Internal supervisor-to-worker postMessage. See Critical Finding 1.
2. **Per-slice memory cap**: no explicit DCP cap. V8 default (~2GB Node, 4GB browser). Pyodide eats 26MB always.
3. **RemoteDataPattern caching**: no cache. Per-slice re-fetch. Browser HTTP cache headers are the only memoization.
4. **Pricing realism**: placeholder per source. See Critical Finding 2.
5. **Pyodide ship pattern**: unconditional 26MB ship, on-demand initialization. See Critical Finding 4.
6. **Browser worker behavior**: `new window.dcp.worker.DistributiveWorker(workerOptions)` (useDCPWorker.tsx:560-632). Events: start, stop, slice, error, fetch, result. No explicit memory limits in React hook.
7. **Job-side capability requirements**: not implemented. See Critical Finding 3.
8. **`progress()` timeout configurability**: 30s hard. Throttle is configurable.
9. **BravoJS module resolution**: pre-shipped via supervisor; no runtime HTTP fetch from package server visible.
10. **dcp-evaluator-v8 source**: not in repos. Communicates via `dcpsaw://localhost:9000/` custom protocol.

## Still UNVERIFIED (questions for Distributive on hackathon weekend)

Six questions remain that the source did not conclusively answer. Worth asking the Distributive CEO or a Distributive engineer at BearHacks:

1. Is there a job-side API to specify required Compute Group, required capabilities (e.g. WebGPU), or required worker memory?
2. Is the pricing/metering backend live in production scheduler, or still placeholder per the README?
3. Practical maximum payload size for KVIN-serialized slice input?
4. Does the scheduler do worker-pool capability matching automatically, or is it round-robin?
5. Recommended pattern for shipping models 100MB-2GB to workers without per-slice re-fetch cost?
6. Cache-control mechanism to instruct workers "fetch this URL once and reuse across slices"?

These six answers materially change the architecture. Worth bringing the questions printed.

## Implications for prior pressure-test files

Three files need revisions based on this probe:

### `dcp-ml-runtime-audit.md`

- Section E (programming model: JS / WASM, not Python) → **revise**: Pyodide is shipped to every sandbox. Python is callable in work functions via Pyodide. Caveats: 26MB always-loaded overhead, ~1-3 sec init, no PyTorch in Pyodide.
- Section G (no determinism on DCP) → **revise**: `fdlibm` numerical determinism check exists. Workers self-test reference Math.exp() values. Partial determinism is testable.
- Implicit "live billing per ResultHandle" claim throughout → **revise**: pricing is placeholder. The cost-savings audit is built on Distributive's marketing claims, not on metered consumption.

### `idea-dcp-saas-replacement.md`

- Architecture diagram showing `job.requires('./whisper-bundle')` → **rewrite**: replace with RemoteDataPattern + per-worker browser HTTP cache + pre-cache-on-first-slice strategy.
- Cost math computing live DCP credit consumption → **caveat**: "Distributive's published reference rates indicate $0.0005/CPU-hr; pricing engine is in beta per their public README; numbers are based on marketing claim, not metered measurement."
- "Pre-warm workers via tiny seeding job" → **probably won't work**: depends on per-worker module caching, which is sandbox-lifetime-bounded, not worker-process-bounded.

### `manufacturing-pivots-and-gemma.md`

- Section 4 (Gemma E2B Q4 viability) → **revise verdict**:
  - Public network: not viable as designed (no capability filtering, no caching for 1.5GB weights)
  - Private Compute Group: viable with pre-cached weights on each worker
  - Add: Pyodide overhead trims practical heap by ~26MB
- Section "Workarounds if cold-start dominates" → **update**: 
  - "Pre-warm workers" likely won't work
  - "Drop to smaller model" still works; Qwen 0.5B Q4 ~400MB is the recommended fallback
  - Private Compute Group is the most reliable demo path

### `pressure-test-cases-comparison.md`

- Scoring on engineering risk dimension for cases shipping >100MB models should be revised slightly downward, given absence of `job.requires` caching guarantee.
- Score on "cost narrative" dimension for all cases should be revised: until pricing is confirmed live with Distributive, all dollar-savings claims are conditional.

## Locations on disk

| Repo | Path |
|---|---|
| dcp-client | `~/dcp-sdks/dcp-client/` |
| dcp-worker | `~/dcp-sdks/dcp-worker/` |
| use-dcp-worker | `~/dcp-sdks/use-dcp-worker/` |

Examples to run for spike (in priority order):
1. `~/dcp-sdks/dcp-client/examples/nodejs/simple-job.js` (basic compute.for + array)
2. `~/dcp-sdks/dcp-client/examples/nodejs/remote-data/simple-job-remote-data-pattern.js` (RemoteDataPattern)
3. `~/dcp-sdks/dcp-client/examples/nodejs/remote-data/simple-job-remote-input.js` (KVIN serialization)
4. `~/dcp-sdks/use-dcp-worker/examples/simple-react-app/` (browser-side worker embedding)

Prerequisites for any spike:
- Identity keystore at `~/.dcp/dcp-client/id.keystore` (download from https://portal.distributed.computer)
- Bank account keystore for paying for compute (placeholder pricing, but the auth flow is still required)
- `npm install` in the client repo
- For `localExec` debugging: also `npm install -g dcp-worker`

## Sources

Source files cited (`/Users/kelly/dcp-sdks/`):
- `dcp-client/README.md`
- `dcp-client/index.js`
- `dcp-client/dcp-client.js`
- `dcp-client/package.json`
- `dcp-client/libexec/sandbox/bootstrap.js`
- `dcp-client/libexec/sandbox/bravojs-env.js`
- `dcp-client/libexec/sandbox/script-load-wrapper.js`
- `dcp-client/libexec/sandbox/lift-webgpu.js`
- `dcp-client/libexec/sandbox/calculate-capabilities.js`
- `dcp-client/libexec/sandbox/pyodide-core.js`
- `dcp-client/generated/sandbox-definitions.json`
- `dcp-client/examples/nodejs/simple-job.js`
- `dcp-client/examples/nodejs/remote-data/simple-job-remote-data-pattern.js`
- `dcp-client/examples/nodejs/remote-data/simple-job-remote-input.js`
- `dcp-worker/README.md`
- `dcp-worker/etc/dcp-worker-config.js`
- `dcp-worker/lib/webgpu-info.js`
- `dcp-worker/package.json`
- `use-dcp-worker/src/useDCPWorker.tsx`
- `use-dcp-worker/CHANGELOG.md`
- `use-dcp-worker/package.json`

External sources retained from earlier probes:
- DCP marketing platform page: https://distributive.network/platform
- DCP documentation home: https://docs.dcp.dev/
- DCP Worker security architecture: https://distributive.network/docs/security-worker.html
- DCP compute economics: https://distributive.network/docs/compute-economics.html
- GitHub mirrors: github.com/Distributed-Compute-Labs, github.com/Distributive-Network
