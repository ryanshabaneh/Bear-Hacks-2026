---
type: technical-reference
project: Tessera
context: hackathon
tier: 0
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[stack]]"
  - "[[idea-dcp-saas-replacement]]"
  - "[[pressure-test-cases-comparison]]"
  - "[[extended-pressure-test]]"
  - "[[manufacturing-pivots-and-gemma]]"
  - "[[Case Study Distributive]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - distributive
  - reference
  - audit
  - protocol
  - hardware
  - endpoints
---

# DCP technical reference + vault audit

Authoritative technical reference for DCP (Distributive Computing Protocol) compiled from official documentation as of April 2026. Audits prior vault claims against authoritative sources. Flags documented vs undocumented behavior. Includes spike-measurement plan for items the docs do not cover.

Goal: a single source of truth the team can verify against during the build, with explicit "verified" vs "ambiguous" vs "undocumented" labels.

## Section 1. Endpoints

| Endpoint | Purpose | Auth | Source |
|---|---|---|---|
| `https://scheduler.distributed.computer` | Primary scheduler. Job submission, slice dispatch, result coordination | Yes (keystore) | https://docs.dcp.dev/specs/protocol-api.html |
| `https://dcp.cloud` | Account portal. Credit purchase, worker dashboard, payouts via PayPal Braintree | Email + login | https://dcp.cloud |
| `https://dcp.work` | Public worker join. "Start" button joins Global Compute Group; `/joinKey` for private | None (public) | https://distributive.network/workers |
| `https://docs.dcp.dev` | Technical documentation hub | None | https://docs.dcp.dev |
| `https://distributive.network` | Corporate site, platform overview | None | https://distributive.network |
| `https://secure.distributed.computer/users/sign_in` | Developer login | N/A | https://secure.distributed.computer/users/sign_in |

**No public `/status` or `/health` endpoint.** No public worker-pool statistics page. The pool size, geographic distribution, and current online count are not exposed via any documented endpoint.

## Section 2. Worker types

Verified worker matrix from https://distributive.network/docs/worker-linux.html, https://distributive.network/docs/worker-docker.html, https://distributive.network/docs/security-worker.html, and https://github.com/Distributed-Compute-Labs/dcp-worker:

| Worker type | OS | Min hardware | GPU support | Sandbox | Install |
|---|---|---|---|---|---|
| Linux Standalone | Ubuntu 20.04 / 22.04 / 24.04 | Not documented | All detected GPUs (configurable) | V8 + Dawn WebGPU + WASM, unprivileged `dcp` user, systemd service | `dcp-worker` package |
| macOS Standalone | macOS (version unspecified in docs) | Not documented | All detected GPUs | Same as Linux | Similar to Linux |
| Windows Standalone | Windows 10, 11 | Not documented | All detected GPUs | Restricted security token, no admin, loopback TCP only | MSI package |
| Windows Screensaver | Windows 10, 11 | Not documented | GPU via screensaver session | Same as Windows Standalone | MSI; deployable via SCCM/Intune/PowerShell |
| Docker | Linux host | Container-configurable | NVIDIA Container Toolkit for GPU passthrough | Linux namespaces + cgroups | `distributivenetwork/dcp-worker` on Docker Hub |
| Browser | Chrome / Edge 113+ with WebGPU enabled | Variable (host RAM) | Browser-native WebGPU | Browser security model, SharedArrayBuffer + COOP/COEP required | Open the page; no separate runtime |

**Android worker:** *Not confirmed in official docs.* Vault references in earlier exploration mention an Android worker; probes found no official Android worker page in the current documentation. Treat as undocumented; do not assume support.

**iOS worker:** *Not documented anywhere.*

**Minimum hardware specs:** *Not specified for any worker type.* DCP workers adapt to available hardware. Document this gap when planning a private Compute Group on team laptops; capture worker hardware specs empirically during the spike.

## Section 3. Sandbox internals

Verified from https://distributive.network/docs/security-worker.html and the linked PDF:

| Property | Status | Quote |
|---|---|---|
| Runtime: V8 + Dawn WebGPU + WebAssembly | **Confirmed** | "The DCP Evaluator is a secure sandboxing tool which uses Google's V8 JavaScript engine and Google's Dawn WebGPU implementation for secure execution of JavaScript, WebAssembly, and WebGPU code." |
| No filesystem access | **Confirmed** | "The DCP Worker host environment exposes no filesystem access, and no disk I/O or arbitrary networking primitives are provided." |
| No arbitrary networking | **Confirmed** | Same source. Only fetch via documented patterns. |
| Unprivileged user | **Confirmed** (Linux) | "All evaluator processes run as child processes of the unprivileged dcp-worker service and inherit no elevated privileges." |
| Restricted token | **Confirmed** (Windows) | "Evaluators inherit a restricted security token and communicate only with the local Worker service over loopback TCP." |
| Sandbox-per-job, never reused across jobs | **Confirmed** | "A sandbox is permanently associated with a single Job and is never reused across Jobs, eliminating cross-Job data leakage." (https://docs.dcp.dev/specs/compute-api.html) |
| Per-slice isolation within same job | **Ambiguous** | Each slice executes independently; whether sandbox state persists across slices on the same worker is not explicitly stated. Probably yes for module cache, no for arbitrary state. Spike must measure. |

## Section 4. Heartbeat and timeout semantics (audit finding)

**Two different timeout values appear in different DCP documentation.** The vault has cited both. Resolve in the spike, code conservatively in the meantime.

| Source | Quoted timeout | Layer |
|---|---|---|
| `dcp-client` README (earlier probe) | "30 seconds" before `ENOPROGRESS` exception | Client-side / scheduler-side error |
| Worker installation README (https://archive.distributed.computer/releases/linux/ubuntu-20.04/README.html) | "300 seconds" before worker assumes evaluator crashed | Worker-side process kill |
| Default cadence guidance | "Place `progress()` somewhere in your inner loop where you can reasonably expect it to be invoked every 3 or 4 seconds" | Style |

**Practical guidance:** call `progress()` every 3-4 seconds inside any work-function loop. Wrap long inference passes (model load, single-pass inference >5s) with explicit `progress()` calls. The 30-second client-side timeout is the conservative bound; the 300-second worker-side timeout is the kill threshold.

**Do not rely on either number being current** until the spike confirms behavior. Measure: how long can a slice run silently before the scheduler returns `ENOPROGRESS`?

## Section 5. Compute API surface

Verified functions on `compute` namespace from https://docs.dcp.dev/api/compute/index.html:

| Function | Signature | Purpose |
|---|---|---|
| `compute.for` | `compute.for(dataset, work)` | Map: execute `work` once per element. Returns Job. |
| `compute.do` | `compute.do(n, work)` | Execute `work` n times with zero-indexed integer arg per call. Returns Job. |
| `compute.marketValue` | `compute.marketValue(factor=1.0)` | Returns market value object. `factor` is multiplier; 2x → 2x cost / 2x speed; 0.5x → slower at half cost. |
| `compute.progress` | `compute.progress()` | Heartbeat. Required inside work function. |
| `compute.status` | `compute.status` (property) | Live `{runStatus, total, distributed, computed}`. |
| `compute.getJobInfo` | `compute.getJobInfo(jobId)` | Retrieve metadata for a job ID. |

Verified Job object methods:

| Method | Purpose |
|---|---|
| `job.exec()` | Deploy job to scheduler. |
| `job.estimate(sample)` | Returns Promise<SliceProfile> with `{cpuHours, gpuHours, outputBytes}`. |
| `job.setSlicePaymentOffer(value)` | Sets DCC per slice. Use with `compute.marketValue(factor)`. |
| `job.requires(moduleString | [moduleArray])` | Declare module dependency. |
| `job.computeGroups = [...]` | Target specific Compute Groups. |

Verified Job events:

| Event | Fires | Payload |
|---|---|---|
| `accepted` | Scheduler accepts job | Job ID |
| `result` | Worker returns slice result | `{result, sliceId}` (out-of-order possible) |
| `error` | Worker error | Error object per slice |
| `console` | Worker `console.log()` | Console output |

## Section 6. Work function constraints (critical)

From https://docs.dcp.dev/specs/compute-api.html. **These constraints must shape coding patterns from day one.**

| Constraint | Rule |
|---|---|
| **Cannot be a closure.** | "A rule of thumb is that if you cannot `eval()` it, you cannot distribute it." Outer-scope variables are not captured. Pass everything explicitly as slice input. |
| **Must be stringifiable.** | Work function passed through `Function.prototype.toString()`. Native C++ functions prohibited. |
| **No outer state.** | The function body must be self-sufficient or use `requires()` to pull modules. |
| **Stringification size limit.** | *Not documented.* Spike must measure. Practical guidance: keep work function under a few KB; ship heavy code via `requires()`. |

**Hackathon pitfall:** writing helpers in the same file and referencing them from the work function will silently fail because the helpers are not closure-captured. Always either inline helpers into the work function, or expose them via `job.requires('./helpers')`.

## Section 7. Module system

Verified from https://docs.dcp.dev/specs/compute-api.html and https://github.com/Distributed-Compute-Labs/dcp-client:

- DCP uses **BravoJS** as its module system, not standard CommonJS or ESM
- `workFunction.requires(moduleName | [moduleArray])` declares module dependencies
- **Quote: "There is no automatic bundling of private modules currently in the DCP module system. There are no access restrictions and no automatic version maintenance for modules."**
- Public modules ship via the BravoJS module system; private modules must be made available manually (e.g., served from a CORS-enabled URL)

**Caching behavior across slices on the same worker:** *Not documented.* The scheduler "groups slices into tasks based on slice cost, leaf-node cache locality, and sandbox capabilities" but specific cache lifetime, eviction, or cross-slice reuse is not explicitly stated.

**Spike requirement:** measure whether a module loaded for slice 1 on worker W is reused for slice 2 on worker W. Cold-start cost amortization depends on this.

## Section 8. Encoding (KVIN vs JSON)

Verified that DCP supports both:

| Encoding | Use | Source |
|---|---|---|
| JSON | Default for slice input/output | DCP docs |
| KVIN | Alternative serializer that handles Typed Arrays, large integers, complex JS values | https://github.com/Distributed-Compute-Labs/kvin |

**Documented but ambiguous:** when DCP automatically switches from JSON to KVIN is not specified. Practical guidance: use KVIN explicitly when shipping audio buffers, image tensors, or any Typed Array data.

**Typed Array support:** consistent with KVIN's design but explicit confirmation in DCP docs is sparse. Spike must validate audio Float32Array round-trips correctly.

## Section 9. RemoteDataPattern

Verified at https://docs.dcp.dev/advanced/data-uri.html:

- URL templates can include slice index, e.g., `https://example.com/data/{index}`
- Worker fetches input data directly from the templated URL
- **CORS requirements:** target endpoint must serve appropriate CORS headers because the worker sandbox enforces browser-style origin policy

**Documented but ambiguous:**
- Worker fetch path: does the scheduler proxy, or does the worker hit the URL directly? Affects bandwidth costs.
- Per-slice input size limits not documented.

**Practical guidance for the build:** host slice inputs (audio chunks, frame images, document pages) on a Cloudflare R2 bucket with permissive CORS. Use templated URLs with slice index for fan-out.

## Section 10. ResultHandle and observability

Verified at https://docs.dcp.dev/api/compute/classes/result-handle.html:

- Returned by `job.exec()`
- Contains `[input, output]` pairs in original slice order

**Not documented:**
- Whether ResultHandle exposes per-slice CPU-seconds, GPU-seconds, input/output bytes consumed
- Streaming behavior: can ResultHandle yield partial results as slices complete, or only after all slices finish?
- Worker identity / location per slice

**Vault claim audit:** `idea-dcp-saas-replacement.md` line 119 states "Compute total credit cost from ResultHandle metadata." This is the right approach but the exact metadata fields are not in the public docs. Spike must measure: does ResultHandle expose actual consumed CPU-seconds, or only result data?

If ResultHandle does not expose per-slice resource accounting, fall back to `compute.marketValue()` × estimated CPU-seconds for the dashboard cost ticker, with a clearly-labeled "estimated" qualifier.

## Section 11. Authentication and keystores

Verified from https://docs.dcp.dev/intro/getting-setup.html:

| Component | Detail |
|---|---|
| Keystore format | ECDSA-based JSON file |
| Identity Keystore | Personal credentials for DCP account; unique per user |
| Account Keystore | Tracks credit balance; managed by Wallet API |
| File location (Unix) | `~/.dcp/*.keystore`, default `~/.dcp/default.keystore` |
| File location (Windows) | `C:\Users\<USER>\.dcp\` |
| Generation | `mkad` command or `dcp-util` library |
| Signing scope | *Specifically which messages are signed by which key is not detailed in public docs.* |

## Section 12. Compute Groups

Verified from https://docs.dcp.dev/tutorials/web/to-upper-case.html and https://www.npmjs.com/package/use-dcp-worker:

| Type | joinKey | joinSecret | Provisioning |
|---|---|---|---|
| Public Global Group | `'public'` (or default with no group specified) | None | Default. No registration. |
| Private Group | Custom string | Required | **Self-serve provisioning is not documented.** Mechanism unclear: dashboard self-serve at dcp.cloud, or by Distributive contact. |
| Worker join code (CLI) | `--join='joinKey,joinSecret'` or `--join='joinKey,eh1-joinHash'` | | |

**Vault claim audit:** `pressure-test-cases-comparison.md` and `extended-pressure-test.md` reference "private Compute Group on team laptops" as a fallback. This works if a joinKey/joinSecret pair is available. **Action item: confirm at the Distributive booth Friday night** whether private group provisioning is dashboard-self-serve or requires a Distributive rep.

## Section 13. Resource accounting and pricing

Verified from https://distributive.network/docs/compute-economics.html:

**Slice Characteristics Vector** (measured per slice):
1. `referenceCPU-Hours` — CPU time normalized to a benchmark CPU
2. `referenceGPU-Hours` — GPU time normalized to a benchmark GPU
3. `inputDataGigabytes` — inbound bytes including slice input, args, work function, modules
4. `outputDataGigabytes` — outbound bytes including console messages and results

**Market Rate Vector** (current pricing):
- `[price/ref-CPU-hr, price/ref-GPU-hr, price/input-GB, price/output-GB]`

**Slice price calculation:** dot product of Slice Characteristics × Market Rate Vector.

**Verified pricing (January 2026 figure from official docs):**
- 1 Compute Credit (DCC) = USD $0.0003171

**Vault claim audit (`idea-dcp-saas-replacement.md` line 167-172):**
- "1 credit = $0.0003171 USD" — **Confirmed.**
- "$50 = ~157,617 credits" — Mathematically: $50 / $0.0003171 = 157,725 credits. Vault's 157,617 is close; the difference is rounding. **Treat as marketing-derived, not official.**
- "$50 = 100k+ hours of compute" claim — **Treat as marketing, not load-bearing for cost-savings dashboard math.** Real cost depends on actual CPU-seconds × current Market Rate Vector.

## Section 14. SDK packages (verified)

| Package | Language | Version status | Source |
|---|---|---|---|
| `dcp-client` | JavaScript / Node.js | Active | https://www.npmjs.com/package/dcp-client, https://github.com/Distributed-Compute-Labs/dcp-client |
| `dcp-worker` | JavaScript / Node.js | 4.3.7 latest | https://www.npmjs.com/package/dcp-worker |
| `bifrost2` | Python | Active (repo-based) | https://github.com/Distributive-Network/bifrost2 |
| `dcp` (PyPI) | Python | 2.0.x → 3.4.1+ varies | https://pypi.org/project/dcp/ |
| `transformers.js` (Distributive `dcp` branch) | JavaScript | **Sync of upstream main; no DCP-specific glue code.** Use upstream `@huggingface/transformers` instead. | https://github.com/Distributive-Network/transformers.js/tree/dcp |

**Vault stack.md cite:** uses `@huggingface/transformers` (upstream). **Correct.** Do not use the Distributive fork; it adds nothing on top of upstream and lags merges behind.

## Section 15. Audit of vault claims

Itemized check of load-bearing claims in `idea-dcp-saas-replacement.md`, `pressure-test-cases-comparison.md`, `extended-pressure-test.md`, `manufacturing-pivots-and-gemma.md`, and `stack.md` (this assistant's earlier draft).

| Claim location | Claim | Status | Notes |
|---|---|---|---|
| `idea-dcp-saas-replacement.md` L98 | "V8 + Dawn WebGPU + WebAssembly" sandbox | **Confirmed** | |
| `idea-dcp-saas-replacement.md` L99 | "No filesystem, no arbitrary networking" | **Confirmed** | |
| `idea-dcp-saas-replacement.md` L100 | "`progress()` heartbeat is mandatory" | **Confirmed** | Cadence ambiguous; see §4 |
| `idea-dcp-saas-replacement.md` L102 | KVIN handles Typed Arrays for audio buffers | **Likely correct, ambiguous in docs** | KVIN supports Typed Arrays; DCP automatic switch behavior not documented |
| `idea-dcp-saas-replacement.md` L124 | "We don't need to source strong GPUs... parallelism dominates" | **Architecturally sound** | DCP supports heterogeneous WebGPU pool; tensor parallelism is impossible (no inter-worker comm) so per-worker model size limit is real |
| `idea-dcp-saas-replacement.md` L168-172 | DCC pricing figures | **Confirmed for January 2026** | Verify in real-time via `marketValue` during demo |
| `pressure-test-cases-comparison.md` L33 | "Bundle-size and runtime fit inside V8 + Dawn WebGPU + WebAssembly sandbox" | **Confirmed sandbox stack** | Bundle size limit itself is undocumented |
| `pressure-test-cases-comparison.md` L268 | "DCP Native executor (Linux container worker) does exist, but it is for trusted compute groups, not the public network" | **Confirmed Docker worker exists**; "trusted compute groups only" is plausible but not explicitly stated in current docs |
| `extended-pressure-test.md` L196 | "DCP itself does not provide cross-Compute-Group coordination, secure aggregation, DP, round synchronization" for federated learning | **Confirmed.** DCP is batch-fan-out only. Federated-learning layers must be built on top. |
| `extended-pressure-test.md` L210 | "DCP fit: not at all" for real-time collaborative apps | **Confirmed.** No persistent state, no inter-worker comm. |
| `manufacturing-pivots-and-gemma.md` L232 | "Gemma 4 ships under standard Apache 2.0" | **Confirmed** via https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html |
| `manufacturing-pivots-and-gemma.md` L237 | E2B handles text + image + audio + video | **Confirmed** per Google AI for Developers https://ai.google.dev/gemma/docs/core |
| `stack.md` (my earlier draft) | "30 second hard cancel" without progress | **Partially incorrect.** Two timeouts at different layers (30s client / 300s worker). See §4. Will update. |
| Multiple files | Reference to "transformers.js dcp branch" | **Correctly de-emphasized** in vault. The branch is not a DCP integration; it's a sync of main. Use upstream `@huggingface/transformers`. |
| Multiple files | "Public worker pool sparse during weekend" risk flagged | **Confirmed risk; pool stats are not publicly observable**, so the only way to know is to submit a test job. |

**No load-bearing inaccuracies found in the pressure-test files** beyond the heartbeat timeout ambiguity (which the vault already flags as needing measurement) and the `stack.md` 30s/300s cleanup needed.

## Section 16. Documented gaps (what is NOT in the official docs)

These are the items the team must measure empirically because the public DCP documentation does not specify them:

1. **`job.requires` payload size limit.** Not documented.
2. **Module cache lifetime within a job.** Cache-aware scheduling exists, behavior details absent.
3. **Module cache lifetime across jobs.** Sandboxes never reused across jobs, so cross-job module cache is implicitly absent, but worker-host filesystem caching is not stated.
4. **`RemoteDataPattern` per-slice input size limit.** Not documented.
5. **Worker fetch path for RemoteDataPattern.** Direct from origin or scheduler-proxied; bandwidth attribution unclear.
6. **GPU memory per slice.** Not documented.
7. **Slice retry semantics.** Trigger conditions, retry count, same-vs-different worker. Not documented.
8. **`progress()` cadence and miss penalties.** 30s vs 300s ambiguity. Excessive call rate-limiting mentioned but not quantified.
9. **ResultHandle resource-consumption metadata fields.** CPU-seconds, GPU-seconds, input/output bytes per slice — present or absent?
10. **ResultHandle streaming.** Partial results during execution or only post-completion?
11. **Stringification size limit on work function.**
12. **KVIN vs JSON automatic encoding switch threshold.**
13. **Public worker pool size and geographic distribution.** No public stats endpoint.
14. **Self-serve private Compute Group provisioning.** Mechanism unclear.
15. **Minimum hardware specs for any worker type.**
16. **Per-job slice queue depth and current network utilization.**
17. **Historical pricing or Market Rate Vector snapshots.** Not exposed via API.

## Section 17. Spike-measurement plan

The 4-hour spike from `idea-dcp-saas-replacement.md` should explicitly measure these items in priority order:

| Priority | Measurement | How | Why it matters |
|---|---|---|---|
| 1 | Bundle ship time for chosen model | Single slice with `job.requires('./model-bundle')`; measure wall-clock from `exec()` to `accepted` event | Cold-start dominance kills parallelism |
| 2 | Cross-slice module cache | Run 5 sequential slices on same worker (use private group with one worker); measure load-to-inference ratio per slice | Determines whether N-slice job pays N model-loads or 1 |
| 3 | Heartbeat actual cancel threshold | Submit work function with `await sleep(N)` between `progress()` calls; binary-search N | Resolves 30s vs 300s ambiguity |
| 4 | ResultHandle metadata fields | Inspect ResultHandle object after a completed job; log all keys | Determines whether real-cost dashboard is possible from API alone |
| 5 | Slice retry behavior | Throw inside work function for slice 0, complete normally for others; observe whether slice 0 is retried, on same or different worker | Determines failure-recovery story |
| 6 | RemoteDataPattern fetch path | Host audio chunk on R2 with per-IP request logging; submit job; check whether worker IPs hit R2 directly or scheduler IP | Bandwidth attribution |
| 7 | Private group provisioning path | Visit dcp.cloud, attempt to create a private group; if not self-serve, ask Distributive booth Friday | Determines whether team-laptop fallback is hours-away or minutes-away |

If any priority-1 or priority-2 measurement fails the gate (cold-start over 15s, no module cache across slices), the chosen case must fall back per `pressure-test-cases-comparison.md` Section "Pre-commit gates": video moderation > document extraction (Tesseract path) > transcription.

## Section 18. Verified case study (single)

The Honeyvision Overwatch case from `Case Study Distributive.md` remains the **only documented DCP production case study** with quantitative outcomes:

- $160K/year on Microsoft Custom Vision → $12.5K/year on DCP
- 92% cost reduction (16x multiplier)
- Built in 6 months
- Data stays on-premises (idle factory-floor PCs as workers)
- Quoted by Dan Desjardins (CEO Distributive) and Andrew Pohran (CEO Honeyvision)
- Source: NGen Canada case capture

**Implication for pitch:** when the CEO judge asks "where else has this pattern been deployed at production scale," the honest answer is "this is the documented pattern; we're applying it to {your case}." Do not claim other DCP deployments unless you can cite them.

**Architectural lineage outside DCP** (separate from DCP-specific case studies; useful for pitch grounding):
- Folding@home, COVID-19 response, 2.43 exaFLOPS peak (https://foldingathome.org/2021/01/05/2020-in-review-and-happy-new-year-2021/)
- Climate TRACE, multi-source emissions inventory revealed 3× discrepancy with UNFCCC (https://climatetrace.org)
- Global Fishing Watch, 8× more IUU violations detected with multi-sensor distributed analytics (https://cloud.google.com/customers/global-fishing-watch)
- Owkin federated medical AI, Nature Medicine publication (https://www.owkin.com/newsfeed/nature-medicine-publishes-breakthrough-owkin-research)

These are not DCP cases. They are precedents for the *pattern* of distributed compute and multi-source observation. Frame as architectural lineage, not as DCP track record.

## Section 19. Sources

DCP runtime and SDK:
- DCP Compute API spec: https://docs.dcp.dev/specs/compute-api.html
- DCP Protocol API spec: https://docs.dcp.dev/specs/protocol-api.html
- DCP Worker API spec: https://docs.dcp.dev/specs/worker-api.html
- DCP getting started: https://docs.dcp.dev/intro/getting-started.html
- DCP getting setup: https://docs.dcp.dev/intro/getting-setup.html
- DCP mandelbrot tutorial (job.requires pattern): https://docs.dcp.dev/tutorials/node/mandelbrot.html
- DCP web tutorial (events, progress): https://docs.dcp.dev/tutorials/web/to-upper-case.html
- DCP RemoteDataPattern: https://docs.dcp.dev/advanced/data-uri.html
- DCP marketValue function: https://docs.dcp.dev/api/compute/functions/market-value.html
- DCP ResultHandle class: https://docs.dcp.dev/api/compute/classes/result-handle.html
- Worker security architecture: https://distributive.network/docs/security-worker.html
- Linux Worker: https://distributive.network/docs/worker-linux.html
- Docker Worker: https://distributive.network/docs/worker-docker.html
- Compute economics and pricing: https://distributive.network/docs/compute-economics.html
- DCP Worker GitHub: https://github.com/Distributed-Compute-Labs/dcp-worker
- DCP client GitHub: https://github.com/Distributed-Compute-Labs/dcp-client
- KVIN serialization: https://github.com/Distributed-Compute-Labs/kvin
- Worker installation README (300s timeout source): https://archive.distributed.computer/releases/linux/ubuntu-20.04/README.html

NPM packages:
- dcp-client: https://www.npmjs.com/package/dcp-client
- dcp-worker: https://www.npmjs.com/package/dcp-worker
- use-dcp-worker (React hook): https://www.npmjs.com/package/use-dcp-worker

Python:
- bifrost2 GitHub: https://github.com/Distributive-Network/bifrost2
- dcp PyPI: https://pypi.org/project/dcp/

Portals:
- DCP Portal: https://dcp.cloud
- Worker join: https://dcp.work
- Developer login: https://secure.distributed.computer/users/sign_in

Case study and pattern precedents:
- Honeyvision Overwatch case study: see `Case Study Distributive.md` in this folder
- Folding@home 2020: https://foldingathome.org/2021/01/05/2020-in-review-and-happy-new-year-2021/
- Climate TRACE: https://climatetrace.org
- Global Fishing Watch: https://cloud.google.com/customers/global-fishing-watch
- Owkin federated medical AI: https://www.owkin.com/newsfeed/nature-medicine-publishes-breakthrough-owkin-research

Models and runtimes:
- Transformers.js v3 + WebGPU: https://huggingface.co/blog/transformersjs-v3
- ONNX Runtime Web: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- Whisper-base.en ONNX: https://huggingface.co/Xenova/whisper-base.en
- Tesseract.js: https://tesseract.projectnaptha.com
- YOLOv8 web demos: https://github.com/nomi30701/yolo-object-detection-onnxruntime-web
- Gemma 4 ONNX (E2B): https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX
- Gemma 4 announcement: https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html
- Gemma 4 docs: https://ai.google.dev/gemma/docs/core

Pattern-precedent additional:
- BOINC: https://boinc.berkeley.edu/projects.php
- DreamLab: https://www.imperial.ac.uk/news/191869/smartphone-network-helps-uncover-hundreds-anti-cancer/
- Global Forest Watch: https://www.globalforestwatch.org
- Community Notes: https://communitynotes.x.com/guide/en/under-the-hood/ranking-notes
- CISA KEV: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- Cochrane GRADE: https://www.cochrane.org/learn/courses-and-resources/cochrane-methodology/grade
