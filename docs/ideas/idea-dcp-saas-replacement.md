---
type: project-idea
project: Tessera
context: hackathon
tier: 0
status: exploration
committed: false
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[Case Study Distributive]]"
  - "[[ideas]]"
  - "[[demo-plan]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - distributive
  - whisper
  - exploration
  - uncommitted
---

# DCP-as-replacement-for-paid-SaaS

Honeyvision-shaped product candidate: take a real recurring compute workload that currently runs on an expensive SaaS, replace the SaaS with DCP fan-out across idle compute, demonstrate genuine cost savings with apples-to-apples accuracy comparison.

Status: exploration only. Not committed. Two engineering-risk spikes required before team commit.

## Why this shape

The Honeyvision case study hides three things that the Distributive CEO judge knows are hidden:

1. The actual model Honeyvision ran on DCP (almost certainly a small fine-tuned vision model, not a managed general API)
2. The accuracy/SLA tradeoff (managed API replaced by task-specific model)
3. What the $12.5k/yr actually accounts for (DCP credits + electricity, not engineering effort)

The 92% (16x) claim is real but narrow: same task, comparable accuracy, marginal compute cost vs list-price API.

Quoted CEO statements from the case study:
- Dan Desjardins, CEO Distributive: "We slashed cloud computing bills by 16x using the Distributive Compute Protocol."
- Andrew Pohran, CEO Honeyvision: "By deploying our Machine Vision solutions on DCP instead of in the cloud, we're decreasing our compute spend by over 15x, passing huge savings onto our customers and keeping their data private and on-perm where it belongs."

The product shape we want to mirror: ongoing per-unit compute, public list-price incumbent, embarrassingly parallel, ideally with privacy/data-sovereignty pressure.

## Disqualified ideas (from `ideas.md`)

The original three (Tally, carbon registry, naturalist) all fail the Honeyvision filter: they are new products in spaces with no obvious incumbent SaaS to replace. They earn DCP on parallelism alone, not on the cost-substitution narrative.

## Candidate replacements

| Incumbent (replaced) | Workload | Public pricing | Privacy pressure | Demo-ability |
|---|---|---|---|---|
| AWS Transcribe / Transcribe Medical | Audio → text per-minute | $0.024/min standard, $0.075/min medical | High (HIPAA, legal depositions, journalist sources) | Very high |
| AWS Textract / Google Document AI | PDF/scan → structured data per-page | $0.0015 to $0.065/page | High (legal, medical, audit) | Medium |
| Hive / AWS Rekognition Content Moderation | Per-frame classification | $0.001/image | Medium (small platforms) | Very high (literally Honeyvision-shaped) |
| OpenAI / Claude batch API | Per-document LLM tasks | $0.50 to $2 per million tokens | High (regulated industries) | Medium, stacks Gemma 4 + DCP |
| Illumina BaseSpace / DNAnexus | Genomic variant calling per sample | Hundreds of $ per sample | Very high (PHI) | Low (too domain-specialized) |

Top picks: transcription (cleanest demo math, mature open-weights, HIPAA framing) and video moderation (most Honeyvision-shaped, literally video monitoring).

## Defensible cost-savings framework

Three measurements running side-by-side on the same input:

```
Same input workload (e.g. LibriSpeech 100 min)
       │
       ├─► Cloud incumbent API → wall-clock, $ at list price, output quality
       │
       └─► DCP fan-out + small open model → wall-clock, DCP credits, output quality
       │
Dashboard: same input, comparable quality with delta visible, real cost diff
```

Hard requirements for integrity:
- Same input bytes on both sides
- Quality metric (WER for audio, mAP for vision, F1 for OCR)
- No hardcoded cost numbers; both sides computed live from real measurements

Honest pitch line: "Same 100-min audio. WER 4.2% (AWS) vs 5.7% (DCP+Whisper-base). AWS list price: $2.40. DCP consumed N CPU-seconds at current market rate: $0.0YY." The asterisk *is* the integrity.

## Verified DCP integration shape

SDK is small. Coordinator-side (revised after source verification of `~/dcp-sdks/dcp-client`):

```js
const { init } = require('dcp-client');
const { RemoteDataPattern } = require('dcp/compute');
await init('https://scheduler.distributed.computer');
const compute = require('dcp/compute');

// Audio chunks AND model weights both shipped via RemoteDataPattern
// from CORS-enabled bucket. Each slice fetches its assigned chunk URL
// plus shared weight URLs. No DCP-layer caching across slices; rely
// on browser HTTP cache + same-worker reuse.
const audioChunks = new RemoteDataPattern(
  'https://bucket.example.com/audio/chunk-{slice}.kvin', 200);

const job = compute.for(audioChunks, workFunction);
const results = await job.exec(compute.marketRate);
```

Worker-side (inside the work function):
- Sandbox is V8 + Dawn WebGPU + WebAssembly (verified against dcp-worker README)
- No filesystem, no arbitrary networking
- `progress()` heartbeat is mandatory; **30-sec hard timeout, not configurable**
- Fetches slice input via `RemoteDataPattern` URL (CORS required for browser workers)
- Encoding: JSON or KVIN (KVIN handles Typed Arrays, right choice for audio buffers)
- Inside the slice, the work function pulls model weights from a separate URL the first time and relies on browser HTTP cache for subsequent slices on the same worker
- Pyodide is auto-shipped to every sandbox (~26MB always-loaded baseline) but only initializes if work function uses Python worktime

**Source-verified note**: `job.requires()` does NOT exist as a public API (the mandelbrot-tutorial reference was misleading). Module shipping is internal supervisor-to-worker postMessage; users have only `RemoteDataPattern` for shipping data. There is no DCP-layer cache for RemoteDataPattern responses; each slice re-fetches unless browser HTTP cache headers + same-worker reuse provide memoization.

Transcription-shaped slice flow (revised after SDK source probe):
```
Coordinator                       DCP scheduler           Worker sandbox
1. Slice 100min audio → 200×30s chunks
2. Upload chunks AND whisper.onnx weights to CORS-enabled bucket
   with aggressive Cache-Control headers (max-age, etag) so browser
   HTTP cache memoizes weights after first fetch on same worker
3. compute.for(remoteDataPattern, workFn)
4. job.exec(compute.marketRate) → splits → per-slice:
                                                          - fetch chunk via RemoteDataPattern
                                                          - fetch weights URL (cached by browser
                                                            after first slice on this worker)
                                                          - decode wav → mel spectrogram
                                                          - run whisper inference (transformers.js)
                                                          - progress() heartbeat (every <30s)
                                                          - return {chunkId, text, cpuMs}
5. Aggregate, stitch transcript ← ResultHandle
6. Cost reporting (with caveat): per Distributive's published reference
   rate, ResultHandle credit metadata reports placeholder values until
   the metering backend ships.
```

## GPU question (the explicit one)

**No, this does not need access to a stronger GPU.** WebGPU on commodity hardware is sufficient because Whisper-base/tiny are small enough. The pitch failure mode is not GPU strength, it is worker-pool size and cold-start cost.

Sizing math (approximate, needs measurement on real DCP workers):

| Model | Params | ONNX size | WebGPU on M-series laptop | WASM-only on i7 laptop | Realtime factor |
|---|---|---|---|---|---|
| whisper-tiny.en | 39M | ~40MB | ~10x realtime | ~1.5x realtime | Comfortable |
| whisper-base.en | 74M | ~150MB | ~5x realtime | ~1x realtime | Comfortable |
| whisper-small.en | 244M | ~500MB | ~2x realtime | ~0.5x realtime | Marginal |
| whisper-medium | 769M | ~1.5GB | needs dedicated GPU | not viable | Out of scope |
| whisper-large-v3 | 1.55B | ~3GB | needs A100-class | not viable | Out of scope |

Hackathon-target model: `whisper-base.en`. Comfortable on commodity WebGPU, viable on WASM-only fallback, accuracy delta vs AWS Transcribe small enough to defend.

The point of DCP is *not* substituting one strong GPU. It is parallel mediocre GPUs. 50 typical laptops at 5x realtime each beats one A100 at 50x realtime for a 100-minute job, because parallelism dominates raw single-node speed. WebGPU "weakness" is a feature: workers can be anything from M-series Macs down to integrated-graphics ThinkPads.

What this means for risk:
- We don't need to source strong GPUs.
- We need *enough WebGPU-capable workers in the pool simultaneously*.
- CPU+WASM path must work as fallback, even if 5x slower.
- Whisper-medium and larger are off-limits.

If the public DCP worker pool is sparse during hackathon weekend, fall back to a Private Compute Group of 4 team laptops (M-series preferred) plus optional cloud VMs. The case study itself uses a private group, so the pitch story holds.

## Pricing reality (verified Apr 2026)

Full transcription incumbent landscape, per minute of audio:

| Provider | Model | Rate | HIPAA-eligible? |
|---|---|---|---|
| OpenAI | gpt-4o-mini-transcribe | $0.003 | Only with explicit BAA + zero-retention endpoint config |
| OpenAI | whisper-1 | $0.006 | Same caveat |
| OpenAI | gpt-4o-transcribe (incl. diarization) | $0.006 | Same caveat |
| Azure | Speech batch | $0.003 | Yes, BAA standard |
| Azure | Speech standard real-time | $0.017 | Yes, BAA standard |
| AWS | Transcribe volume tier 3 (4M+ min) | $0.0102 | Yes, BAA standard |
| AWS | Transcribe tier 2 (250k to 1M min) | $0.015 | Yes, BAA standard |
| AWS | Transcribe tier 1 (first 250k min) | $0.024 | Yes, BAA standard |
| AWS | Transcribe Medical | $0.075 | Yes, BAA standard |

DCP cost side:

| | Rate | Source |
|---|---|---|
| DCP Compute Credit | 1 credit = $0.0003171 USD | Distributive compute economics |
| DCP billable units | reference CPU-hours, GPU-hours, input MB, output MB | Distributive compute economics |
| Marketing average | ~$0.0005 per CPU-hour | $50 = 100k+ hours claim |
| Hackathon credits | $50 = ~157,617 credits | DCP marketing material |

DCP cost per audio minute is computed against Distributive's published reference rate (~$0.0005/CPU-hour from marketing material). Source verification (`~/dcp-sdks/dcp-client/README.md:171`) confirms that `marketValue` and `marketRate` are currently placeholder constants; the metering backend has not shipped per the public README (last updated Sep 2024). The demo dashboard should compute against published reference rates with explicit caveat in the pitch, not present "live measured DCP cost." If pricing has gone live in production scheduler since the README, that should be verified directly with Distributive at the event.

### Savings math against each incumbent (100-min demo input)

DCP estimate (conservative, whisper-base at 5x realtime = ~0.33 CPU-hr × $0.0005/CPU-hr): ~$0.000165.

| Incumbent | Cost for 100 min | Multiplier vs DCP | Absolute saving |
|---|---|---|---|
| OpenAI gpt-4o-mini-transcribe | $0.30 | ~1,800x | $0.30 |
| OpenAI whisper-1 / gpt-4o-transcribe | $0.60 | ~3,600x | $0.60 |
| Azure Speech standard | $1.70 | ~10,000x | $1.70 |
| AWS Transcribe standard tier 1 | $2.40 | ~14,500x | $2.40 |
| AWS Transcribe Medical | $7.50 | ~45,000x | $7.50 |

## Pitch framing: which incumbent to pick

The Honeyvision case study explicitly compared to *Microsoft Custom Vision*, a managed enterprise vision API. They did not compare to the cheapest vision API on the market. The 16x figure is against what their customer was actually forced to use given compliance and operational constraints.

We should mirror exactly:

Wrong incumbent: OpenAI gpt-4o-mini-transcribe at $0.003/min. Hard to dramatize a savings claim because the absolute dollars are small (a 30 cent win on 100 minutes does not motivate enterprise procurement).

Right incumbent: AWS Transcribe Medical at $0.075/min, or Azure Speech with BAA. The hospital recording 4 hours of dictation per doctor per day across 200 doctors is paying ~$4,500/month on AWS Transcribe Medical. That is the customer Honeyvision serves, translated to a different domain.

Microsoft parallel as rhetorical asset: Honeyvision replaced Microsoft Custom Vision; we replace Microsoft Azure Speech (or AWS Transcribe Medical). Same enterprise mindset, different domain.

Honest pitch line that survives scrutiny: "For general consumer transcription, OpenAI is already cheap. We are not pitching that customer. For the hospital recording 4 hours of dictation per doctor per day across 200 doctors, OpenAI requires custom BAA + zero-retention setup, and the only turnkey option is AWS Transcribe Medical at $4,500/month, replaced by DCP running Whisper-base on idle hospital workstations for under $10/month, with zero data egress."

## OpenAI HIPAA caveat (worth understanding for honesty)

OpenAI does offer BAAs for API services as of 2026, but only on endpoints configured for zero data retention. This is opt-in per endpoint and not the default path. By contrast, AWS Transcribe Medical and Azure Speech are HIPAA-eligible by default with a standard BAA covering the entire service. For a hospital procurement team, "HIPAA-eligible by default" beats "HIPAA-eligible with custom configuration and per-endpoint vetting" every time. This is *why* AWS/Azure remain the actual incumbents in the medical-transcription space despite being more expensive than OpenAI.

## Two engineering risks (4-hour spike before team commit)

**Risk 1: bundle ship and worker re-fetch.** whisper-tiny.en quantized ONNX is ~40MB; whisper-base.en is ~150MB. Source verification: `job.requires` is NOT a public API; data shipping is via `RemoteDataPattern` only. RemoteDataPattern has NO DCP-layer cache; each slice re-fetches unless browser HTTP cache + same-worker reuse memoizes. Spike question: serve weights from a CORS bucket with aggressive Cache-Control, run 5 sequential slices through one worker, measure whether subsequent slices skip the download. Fallback if caching unreliable: pre-cache weights on team-laptop workers' filesystem out of band and run on a Private Compute Group.

**Risk 2: cold-start dominance.** If model load takes 20s and inference takes 2s, parallelism gain disappears. Spike question: run 5 slices on one worker, measure load-to-inference time ratio. Open question: does DCP reuse sandbox across slices on the same worker, or cache `requires`-d modules?

Manageable risks:
- Public worker availability on hackathon weekend → Private Compute Group fallback on team hardware
- Uneven WebGPU support across worker pool → CPU+WASM path is mandatory baseline
- Cost-saving math integrity → enforced by reading actual CPU-seconds from ResultHandle metadata

## Spike plan (gates the team commit)

Hour 0 to 4: standalone Node script. Single audio chunk → single DCP slice → whisper-base → transcript back. Measure: bundle ship time, model cold-start, slice wall-clock, ResultHandle credit metadata.

Pass gate: cold-start under 15s, end-to-end under 20s for one 30-second audio chunk.

If the gate fails, the failure mode is "bundle size or cold-start kills parallelism." Pivot options:
- Drop to whisper-tiny.en (~40MB)
- Switch to video moderation variant where YOLOv8n is ~6MB, dramatically smaller bundle
- Accept WASM-only path with longer chunks

If the gate passes, 36-hour build is straightforward:
- T+4 to T+12: input set of N chunks via `RemoteDataPattern`, parallel slice execution
- T+12 to T+18: AWS Transcribe parallel pipeline + LibriSpeech ground truth + WER computation
- T+18 to T+24: cost calculator (real DCP CPU-seconds × market rate vs real AWS charges)
- T+24 to T+30: demo dashboard with live side-by-side
- T+30 to T+36: pitch / video / submission

## Sources

DCP runtime and SDK:
- DCP getting-started, compute.for and job.exec API: https://docs.dcp.dev/intro/getting-started.html
- DCP mandelbrot tutorial (note: `job.requires` API does NOT exist in the v4.4.12 source; the tutorial is misleading on this): https://docs.dcp.dev/tutorials/node/mandelbrot.html
- DCP remote input data, RemoteDataPattern + KVIN: https://docs.dcp.dev/advanced/data-uri.html
- DCP Worker security architecture, V8 + Dawn WebGPU sandbox: https://distributive.network/docs/security-worker.html
- DCP Worker GitHub: https://github.com/Distributed-Compute-Labs/dcp-worker
- DCP client GitHub: https://github.com/Distributed-Compute-Labs/dcp-client

DCP pricing:
- Compute economics, credit pricing: https://distributive.network/docs/compute-economics.html
- marketValue API (note: source verification at `~/dcp-sdks/dcp-client/README.md:171` confirms this is currently a placeholder constant, not metered): https://docs.dcp.dev/api/compute/functions/market-value.html

Models:
- Transformers.js v3 WebGPU + Whisper: https://huggingface.co/blog/transformersjs-v3
- transformers.js GitHub: https://github.com/huggingface/transformers.js/

Cloud incumbents:
- AWS Transcribe pricing: https://aws.amazon.com/transcribe/pricing/
- OpenAI API pricing (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe): https://openai.com/api/pricing/
- OpenAI HIPAA BAA process: https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai
- Azure Speech pricing: https://azure.microsoft.com/en-us/pricing/details/speech/

Case study (also at `Case Study Distributive.md` in this folder):
- Honeyvision Overwatch on DCP: 92% / 16x cost reduction vs Microsoft Custom Vision, on-prem data sovereignty, deployed in 6 months
- Quoted: Dan Desjardins (CEO Distributive), Andrew Pohran (CEO Honeyvision)
- Source link in original capture (NGen Canada)
