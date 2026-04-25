---
type: project-analysis
project: Tessera
context: hackathon
tier: 0
status: decision-input
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[pressure-test-cases-comparison]]"
  - "[[idea-dcp-saas-replacement]]"
  - "[[Case Study Distributive]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - distributive
  - pressure-test
  - federated-learning
  - collaborative
---

# Extended idea bank + critical analysis of DCP for collaborative use cases

Companion file to `pressure-test-cases-comparison.md`. Same Honeyvision filter, lighter rubric: each idea gets a short architecture-level pressure-test (bundle, sandbox fit, incumbent, demo) and a one-line verdict. Then a dedicated section critically analyzing DCP's fit for collaborative compute, including the cases where it does *not* fit.

For full-rubric scoring see the comparison file. This file is for breadth.

## Short-form pressure tests

### A. Translation as DCP service (replace DeepL / Google Translate / AWS Translate)

- Architecture: per-segment fan-out. Coordinator splits doc into sentences, slices translate one sentence each, coordinator stitches.
- Stack: NLLB-200 distilled-600M ONNX (~600MB) or MarianMT ONNX (~250MB per language pair). transformers.js supports both.
- Sandbox fit: V8+wasm+WebGPU compatible.
- Bundle reality: 250-600MB. Borderline. RemoteDataPattern caching needed. MarianMT is more practical because it can be sharded by language pair.
- Incumbents (Apr 2026): DeepL $25/M characters, Google Translate $20/M, AWS Translate $15/M.
- Privacy: international business documents, M&A memos, legal contracts in non-English jurisdictions. Real pressure for some customers.
- Demo viability: solid. Drop foreign-language doc, watch parallel translation, show cost ticker.
- Honeyvision parallel: legal firm needs Mandarin contract translation, can't send to DeepL, runs Marian on idle bilingual-paralegal workstations.
- Verdict: medium-high. Cleaner than LLM-batch (smaller model, better quality on translation specifically) but slightly weaker pitch than document extraction. Bundle size between Whisper-base and Gemma. Reasonable second-tier option.

### B. Image super-resolution / restoration (replace Topaz / Cloudinary upscale / Adobe Generative Fill)

- Architecture: per-image fan-out. Each slice gets one tile, returns upscaled tile, coordinator reassembles.
- Stack: Real-ESRGAN ONNX (~70MB). Multiple browser ports exist (web-realesrgan, nn-upscaler-onnxweb, websr). WebGPU support confirmed.
- Sandbox fit: confirmed via existing browser implementations.
- Bundle reality: 70MB is comfortable for `job.requires`.
- Incumbents: Topaz Labs API ~$0.10/image, Cloudinary AI add-on ~$0.001/transformation, Adobe Firefly ~$0.05-0.10/generation.
- Privacy: user photos, restoration of personal/historical archives. Moderate pressure (consumer apps already accept cloud upscaling).
- Demo viability: highest visual impact of any candidate. Side-by-side before/after is universally legible.
- Honeyvision parallel: archival/museum work where rare original images can't be uploaded to cloud. Slightly contrived. Genealogy services restoring family photos is a more believable customer.
- Verdict: medium. Strong demo, weaker pitch (consumer use case, soft privacy). Could combine with document extraction (page-restoration before OCR) as a hybrid.

### C. Video transcoding (replace AWS MediaConvert / Mux)

- Architecture: per-segment fan-out. Coordinator splits source into 10s segments, slices transcode independently, coordinator concatenates.
- Stack: ffmpeg.wasm.
- Sandbox fit: BLOCKED at the level that matters. ffmpeg.wasm runs in V8+wasm but the WebAssembly memory sandbox prevents access to the GPU encoder hardware that gives native ffmpeg its 12.5x speedup. ffmpeg.wasm is 720p at ~40fps vs native at ~500fps on the same hardware. Mobile workers fall back to single-thread, 3x slower again.
- Incumbents: AWS MediaConvert basic $0.0075/min SD, $0.015/min HD, $0.030/min 4K. Professional tier $0.012-$0.072/min.
- Privacy: low (most video is meant to be public).
- Demo viability: visual but slow. 30-min source video transcode might take real minutes even with fan-out.
- Verdict: **soft-blocked**. The economics work only if you have *many* idle workers compensating for each one being 12.5x slower than native. AWS MediaConvert pricing is already engineered against the cost of dedicated hardware encoders, so DCP fights an uphill battle on raw compute economics. Skip unless the pitch is "we replace MediaConvert for the case where the customer can't upload source to AWS in the first place" (which exists but is narrow).

### D. Image generation (replace Replicate / Stability AI / OpenAI DALL-E)

- Architecture: per-prompt fan-out. Each slice generates one image from one prompt.
- Stack: SD-Turbo ONNX, ~2GB quantized; SDXL Turbo ~6GB. Web Stable Diffusion (MLC) is mature on WebGPU.
- Sandbox fit: works with WebGPU; very slow without.
- Bundle reality: 2-6GB. Same gating risk as LLM-batch case.
- Incumbents: Replicate ~$0.0011/sec compute, Stability ~$0.04/image SDXL.
- Privacy: weak (image generation isn't sensitive, output goes to user anyway).
- Performance: SD-Turbo ~100ms on RTX 4090, several seconds on commodity laptops. Workers without WebGPU = unviable.
- Demo viability: visually compelling but image gen is what every other hackathon demo does. Lots of "wow that's an image" but no Honeyvision-shape pitch.
- Verdict: low-medium. Engineering risk same as LLM-batch but without the sponsor double-stack upside. Skip.

### E. Embedding generation for vector search (replace OpenAI embeddings / Pinecone embedding pipeline)

- Architecture: per-document fan-out for indexing. Each slice produces embeddings for one document, returns vector(s).
- Stack: sentence-transformers all-MiniLM-L6-v2 ONNX (~80MB). transformers.js supported. Or BGE-small (~130MB).
- Sandbox fit: small, mature, runs on WASM-only fine.
- Bundle reality: smallest of any LLM-adjacent case.
- Incumbents: OpenAI text-embedding-3-large $0.13/M tokens, text-embedding-3-small $0.02/M tokens, Cohere embed-v3 $0.10/M tokens. Pinecone bundles the embedding step into per-vector pricing.
- Privacy: HIGH. RAG over private corporate document stores is a major enterprise concern. OpenAI embeddings literally see every retrieved document.
- Demo viability: medium. Search UI with semantic results is okay but the embedding step itself is invisible.
- Honeyvision parallel: "build your own enterprise document search without sending your corpus to OpenAI" is a clean pitch.
- Verdict: medium-high. Cleanest LLM-adjacent case for this hackathon. Could be a *complement* to document extraction (extract text, then embed via DCP, then search). Hybrid play.

### F. Code static analysis / SAST (replace Snyk Code / Sonatype / Veracode)

- Architecture: per-file or per-rule fan-out. Slice = one file × one rule, returns findings.
- Stack: tree-sitter wasm (mature, ~5MB) for parsing + JavaScript-based rule engine. Semgrep core is OCaml, no clean wasm port. Most open-source SAST is native.
- Sandbox fit: tree-sitter is fine. Building a rule engine on top is real work.
- Bundle reality: tree-sitter ~5MB plus per-language grammars (~1MB each).
- Incumbents: Snyk Code ~$30+/dev/month enterprise, Sonatype IQ ~$50-100/dev/month, GitHub Advanced Security $49/dev/month.
- Privacy: HIGH. Source code shouldn't go to a third-party SAST vendor. Real enterprise concern.
- Demo viability: medium. Findings list is text-heavy but easy to grok.
- Honeyvision parallel: enterprise has 10M LOC, can't send to Snyk, runs custom rules across idle build-server fleet via DCP.
- Verdict: medium. Strong privacy, viable bundle, but "build a SAST tool" is real engineering and the rule library would need to come from somewhere (probably a thin set of hand-written rules). Risky to demo well in 36 hours.

### G. Audio source separation / stem extraction (replace LANDR / Splice / iZotope cloud)

- Architecture: per-track or per-segment fan-out. Coordinator splits audio, slices run Demucs on each chunk, coordinator merges stems.
- Stack: Demucs ONNX (~100MB). htdemucs is the typical model. Browser ports exist but less mature than transcription.
- Sandbox fit: reasonable, similar to Whisper.
- Bundle reality: ~100MB.
- Incumbents: LANDR Studio ~$200/year per seat, iZotope RX ~$400 perpetual, Splice cloud ~$15/month with limits.
- Privacy: low-medium. Music masters have IP value but cloud separation is already accepted in industry.
- Demo viability: high. "Listen to the vocal pulled out of the mix" is universally compelling.
- Honeyvision parallel: weak. Music industry hasn't been compliance-driven the way medical/legal has.
- Verdict: medium. Strong demo, weak pitch. Probably not for this hackathon.

### H. Speech synthesis / TTS (replace ElevenLabs / OpenAI TTS / AWS Polly)

- Architecture: per-segment fan-out. Slice = one paragraph, returns audio.
- Stack: Piper TTS (~30MB ONNX, very fast), Bark (~3GB, slow), Coqui TTS variants.
- Sandbox fit: Piper is excellent, Bark is the LLM-class case.
- Bundle reality: Piper ~30MB is comfortable.
- Incumbents: ElevenLabs ~$0.30/1k characters Pro, OpenAI TTS $15/1M characters, AWS Polly $4/1M characters standard.
- Privacy: voice cloning has real privacy concerns but most TTS is "speak this text aloud" which has none.
- **Sponsor track conflict**: ElevenLabs is a hackathon sponsor. Pitching "we replace ElevenLabs" to a panel that includes ElevenLabs is awkward. Pitching "we run TTS on idle compute" without naming ElevenLabs is fine.
- Demo viability: audio output, similar to transcription in reverse.
- Verdict: medium-low. Sponsor conflict is real. Skip.

### I. Embeddings + RAG combined (replace LangChain Cloud / Vercel AI / Hugging Face Inference)

- Architecture: hybrid. Indexing pipeline = embedding fan-out (case E). Query pipeline = parallel similarity search across vector shards on workers, then small-LLM rerank.
- Stack: MiniLM embeddings + Qwen 0.8B for rerank/synthesis.
- Sandbox fit: works.
- Bundle reality: embeddings 80MB + Qwen 500MB-1GB.
- Incumbents: combination of OpenAI embeddings + ChatGPT API, Cohere RAG, LangChain Cloud platform.
- Privacy: very high (private corporate RAG).
- Demo viability: high. Live "ask question against your private corpus" with nothing leaving the network.
- Honeyvision parallel: enterprise ChatGPT-for-internal-docs without sending docs anywhere.
- Verdict: medium-high. Effectively combines case E + case 3 (LLM-batch). Earns Gemma/MLH sponsor track *and* DCP track honestly. More engineering surface than picking one case, but unique product.

### J. Monte Carlo / financial simulation backtesting

- Architecture: per-trajectory fan-out. Coordinator dispatches N initial conditions, slices simulate one path each, coordinator aggregates statistics.
- Stack: pure JS or wasm-compiled C. No model needed.
- Sandbox fit: trivial. No external dependencies.
- Bundle reality: tiny (~kB).
- Incumbents: cloud quant platforms (QuantConnect ~$50-300/month), institutional Monte Carlo on AWS (per-instance-hour, scales fast).
- Privacy: HIGH for proprietary trading models.
- Demo viability: medium. Pretty charts but the "wow this is fast" moment requires the audience to grok what a Monte Carlo run normally takes.
- Verdict: low-medium. Clean technical fit (smallest bundle, no model risk). Pitch is dry for hackathon judges. Niche customer.

## Quick comparative ranking (relative to existing top picks)

Existing top: document extraction (26), video moderation (26), transcription (24).

Of the new ideas, the strongest contenders are:

| New idea | Relative score estimate | Key comparison |
|---|---|---|
| Translation (A) | 22-24 | Slightly weaker pitch than transcription, similar bundle. |
| Embeddings + RAG (I) | 24-25 | Cleaner version of LLM-batch case, hybrid possibilities. Highest of new ideas. |
| Embeddings alone (E) | 22 | Strong privacy, weak demo (embedding is invisible). |
| Image super-resolution (B) | 20-21 | Best demo of new ideas, weakest pitch. |
| Code SAST (F) | 19-20 | Strong privacy, hard to build well in 36hr. |
| Audio separation (G) | 18 | Strong demo, weak pitch. |
| Translation (A) | 22 | (already noted) |
| Monte Carlo (J) | 16 | Cleanest tech, dry pitch. |
| Video transcoding (C) | 12 | Soft-blocked by sandbox/encoder gap. |
| Image generation (D) | 14 | Same engineering risks as LLM-batch, weaker pitch. |
| Speech synthesis (H) | 14 | ElevenLabs sponsor conflict. |

None of the new ideas beat the existing top three in isolation. Two of them (E embeddings, I RAG) are interesting as *complements* layered on top of an existing top pick rather than as standalone projects.

## Critical analysis: DCP for collaborative use cases

This is a separate axis from the cost-replacement axis. "Collaborative" can mean four very different things, and DCP fits some perfectly while being completely wrong for others. This section critically distinguishes the four.

### Mode 1: Workers cooperate to complete one job (batch fan-out)

- Architecture: one coordinator submits a job, many workers each compute one slice, coordinator aggregates results.
- DCP fit: native and perfect. This is the entire DCP product.
- Privacy: results-only, workers see only their slice. Data partitioning is the responsibility of the coordinator.
- All five Honeyvision-shape cases pressure-tested already use this mode.
- Verdict: this is the default and works.

### Mode 2: Volunteer compute for a shared scientific or public-good goal (Folding@home style)

- Architecture: a coordinator publishes a public job at zero or near-zero scheduler commission. Volunteers join the public Compute Group (or a public-good private group). Their idle compute contributes to the goal.
- DCP fit: native. The Compute Group model with configurable scheduler commission directly supports this. Set commission to 0% and the credits flow purely to compensate workers; set the customer side to a public-funded budget and the work runs.
- Real precedents: Folding@home, BOINC, Einstein@home, SETI@home all run on this exact pattern (with their own bespoke infrastructure rather than DCP). DCP could host a generic version of any of these.
- Hackathon demo angle: "Pick a public-good ML task (climate model fine-tuning, biodiversity ID, citizen-science image classification), publish it on DCP, watch a heterogeneous worker pool contribute toward shared progress." The demo writes itself with a progress bar across many participating workers.
- Privacy: workers contribute compute only, not data. Privacy is handled by the coordinator's choice of dataset (already public).
- Critical caveat: "volunteer" is a marketing word. In DCP's actual model, volunteers receive Compute Credits proportional to work done. Whether those credits are donated back, sold, or held is the volunteer's choice. The pitch should not claim "free" volunteer compute; it should claim "low-cost public-good compute pool."
- Verdict: real fit, viable in 36 hours if a small public-good ML task is picked. Differentiates strongly from "boring batch fan-out" pitches.

### Mode 3: Federated learning across multiple parties with private data

- Architecture: multiple organizations each run a private Compute Group containing their workers and their private data. A coordinator orchestrates training across compute groups: in each round, each group runs local training on its private data, computes a gradient/update, and ships only the update (not the data) to the coordinator. Coordinator aggregates updates and broadcasts the new model state. Repeat.
- DCP fit: tractable but requires significant additional architecture. DCP itself does not provide:
  - Cross-Compute-Group coordination protocol
  - Secure aggregation of gradients (i.e. coordinator should not be able to recover individual contributions)
  - Differential privacy mechanisms on gradients
  - Round/epoch synchronization across groups
  These have to be built on top of DCP's primitives.
- Real precedents: federated learning with secure multi-party computation is a real research area (PriFLRC, JPMorgan SMPAI work, Google Federated Averaging). None of these standard implementations target DCP specifically.
- Hackathon demo angle: simulated federated medical imaging classification across 3 simulated "hospitals" (each on a private Compute Group on team laptops). Each hospital trains a small classifier on its private (pre-loaded) image partition. Updates aggregate at coordinator. Demo shows: each hospital's data never leaves its compute group; only aggregated model improves; final model classifies a held-out test set well.
- Critical caveat: 36 hours is tight for federated learning *plus* secure aggregation *plus* a polished demo. Without secure aggregation, the pitch ("data stays private") is weakened because the coordinator can in principle reconstruct individual contributions from raw gradients. With secure aggregation, the engineering surface roughly doubles.
- Verdict: highest-ceiling pitch (genuinely novel, differentiated, technically substantive) and highest-risk (most ambitious build). Not a fit unless the team has an experienced ML person willing to commit fully to this path.

### Mode 4: Real-time collaborative applications (Figma, Google Docs, multiplayer games)

- Architecture: persistent state, real-time bidirectional networking, low-latency mutation broadcast, conflict-free replicated data types (CRDTs) or operational transforms (OTs).
- DCP fit: **not at all**. DCP is batch-oriented. Workers are sandboxed with no arbitrary networking, no persistent state, no socket access. The slice/job/result model is request-response, not bidirectional.
- Verdict: do not pitch DCP for collaborative real-time applications. The case study judge will catch the mismatch immediately. If the team's idea has a "users collaboratively edit X in real time" component, that component cannot run on DCP. It would need a separate stack (Liveblocks, Yjs, custom WebSocket server, etc.).

### Summary table of collaborative modes

| Mode | DCP fit | Engineering risk | Hackathon demo potential |
|---|---|---|---|
| 1: batch fan-out | Native | Low | Default; covered by existing pressure-test cases |
| 2: volunteer public-good compute | Native (use 0% scheduler commission) | Medium | High; visible progress bar across volunteer pool |
| 3: federated learning across orgs | Tractable on top, requires additional aggregation layer | High | High but ambitious; needs experienced ML teammate |
| 4: real-time collaborative apps | None | N/A | Do not pitch this |

## Where this analysis lands relative to existing top picks

Three takeaways:

1. **No standalone new idea beats the existing top three (document extraction, video moderation, transcription).** The exhaustive list above does not produce a new winner.

2. **Two new ideas are interesting as complements**: embeddings (E) and RAG (I) layer cleanly on top of document extraction. The hybrid "extract documents on DCP + embed extracted text on DCP + search via RAG on DCP, all in a private Compute Group" is a genuinely strong pitch with three sponsor tracks earned (DCP + Gemma + UI/UX). Engineering surface is real.

3. **Collaborative angle adds a fifth dimension to the pitch matrix.** A standalone DCP project that demonstrates federated learning (mode 3) or volunteer public-good compute (mode 2) is rarer in hackathon submissions than batch fan-out. If the team wants to pitch *novelty* alongside *cost replacement*, mode 2 is achievable in 36 hours; mode 3 requires the right teammate.

If the team is leaning toward the document-extraction primary case, the strongest add-ons are: embedding/RAG complement (case I), or a federated-learning angle on top (mode 3), or both. If the team is leaning toward video moderation, the cleanest add-on is volunteer compute (mode 2) framed as "public-good content moderation pool for under-resourced platforms."

## What this file does *not* answer

- Whether the team has the ML capacity for federated-learning mode (unknown, see `team-canvas.md`).
- Whether DCP scheduler commission can be set to 0% for a public-good demo (claimed in marketing material, requires verification with Distributive directly during the hackathon).
- Whether translation NLLB-200 or MarianMT bundle ships cleanly via `job.requires` at 250-600MB (same risk class as Whisper-base, needs spike).

## Sources (additional, building on the comparison file's source list)

DCP collaborative compute:
- Private Compute Groups, join key/secret model: https://distributive.network/docs/security-worker.html
- Docker Worker for orchestrated deployment: https://distributive.network/docs/worker-docker.html
- Linux Worker: https://distributive.network/docs/worker-linux.html

Federated learning research context:
- Differentially Private Secure Multi-Party Computation for Federated Learning (financial applications): https://arxiv.org/abs/2010.05867
- JPMorgan SMPAI: Secure Multi-Party Computation for Federated Learning: https://www.jpmorgan.com/content/dam/jpm/cib/complex/content/technology/ai-research-publications/pdf-9.pdf
- When Federated Learning Meets Privacy-Preserving Computation: https://dl.acm.org/doi/10.1145/3679013

New incumbent pricing:
- AWS MediaConvert pricing: https://aws.amazon.com/mediaconvert/pricing/
- Google Cloud Translation pricing: https://cloud.google.com/translate/pricing
- DeepL API pricing: https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans

Open-weights browser viability (additional):
- Real-ESRGAN web ports: https://github.com/xororz/web-realesrgan
- nn-upscaler ONNX web: https://github.com/wanghaisheng/nn-upscaler-onnxweb
- Web Stable Diffusion (MLC): https://websd.mlc.ai/
- ffmpeg.wasm GPU/hardware-encoder gap analysis: https://dayverse.id/en/articles/why-ffmpeg-wasm-fails-leverage-gpu-acceleration/
