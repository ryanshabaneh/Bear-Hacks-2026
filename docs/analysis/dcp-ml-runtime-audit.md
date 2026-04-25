---
type: project-analysis
project: Tessera
context: hackathon
tier: 0
status: critical-audit
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[pressure-test-cases-comparison]]"
  - "[[extended-pressure-test]]"
  - "[[manufacturing-pivots-and-gemma]]"
  - "[[idea-dcp-saas-replacement]]"
  - "[[Case Study Distributive]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - ml-runtime
  - critical-audit
  - limitations
---

# Critical audit: DCP as a distributed ML runtime

The question is whether DCP can serve as a generic distributed ML runtime, or whether it is a specific compute substrate that *some* ML workloads happen to fit.

The honest answer is the second one. DCP is a parallel batch-fan-out platform with a sandboxed worker substrate. A subset of ML workloads (specifically: embarrassingly parallel batch inference, hyperparameter search at small scale, federated learning if you build aggregation on top) genuinely fit. Most of the modern distributed ML stack (gradient-synced training, real-time serving, model parallelism, KV-cache sharding) does not.

This file audits each ML-runtime requirement against DCP's actual capabilities, and explicitly names the limitations.

## What DCP actually claims to be

Verified from official marketing (distributive.network/platform, docs.dcp.dev):

> "Fast, secure, and powerful parallel computing platform built on web technology that breaks large compute workloads into small slices, computes them in parallel on different devices, and returns the results to the client."

DCP positions itself as a **parallel computing platform**, not a "distributed ML runtime." This distinction is meaningful. They are not overselling. The audit below is therefore not "DCP marketing claims X but reality is Y" — it is "what subset of ML workloads is the parallel-batch-fan-out substrate actually good for, and what fundamentally cannot fit."

## What "distributed ML runtime" requires

A real distributed ML runtime supports some or all of:

1. **Distributed training**
2. **Low-latency inference serving**
3. **Batch inference**
4. **Hyperparameter search / AutoML**
5. **Federated learning**
6. **ML pipeline orchestration (DAG)**

Each requires different primitives. Auditing DCP against each:

## Audit 1: Distributed training

Modern distributed training requires:

| Requirement | DCP support | Why |
|---|---|---|
| Stateful workers across iterations | **No** | DCP slices are stateless. Sandbox is described as "clean" per slice. Cross-iteration state requires re-shipping it as input each round, breaking the abstraction. |
| Gradient AllReduce / parameter server | **No native primitive** | DCP has no peer-to-peer worker channel and no AllReduce abstraction. All inter-worker communication routes through the scheduler/coordinator, killing bandwidth. |
| Pinning data partitions to specific workers | **No** | DCP scheduler decides slice→worker assignment. Customer can filter by Compute Group but not pin individual partitions. |
| High inter-node bandwidth | **No** | Coordinator-bound communication makes gradient sync over many GBs per epoch impractical. NCCL-class performance is structurally unavailable. |
| Mid-training failure recovery | **Customer-built** | Workers can leave at any time. DCP delivers slice retry semantics but not training-aware checkpoint/restart. |
| Numerical determinism | **Partial** | Heterogeneous worker hardware produces non-identical floating-point results in general. Source-verified: `fdlibm` reference-value test exists at calculate-capabilities.js:28-43. Workers self-test specific Math.exp() values at boot; non-passing workers report `fdlibm: false`. Provides partial determinism for selected math operations, not full bit-equivalence. |
| GPU operator coverage parity with CUDA | **No** | Workers expose Dawn WebGPU. WebGPU has growing operator coverage but lags CUDA. FlashAttention, Triton kernels, custom CUDA ops do not run. |

**Verdict: DCP is fundamentally not a distributed training platform for any non-trivial model.**

The closest fit is *federated learning*, which works because gradient communication is round-bound (one update per slice, aggregate at coordinator) rather than continuous. Even there, DCP provides the compute substrate but not the federated primitives (FedAvg, secure aggregation, differential privacy).

## Audit 2: Low-latency inference serving

Real-time inference serving requires:

| Requirement | DCP support | Why |
|---|---|---|
| Sub-100ms p99 latency | **No** | Coordinator-scheduler-worker round trip plus public-network worker queueing makes sub-100ms unrealistic. |
| Per-request routing without re-warming | **No** | DCP is job-batch oriented. Each "request" would be a job with one slice. Cold-start dominates. |
| Persistent KV cache for autoregressive models | **No** | Stateless workers can't hold KV cache across requests. Carrying KV in/out as input/output data is bandwidth-prohibitive at scale. |
| Streaming response | **Awkward at best** | Slice returns a single result. Streaming would require many tiny slices, with coordinator round-trips between each token. |
| Auto-scaling under load | **N/A** | DCP doesn't make load-balancing decisions for serving. It schedules jobs. |

**Verdict: DCP is not a low-latency inference serving platform. Wrong shape.**

Real serving infrastructure (Triton, TGI, vLLM, Modal, BentoML) is a different category of product entirely. DCP cannot replace it.

## Audit 3: Batch inference

Batch inference (per-item independent, throughput over latency) requires:

| Requirement | DCP support | Why |
|---|---|---|
| Embarrassingly parallel work distribution | **Yes, native** | This is exactly DCP's job model. compute.for(inputSet, workFn) is the canonical pattern. |
| Worker model ship + cache | **Yes via RemoteDataPattern, no DCP-layer caching** | Source-verified: `job.requires` is NOT a public API (the mandelbrot-tutorial reference was misleading). Modules ship via internal supervisor postMessage; users ship data via `RemoteDataPattern` URLs which re-fetch per slice. Worker-level caching depends on browser HTTP cache headers, not DCP. |
| Result aggregation | **Yes** | ResultHandle is iterable, native aggregation. |
| Cost accounting per slice | **Yes** | ResultHandle metadata exposes credit consumption. |

**Verdict: DCP is genuinely well-suited to batch inference of bounded-size models.** This is the only ML-adjacent workload that DCP does well as a primary fit. All five Honeyvision-shape pressure-tested cases use this mode.

Caveats:
- Bounded model size: 4GB V8 Isolate cap excludes models >4GB even quantized.
- Cold-start dominates by default: RemoteDataPattern re-fetches per slice with no DCP-layer cache. Mitigation depends on browser HTTP cache + same worker handling many slices.
- WebGPU operator coverage gates which models actually run efficiently.

## Audit 4: Hyperparameter search / AutoML

| Requirement | DCP support | Why |
|---|---|---|
| Many independent training runs in parallel | **Yes for small models** | Each slice = one full training run from scratch on small data with one config. Fits embarrassingly-parallel pattern. |
| Coordinator decides next configs based on results | **Customer-built** | DCP doesn't have HPO primitives (BOHB, Optuna integration). You'd run HPO logic in coordinator and re-submit jobs. |
| Stateful per-trial training across epochs | **No** | Same stateless-worker problem as full distributed training. Each slice must be self-contained. |
| Early stopping / pruning | **Customer-built** | Coordinator can cancel jobs. Per-slice progress reporting via progress() is the only signal. |

**Verdict: DCP fits HPO for *small* models / *small* data where each trial is fully self-contained inside one slice (under ~hour wall-clock, under 4GB heap, under reasonable input data size).**

For real-world HPO at scale (training a 1B+ model with many configs), DCP is the wrong tool. Use Ray Tune or vendor HPO services.

## Audit 5: Federated learning

Already covered in `extended-pressure-test.md` Section "Mode 3." Summary:

| Requirement | DCP support | Why |
|---|---|---|
| Multi-party private compute groups | **Yes, native** | Private Compute Groups with join key/secret are a built-in DCP primitive. |
| Round-bound gradient updates | **Tractable** | Each round = one DCP job with N slices (one per participant). Aggregation at coordinator. |
| Secure aggregation (coordinator can't see individual contributions) | **No, build on top** | DCP doesn't provide SMC/MPC primitives. Needs to be layered. |
| Differential privacy on gradients | **No, build on top** | DCP doesn't provide DP primitives. Standard approach: add noise client-side before submitting. |
| Round synchronization across compute groups | **Customer-built** | DCP doesn't have cross-group synchronization. Coordinator handles round semantics. |
| Robustness to malicious participants (Byzantine) | **No native primitive** | DCP doesn't publish slice replication or result-attestation primitives for adversarial workers. Customer would need to build verification (e.g. duplicate slices, compare results). |

**Verdict: tractable as an architecture on top of DCP, not native. The aggregation, privacy, and Byzantine layers are real engineering work the customer must provide.**

## Audit 6: ML pipeline orchestration

| Requirement | DCP support | Why |
|---|---|---|
| DAG of tasks with dependencies | **No** | DCP submits jobs, not DAGs. You'd run orchestration externally (Airflow, Prefect, Temporal) and call DCP for parallel-fan-out steps. |
| Conditional / dynamic branching | **No** | Coordinator can decide what to submit next based on job results, but this happens outside DCP. |
| Per-task retries with exponential backoff | **Slice-level retries exist** | Slice retry policy exists but task-level (across multiple jobs) is customer-built. |
| Artifact tracking / lineage | **No** | DCP is stateless w.r.t. job history. MLflow / W&B / DVC level tooling is separate. |

**Verdict: DCP is a compute primitive, not a pipeline orchestrator. Use DCP as a step inside an external orchestration framework.**

## Specific limitations that matter, not yet stated above

### A. Memory ceiling: 4GB V8 Isolate cap

Excludes:
- Llama 3 8B even quantized (Q4 ~5-6GB)
- Mixtral / large MoE models
- Any model with checkpoint >4GB
- Multi-model ensembles where total RAM exceeds 4GB

Practical max model: **~3GB total resident memory** (leaves headroom for activations and ORT).

### B. WebGPU != CUDA gap

WebGPU's operator library is growing but does not match CUDA. Specific gaps relevant to ML:
- FlashAttention v2/v3: partially available via custom shaders, not turnkey
- Triton-compiled kernels: not portable
- BF16: variable browser support; FP16 + Q4 are reliable
- Sparse operations: limited
- Mixed-precision training: not standard

Models tuned for CUDA (most research models) often need re-export to ONNX with WebGPU-compatible operators. This is non-trivial for cutting-edge architectures.

### C. Trust boundary on public workers

Public DCP workers are anonymous. Their compute may be:
- Returned wrong results (intentional or buggy)
- Slow / timing out (straggler)
- Returning leaked side-channel info about the slice
- Refusing GPU acceleration when promised

DCP does not publish a slice-replication or result-attestation mechanism (per probe; verify on hackathon weekend with Distributive directly). Without one, the customer must build:
- Duplicate slices on different workers and compare
- Cryptographic attestation (TEE, remote attestation)
- Statistical anomaly detection on results

For ML use cases where wrong outputs matter (e.g. medical inference, financial classification), public workers are not safe by default. Private Compute Group with trusted hardware is the only safe path.

### D. Cold-start dominance for large models

Already covered in `manufacturing-pivots-and-gemma.md` Section 4. Recap: 1.5GB Gemma E2B Q4 weight download = 30-90 sec cold-start per worker via RemoteDataPattern (since `job.requires` is not a public API per source verification). DCP does not cache RemoteDataPattern responses. Cold-start dominates unless: (a) browser HTTP cache headers + same worker handles many slices, or (b) we run a Private Compute Group with pre-cached weights on workers' filesystem.

This is the same risk class as "lambda cold-start" in serverless inference, except DCP's worker pool is heterogeneous and uncontrolled (public network), so the cold-start distribution is wider, and DCP provides no native warm-pool primitive.

### E. Programming model: JS / WASM primary, Python via Pyodide

Source-verified revision: `dcp-client/libexec/sandbox/pyodide-core.js` is a webpack-bundled Pyodide payload that ships unconditionally to every sandbox (~26MB on disk). Initialization is on-demand: `generatePyodideFunction()` at bravojs-env.js:154-288, called only when the work function's worktime is `'pyodide'`.

This means **Python work functions are technically callable in DCP slices**, contradicting the prior claim that DCP is "JS/WASM only." Tradeoffs:

- 26MB always-loaded memory baseline per sandbox even for non-Python jobs
- Pyodide init cost (~1-3 sec) on first Python use
- Numpy, scipy, pandas have Pyodide builds; **PyTorch does not** (as of last verification)
- ONNX Runtime Python via Pyodide: untested, likely heavier than ONNX Runtime Web

The JS path is still primary for ML inference because:
- Train in Python, export to ONNX, run in JS via ONNX Runtime Web
- Use transformers.js for HuggingFace models with ONNX checkpoints
- Smaller memory baseline, simpler bundle

The Pyodide path is right when:
- Researchers want to ship Python data-processing logic (numpy/scipy/pandas) inside a slice
- The work involves classical ML (sklearn, statsmodels) rather than PyTorch deep learning
- Light scientific computing where Pyodide's WASM overhead is acceptable

What still does NOT work:
- Direct PyTorch model serving (no Pyodide build)
- Custom CUDA/Triton kernels (WebGPU only)
- Native autograd training loops in PyTorch idioms

For inference-only workloads with ONNX-compatible models, the JS bridge is the right path. For Python data-engineering work that fits Pyodide's package matrix, the Python path now exists at known cost.

### F. No native ML metrics / experiment tracking

DCP returns slice results. It does not:
- Track training/eval metrics
- Compare experiment runs
- Version datasets or models
- Provide UI for ML workflow

Customer must integrate W&B, MLflow, DVC, or similar at the coordinator level. This is fine but worth naming as a missing piece if anyone expects "ML platform" features.

### G. Determinism: partial via fdlibm reference-value test, not full bit-equivalence

Source-verified revision: `calculate-capabilities.js:28-43` runs an fdlibm conformance test at worker startup. Specific Math.exp() input/output reference values are checked. Workers that pass report `environment.fdlibm: true`; non-passing workers report false. This data is in the capability descriptor available to the scheduler.

Useful determinism this provides:
- Math.exp() and related libm functions match reference output to high precision on participating workers
- Capability filter (in principle) lets the scheduler route deterministic-math jobs to fdlibm-true workers

What this does NOT provide:
- Bit-equivalent floating-point across all operations (parallel reductions, FMA, vendor math libs still vary)
- Deterministic GPU compute (different driver versions / WebGPU implementations differ)
- Deterministic slice→worker assignment (scheduler picks by load + capability)
- Numpy / scipy / sklearn determinism (no equivalent test for those)

For research reproducibility (paper-grade results), this is *partial* determinism, not a complete substitute for pinned hardware + deterministic CUDA flags. For production inference where bit-equivalence isn't required, it is fine and provides slightly more guarantee than expected.

Note: capability filtering is reported by workers but **jobs cannot currently require fdlibm: true** because the job-side capability requirement API is not implemented (see `sdk-probe-deep.md`). So in practice, determinism is informational not enforceable until that API ships.

## Where DCP genuinely fits in ML

Honest list of ML workloads where DCP is the right tool, in priority order:

1. **Embarrassingly parallel batch inference of small-to-medium models (under 4GB).**
   - Examples: bulk transcription, batch image classification, batch document parsing, embedding generation, content moderation pipelines.
   - This is what every Honeyvision-shape case in the pressure-test files uses.

2. **Pre/post-processing data fan-out.**
   - Image augmentation, audio chunking, document slicing, feature extraction.
   - Each slice transforms one item, no model required.

3. **Hyperparameter sweeps for small / fast trials.**
   - Each slice trains-from-scratch on small data with one config.
   - Bounded by 4GB heap and reasonable wall-clock per trial.

4. **Federated learning compute substrate.**
   - With aggregation, privacy, and verification layered on top.
   - Private Compute Groups give the right multi-party isolation primitive.

5. **Volunteer pool for shared-goal ML compute (Folding@home pattern).**
   - Public-good citizen science, climate models, biodiversity classifiers.
   - 0%-commission Compute Group is the marketing-claimed mechanism.

## Where DCP does not fit in ML (and the alternatives)

| ML need | DCP fit | Use instead |
|---|---|---|
| Distributed training of >1B param models | Wrong tool | Modal, Ray, Anyscale, vendor (AWS SageMaker, GCP Vertex), or self-hosted Slurm + NCCL |
| Real-time inference serving (sub-100ms p99) | Wrong tool | Triton, TGI, vLLM, Modal, BentoML, vendor inference services |
| Streaming token generation for LLMs | Wrong tool | Same as above. WebSocket-based serving infra. |
| Models >4GB (any Llama 8B+, Mixtral, large vision) | Wrong tool | Server-class GPU inference infra |
| Anything needing CUDA-specific operators (FlashAttention, Triton kernels) | Wrong tool | Native GPU infra |
| Research workflows requiring Python + autograd | Wrong tool | Standard PyTorch on whatever infra |
| Reproducible bit-deterministic compute | Wrong tool | Pinned hardware, deterministic CUDA flags |
| Privacy-critical ML on adversarial public workers without verification layer | Wrong tool | Trusted enclaves (TEE), private Compute Group only, or homomorphic encryption |

## Implications for any "DCP as ML platform" pitch

If the team's pitch frames DCP as a *generic* ML platform or "the future of distributed ML," the CEO judge will catch the mismatch immediately because Distributive themselves do not market it that way. The marketing is "parallel computing platform that breaks workloads into slices."

The pitch shapes that survive contact with this audit:

1. **DCP-as-batch-inference-substrate** (the Honeyvision shape). Pick a workload that is genuinely embarrassingly-parallel and bounded under 4GB. This is what the existing pressure-test cases recommend. Sound footing.

2. **DCP-as-federated-learning-substrate.** Honest framing: DCP provides the compute and Compute Group primitives; the team builds the FedAvg / aggregation / privacy layer on top. Differentiated, ambitious, real engineering risk in 36 hours.

3. **DCP-as-volunteer-pool-for-public-good-ML.** Folding@home-shaped. Compute groups with 0% commission, public-good ML task. Demo writes itself with progress bar across many participants. Lighter engineering risk than #2.

The pitch shapes that do *not* survive contact:

- **DCP as "distributed training runtime"** — fundamentally false. Stateless workers, no AllReduce, 4GB cap, WebGPU operator gap.
- **DCP as "real-time inference platform"** — wrong shape. Cold-start dominance, no streaming, no per-request serving.
- **DCP as "ML pipeline orchestrator"** — wrong category. DCP is a compute primitive, not an orchestrator.
- **DCP as "trustless ML compute marketplace"** — overclaimed. No native Byzantine resilience, requires customer-built verification.

## What the team should *not* claim in the pitch

Specific phrasings to avoid (each is technically wrong):

- "DCP can train any model" → no, only what fits in 4GB and only via federated learning patterns at best
- "DCP replaces vLLM / Triton for inference" → no, DCP is batch, those are serving
- "DCP is trustless ML compute" → no, public workers are anonymous and unverified by default
- "Run any Python ML model on DCP" → no, you need ONNX-export and WebGPU-compatible operators (or Pyodide-compatible packages, which excludes PyTorch)
- "DCP is a complete ML platform" → no, it is a parallel compute substrate. Orchestration, tracking, deployment all come from elsewhere.

## What the team *can* honestly claim

- "DCP is a distributed compute substrate that runs ONNX-format models in browser-class workers, well-suited to embarrassingly-parallel batch inference."
- "For batch workloads under 4GB per slice, DCP delivers genuine cost savings vs cloud equivalents *at Distributive's published reference rates* (the pricing/metering backend is still in beta per their public README, last updated Sep 2024). Trade-offs: cold-start time, result-quality verification, and currently no enforceable capability filtering on the job side."
- "DCP's Private Compute Group primitive gives an honest multi-party isolation boundary, suitable for federated learning architectures built on top."
- "DCP is not a replacement for distributed training infrastructure or real-time inference serving. It complements those by handling the parallel-fan-out parts of an ML pipeline."

These are the survivable claims. Everything stronger overclaims.

## Final verdict

DCP is a real, useful, novel distributed compute substrate. It is a *partial* fit for ML workloads. Specifically:

- **Yes** for batch inference of bounded models (the Honeyvision shape)
- **Yes** for federated learning if you build aggregation layer
- **Yes** for HPO at small scale
- **Yes** for volunteer-pool public-good ML compute
- **No** for distributed training of any non-trivial model
- **No** for low-latency serving
- **No** for models over 4GB
- **No** for anything needing CUDA-specific operators or peer-to-peer worker comm

The hackathon project should claim what is true and not stretch. The CEO judge built DCP and will catch overclaims faster than any other judge on the panel. The strongest pitch is the most honest one: DCP for batch ML workloads where the 4GB / cold-start / WebGPU constraints are acceptable, with private Compute Group privacy primitive as the differentiator vs. cloud equivalents.

## Sources

DCP positioning and capabilities:
- DCP platform marketing: https://distributive.network/platform
- DCP documentation home: https://docs.dcp.dev/
- DCP getting started: https://docs.dcp.dev/intro/getting-started.html
- DCP Worker security architecture: https://distributive.network/docs/security-worker.html
- DCP compute economics: https://distributive.network/docs/compute-economics.html

V8 / WebGPU runtime constraints:
- V8 sandbox / pointer compression cage: https://v8.dev/blog/sandbox
- WebGPU LLM inference benchmarks (M2, RTX): per `manufacturing-pivots-and-gemma.md` Section 4 sources
- Browser memory limits: https://textslashplain.com/2020/09/15/browser-memory-limits/

ML runtime alternatives and contrast:
- Modal labs (serverless ML serving + training): inferred from market
- Ray distributed framework: https://www.run.ai/guides/gpu-deep-learning/distributed-training
- vLLM, TGI, Triton: serving-tier products (inferred from market)
- Distributed deep-learning training survey: https://www.preprints.org/manuscript/202512.2207

Federated learning context:
- Same sources as `extended-pressure-test.md` Mode 3 section

Byzantine and trust:
- Byzantine-resilient distributed computation paper: https://arxiv.org/html/2507.16014
- Byzantine fault tolerance overview: https://www.geeksforgeeks.org/system-design/byzantine-fault-tolerance-in-distributed-system/
