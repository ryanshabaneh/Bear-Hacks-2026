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
  - "[[extended-pressure-test]]"
  - "[[idea-dcp-saas-replacement]]"
  - "[[Case Study Distributive]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - manufacturing
  - gemma
  - honeyvision
---

# Manufacturing pivots, video-moderation reality check, Gemma 4 verified probe

Three sections:
1. Manufacturing-shaped repackaging of the top use cases (the literal Honeyvision pivot)
2. Critical analysis of video moderation against in-house platforms (the YouTube objection)
3. Gemma 4 verified facts and the multimodal-on-DCP architectural option

Companion to `pressure-test-cases-comparison.md` and `extended-pressure-test.md`.

## 1. Manufacturing pivots

The Honeyvision case study is *itself* a manufacturing case. The CEO judge spent six months building Overwatch for a manufacturer. Mirroring the manufacturing vertical lands us inside the judge's strongest validation pattern instead of asking him to translate our pitch to his world.

For each top-tier use case, here is the manufacturing-specific repackaging.

### 1A. Document extraction → manufacturing document automation

Manufacturing drowns in paper. Real recurring workloads:

| Document type | Source | Volume per plant | Privacy pressure |
|---|---|---|---|
| Certificate of Conformance (CoC) from suppliers | Every incoming material lot | 100s/day at mid-size plant | Supplier IP, proprietary specs |
| Bill of Materials (BoM) / engineering drawings | Engineering change orders, new SKUs | 10s/day | Trade secrets, IP |
| Inspection reports (incoming, in-process, final) | QC inspectors | 1000s/day | Regulatory (ISO 9001, IATF 16949) |
| Supplier audit reports | Procurement | 10s/month, 100+ pages each | Confidentiality agreements |
| Compliance documentation (REACH, RoHS, conflict minerals) | Per-SKU regulatory filings | 100s/year | Regulatory submission, audit trail |
| PPAP packages (automotive) | Per-part qualification | Bulk during product launches | Confidentiality, audit retention |
| Material Safety Data Sheets (SDS) ingestion | Every chemical input | 100s catalog, 1000s recurring | Compliance |
| Equipment manuals / O&M docs | Asset onboarding | Variable | OEM IP, license restrictions |

Incumbent: AWS Textract Forms+Tables+Queries combined at $0.055-$0.07/page. A mid-size plant processing 5000 documents/month at average 5 pages = 25k pages × $0.06 = $1500/month. A multi-plant operator pays multiples of that.

DCP pitch shape: idle workstations on the plant network process documents in a private Compute Group. Trade secrets and supplier contracts never leave the plant network. Direct Honeyvision parallel: the same idle PCs Honeyvision uses for buffer-zone CV also handle CoC parsing during off-shifts.

Privacy pressure here is harder than legal-discovery: automotive and aerospace plants have ITAR/EAR export-control documents that legally cannot leave certain network boundaries. AWS GovCloud-type compliance is the only non-on-prem option, which is even more expensive.

**Strongest single-vertical pivot of the document extraction case.** Score-equivalent to the general document case (26) and arguably higher because the manufacturing customer profile matches the case study's customer profile exactly.

### 1B. Video moderation → manufacturing safety / quality video monitoring

This is *literally* what Honeyvision does. Repackaging video moderation toward manufacturing is the same product, different framing.

Real workloads:
- PPE compliance (hard hats, safety glasses, hi-vis, hearing protection)
- Exclusion zone monitoring (the literal Honeyvision case)
- Foreign-object detection in food/pharma production lines
- Visual defect detection on assembly lines
- Ergonomic posture / repetitive-strain monitoring (insurance discount driver)
- Loading dock / forklift safety
- Automated visual inventory counts
- Process compliance (workers following SOPs)

Incumbent options:
- AWS Rekognition Custom Labels: $1/training-hour + $4/inference-hour
- Microsoft Custom Vision (the *exact* incumbent Honeyvision replaced)
- Google Vertex AI Vision custom training
- Cogniac, Landing AI, Instrumental: turnkey industrial CV at high SaaS prices ($50-500k/year)

DCP pitch: same idle factory-floor PCs the case study describes, doing the next safety/quality detection task the plant needs, all via private Compute Group.

**Critical caveat for this pivot**: it is *very* close to Honeyvision's actual product. The risk is being seen as derivative. Two ways to differentiate:

1. **Multi-plant federation**: Honeyvision is single-plant. We do federated learning across multiple plants (each plant's video stays local; only model improvements aggregate). This earns a real differentiation story tied to mode 3 in `extended-pressure-test.md`.

2. **Multi-task swiss-army worker**: Honeyvision Overwatch was buffer-zone-specific. We run a Gemma 4 E2B multimodal model that handles PPE + zones + posture + defects from one bundle (see Section 3 of this file).

### 1C. Transcription → manufacturing voice notes / radio chatter / incident audio

Real workloads:
- Maintenance technician voice notes (FieldGenius, IBM Maximo, SAP PM all support voice ingestion)
- Walkie-talkie / two-way radio transcription on plant floor (incident reconstruction, training corpora)
- Quality inspector dictated findings
- Production meeting / shift-handover transcription
- Customer support call transcription for industrial equipment
- Training video transcription for SOP indexing

Incumbents:
- AWS Transcribe Medical (yes, used for industrial too at $0.075/min for the higher-accuracy medical model)
- AWS Transcribe standard $0.024/min
- Otter.ai enterprise, Rev, Verbit (all cloud-only)

Privacy pressure: pharma plants under FDA Part 11, medical-device plants under ISO 13485, automotive under PPAP confidentiality, aerospace under ITAR. Audio is treated as records and has retention/access rules.

DCP pitch: voice-to-text runs on idle plant PCs, audio never crosses the firewall, transcripts feed directly into the existing CMMS (computerized maintenance management system).

Score equivalent to general transcription case (24). Pivot doesn't add or subtract score; it changes the customer narrative to one the CEO judge knows by heart.

### 1D. Embeddings + RAG → manufacturing technical knowledge base

The plant operator's question: *"What's the torque spec on the M12 fasteners on the Husky 660 mold? When was it last calibrated? Has anyone reported issues with this part number?"*

Today's answer: dig through engineering drawings, maintenance history in SAP, supplier docs in SharePoint, tribal knowledge from one senior tech.

Real workloads (the corpus):
- Engineering drawings and 3D model metadata
- Standard operating procedures (SOPs)
- Maintenance history (CMMS exports)
- Failure mode and effects analysis (FMEA) corpora
- Supplier qualification documents
- Equipment manuals
- Lessons-learned / 8D / corrective-action databases

Incumbents trying to sell this exact thing:
- Augury, Tulip Interfaces, IBM Maximo Visual Inspection's RAG component, Siemens Industrial Copilot, Microsoft Copilot for Manufacturing
- Most are subscription SaaS at $50-200/seat/month, sometimes per-plant licensing in the $250k-$1M/year range

Privacy pressure: the corpus *is* the company's manufacturing IP. Trade secrets, process know-how, supplier relationships. This is the most sensitive corpus a manufacturer has.

DCP pitch: Gemma 4 E2B (or a smaller embedding model + Qwen) running on idle plant PCs, indexing the local corpus, answering operator questions in a chat UI. Nothing leaves the plant network. Earns DCP + Gemma + UI/UX sponsor tracks honestly.

**Strongest combined pivot**: this case has the largest absolute SaaS replacement ($250k-$1M/year for the existing industrial-copilot vendors) and the strongest privacy story (manufacturing IP). It also stacks the most sponsor tracks.

### Manufacturing pivot rankings

| Use case | Manufacturing-pivot strength | Where it beats the general case | Where it loses |
|---|---|---|---|
| Document extraction | High | Stronger privacy (ITAR/EAR, supplier confidentiality), customer profile matches case study | None |
| Video safety/quality | Very high but derivative | Direct Honeyvision-shape, CEO recognizes instantly | Risk of "you just rebuilt Overwatch" |
| Transcription | Medium | Stronger privacy (FDA Part 11, ITAR audio) | Demo less visceral |
| RAG / technical KB | Highest | Largest absolute incumbent SaaS replacement, strongest privacy, most sponsor stacking | Highest engineering risk |

**Recommended manufacturing pivot if the team wants this angle**: hybrid of document extraction + RAG. Plant operator drops a new SOP or supplier doc into the system, it gets extracted on DCP, embedded on DCP, indexed locally, and queryable via Gemma 4 E2B running in the same private Compute Group. The whole intelligence loop happens on idle plant hardware.

This is a genuinely strong pitch. It earns DCP + Gemma + UI/UX, hits the manufacturing customer the CEO knows, and demonstrates DCP doing more than one thing.

## 2. Video moderation: the YouTube objection

The objection is honest and important. YouTube, Meta, TikTok all have multi-billion-dollar in-house moderation operations. Why would anyone replace that with a hackathon project on DCP?

The short answer: **YouTube is not the customer of content moderation APIs.** This part of the pitch was sloppy in earlier writeups and needs correcting.

### Who actually buys content moderation APIs in 2026

The third-party content moderation API market exists because most platforms cannot afford to build YouTube-scale in-house moderation. Verified leading vendors as of Apr 2026 are: AWS Rekognition, Google Cloud Vision, Azure AI Content Safety, OpenAI Moderation, Hive, Sightengine, Clarifai, TwelveLabs, API4AI.

The customer base for these vendors:

| Customer type | Scale | Why they buy from third party |
|---|---|---|
| Mid-tier social platforms (Discord, Reddit, Bluesky) | Hundreds of millions of MAU | Cannot match YouTube's moderation team budget. Hive + AWS combo common. |
| Niche social platforms (Mastodon hosts, dating apps, fan communities) | 10k to 10M MAU | Cannot afford an in-house ML team at all. Pure SaaS. |
| E-commerce / marketplaces (Etsy, Depop, Mercari, OfferUp) | Tens of millions of listings | Product photos, listing-text, reviews. AWS Rekognition + custom rules. |
| Video conferencing / telecom (Zoom, Webex, RingCentral) | Enterprise customers | Compliance review of recorded calls. Specialized vendors. |
| Kids/education platforms (Roblox, education vendors) | Regulated under COPPA, EU DSA Article 28 | Hard legal pressure. Moderation is mandatory. |
| Telehealth / regulated chat | HIPAA-covered | Specialized providers. |
| Enterprise internal video / training corpora | Big-co compliance teams | Internal training video review, policy enforcement. |
| **Manufacturing safety surveillance** | The Honeyvision case study itself | The original Honeyvision customer. |

YouTube, Meta, TikTok are *not* on this list. They are not the addressable market for any of these vendors.

### What this means for the pitch

The corrected pitch frame is one of:

1. **"YouTube's solution isn't for sale; we replace AWS Rekognition / Hive for the customers it is actually sold to."** Direct and honest.

2. **"Manufacturing video monitoring is its own market."** Pivot the customer narrative to manufacturing (Section 1B above) and the YouTube comparison disappears entirely. The case study itself was manufacturing; this is the cleanest reframe.

3. **"Regulated platforms are forced to use third-party because YouTube/Meta don't sell their internal stack."** A telehealth platform legally cannot run user video through YouTube's pipeline because YouTube isn't HIPAA-covered. The customer is forced to AWS Rekognition or specialized vendor; we replace that.

The YouTube objection actually *strengthens* the manufacturing pivot. If a judge asks "why not just use YouTube's tech," the answer "YouTube doesn't sell their tech, and even if they did, manufacturing video can't legally cross their network anyway" lands cleanly.

### Critical caveat: AWS Rekognition Custom Labels

For manufacturing-specific defect/safety detection, AWS sells Rekognition Custom Labels at $4/inference-hour. A plant running 24/7 inference on a single feed pays $35k/year per camera. This is the real-dollar incumbent the manufacturing pivot replaces, and the math is clean.

Honest scaling: Microsoft Custom Vision (the case study's actual incumbent) was discontinued and merged into Azure AI Vision in 2023. Pitch should not say "we replace Microsoft Custom Vision" without that asterisk. The successor is Azure AI Custom Vision, still alive in Azure AI Services, similar pricing model.

### Updated verdict on video moderation

The case retains its tied-for-first ranking (26) under the corrected framing. The pivot to manufacturing safety/quality video makes the pitch identical to the case study itself, which is both an asset (CEO recognition) and a risk (derivativeness). The differentiation moves are:

- Multi-plant federated learning (genuinely novel)
- Multi-task model (Gemma 4 E2B handles PPE + zones + defects from one bundle)
- Cross-modal (combine video + audio + technician voice notes in one DCP pipeline)

Without one of these differentiators, the pitch is "we rebuilt Honeyvision in 36 hours." That is fine if executed well, but it does not earn extra credit beyond competent execution of the case study itself.

## 3. Gemma 4 verified probe

Verified from Google AI for Developers, Google Open Source Blog, and the Hugging Face Gemma 4 announcement (Apr 2026).

### Family

Gemma 4 ships in four variants across three architectures:

| Variant | Architecture | Target deployment | Multimodal support |
|---|---|---|---|
| E2B | Small (~2B effective params via Per-Layer Embeddings) | Ultra-mobile, edge, browser | Text + image + **audio + video** |
| E4B | Small (~4B effective params via PLE) | Edge, browser, light server | Text + image + **audio + video** |
| 31B | Dense | Server-grade, local with strong hardware | Text + image + video (no audio) |
| 26B A4B | Mixture-of-Experts (4B active per token) | High-throughput server | Text + image + video (no audio) |

The "E" stands for "effective" parameters via Per-Layer Embeddings. The dense E2B model has more underlying parameters than 2B but PLE compresses runtime memory.

### License (this matters more than the benchmarks)

**Gemma 4 ships under standard Apache 2.0.** This is a license change from earlier Gemma versions, which used a custom "Gemma Terms of Use" with carve-outs for "harmful use" and "critical infrastructure attacks" that enterprise legal teams routinely flagged as blockers.

What Apache 2.0 means for this hackathon and any subsequent product:
- Commercial use unrestricted
- Modification, fine-tuning, redistribution all permitted
- No royalties, no MAU limits, no acceptable-use enforcement by Google
- The team can ship a product including Gemma 4 weights without legal review past the standard Apache 2.0 attribution requirement

The license change is genuinely significant and worth mentioning in the pitch deck if the project uses Gemma. It removes a real procurement blocker for any future commercialization story.

### ONNX availability

Verified: `onnx-community/gemma-4-E2B-it-ONNX` exists on Hugging Face. This is the variant we would target for DCP's V8+wasm+WebGPU sandbox. transformers.js v3+ supports running ONNX-format Gemma in browser via WebGPU.

Approximate quantized size for E2B-it ONNX (from earlier searches and prior knowledge of Gemma quantization patterns): ~1.5GB. Same bundle-size class as the Phi-3.5-mini case discussed in `pressure-test-cases-comparison.md`. Cold-start dominance is the same risk.

### The unique architectural option: E2B as multimodal swiss-army worker

The fact that E2B handles **text + image + audio + video natively** opens an architecture not available with dedicated single-task models. Instead of bundling Whisper + YOLOv8n + LayoutLM + sentence-transformers as separate models per slice, one Gemma 4 E2B bundle on each DCP worker can handle:

- Audio transcription (audio in, text out)
- Image classification / detection (image in, text out)
- Video frame analysis (video in, text out)
- Document understanding (image of page in, structured text out)
- Translation (text in, text out)
- Summarization (text in, text out)
- RAG synthesis (text + retrieved context in, text out)

Tradeoffs:

| Aspect | Dedicated models | Gemma 4 E2B multimodal |
|---|---|---|
| Bundle size | 5MB to 700MB depending on task | ~1.5GB regardless of task |
| Per-task quality | Task-tuned, generally higher (Whisper-base WER < Gemma E2B WER) | Slightly worse on specialized tasks |
| Demo versatility | One use case per slice type | Same model handles every case study workload |
| Sponsor stack story | DCP only | DCP + MLH Gemma 4 + (potentially) Theme: ML-AI |
| Engineering surface | Multiple model integrations | One model integration |
| Cold-start | Per-model on first slice | One model on first slice, reused for all task types |

For the manufacturing-pivot hybrid (Section 1D: document + RAG), Gemma 4 E2B is genuinely the right choice because:
- One model handles the document parsing (image input → structured text)
- Same model handles the embedding step (text input → vector representation, via mean-pooling intermediate hidden states or with a dedicated embedding head)
- Same model handles the synthesis step (text + retrieved context → answer)
- The bundle ships via RemoteDataPattern; subsequent slices on the same worker may benefit from browser HTTP cache (with appropriate Cache-Control headers) but DCP itself does not cache, per source verification
- All four sponsor angles (DCP + Gemma 4 + UI/UX + Theme: ML-AI) earned with one compute primitive

For pure-transcription or pure-video-moderation cases, dedicated models are still better (smaller, faster, higher quality on the specific task). Don't switch from Whisper-base to Gemma E2B unless you're building the hybrid.

### Sponsor track requirement (BearHacks-specific)

Per `CLAUDE.md` in this folder: the MLH Gemma 4 track signal is "On-device / open-weights LLM."

Running Gemma 4 E2B on DCP workers (whether public network or private Compute Group) earns this honestly:
- It is Gemma 4 (not GPT, not Claude)
- It is on-device (DCP workers, not Google's API)
- It is open-weights (Apache 2.0 ONNX checkpoint)

No additional integration work beyond actually using the model. The track is genuinely earnable.

### Risk: Gemma 4 hackathon-readiness

Gemma 4 was released in early Apr 2026 (per the Google Open Source Blog post). The ONNX variant has 81k downloads as of probe time, suggesting active community use. transformers.js v3 / v4 support is claimed. None of this is *long-soaked*. Two failure modes possible:

1. ONNX runtime web kernel coverage for Gemma 4-specific operators may be incomplete. WebGPU path may fall back to WASM unexpectedly, slowing inference.
2. Tokenizer + chat template handling for the multimodal inputs (audio/video tokenization in browser) may have rough edges.

The 4-hour spike from `idea-dcp-saas-replacement.md` should explicitly include a Gemma E2B inference pass on the chosen modality before the team commits to a Gemma-based architecture. Fallback: drop to dedicated models (Whisper + YOLOv8n + etc.), losing the sponsor double-stack but reducing risk.

## 4. Hardware reality check: Gemma on DCP

Critical engineering question: how much compute does Gemma actually require, and which DCP workers can run it.

### Gemma 4 hardware requirements (verified Apr 2026)

| Variant | Quant | Memory | CPU tok/s | WebGPU integrated tok/s | WebGPU discrete tok/s |
|---|---|---|---|---|---|
| E2B | Q4 (4-bit) | ~1.5GB | 5-10 | 20-40 | 30-60 |
| E2B | Q8 (8-bit) | ~2.5GB | ~6-10 | ~20-35 | ~30-55 |
| E2B | BF16 | ~5GB | slow | needs >8GB VRAM | OK |
| E4B | Q4 | ~5GB | 2-5 | ~15-25 | 25-40 |
| E4B | BF16 | ~15GB | unviable | unviable on most | OK on RTX 4090+ |
| 31B | Q4 | ~16GB | unviable | unviable | needs 24GB+ VRAM |
| 26B A4B (MoE) | Q4 | ~14GB | unviable | unviable | needs 16GB+ VRAM |

Floor reference: **E2B Q4 runs at 7.6 tok/s on a Raspberry Pi 5 under 1.5GB memory.** Anything more capable than a Pi 5 can run it.

### DCP worker constraints

Verified:
- DCP worker uses all detected CPU cores and GPUs by default. Heterogeneous-by-design.
- Sandbox: V8 + Dawn WebGPU + WebAssembly.
- V8 Isolate cap: pointer-compression cage limits a single Isolate to ~4GB total heap. Modern Chromium renderer process on Linux/Windows allows up to 16GB.
- Worker available as Node package (private) and Docker image (containerized) and browser (public network).

Not verified (DCP docs fetch timed out repeatedly, must verify in spike):
- Per-slice hard memory cap. Practical cap is the V8 Isolate's ~4GB.
- ~~Whether `job.requires` payloads cache across slices on the same worker, or re-ship per slice.~~ **Resolved by source probe**: `job.requires` is not a public API. Modules ship via internal supervisor postMessage; user data ships via `RemoteDataPattern` which has no DCP-layer cache. Memoization depends on browser HTTP cache + same-worker reuse, neither guaranteed.
- Worker pool composition stats (% with WebGPU, RAM distribution).

### Hardware tier analysis for the demo

| Tier | Hardware example | E2B Q4 wall-clock for 200-token output | Demo viable? |
|---|---|---|---|
| S | M-series Mac, RTX 3000+ | 4-7 sec | Yes |
| A | 2020+ laptop, Iris Xe / Radeon integrated | 10-20 sec | Yes |
| B | Older laptop, no WebGPU, WASM-only | 20-40 sec | Yes, slow |
| C | <2.5GB free RAM | slice fails | No |

Cold-start cost per worker per job:
- Weight download (1.5GB for E2B Q4): 15-90 sec network-dependent
- ORT + tensor init: 5-15 sec
- WebGPU shader compile: 3-10 sec
- **Total cold-start: 25-115 sec**

### Demo math worked out

100-document summarization (200 tokens output each):

Private Compute Group, 4 M-series team laptops (Tier S):
- Parallel cold-start: ~30 sec
- 25 slices per worker × 8 sec avg = 200 sec serial per worker
- Total: ~3.8 min wall-clock

Public network mix, 10 workers (mixed Tier S/A/B):
- Parallel cold-start: ~60-90 sec
- 10 slices per worker × 15 sec avg = 150 sec serial per worker
- Total: ~4 min wall-clock

Both demoable. Live dashboard shows fan-out happening.

### Gating risks ordered by severity

1. **Bundle ship + cold-start dominance.** Source-verified: there is no `job.requires` API and `RemoteDataPattern` has no DCP-layer cache. Every slice fetches weights from the URL unless (a) the data server sets aggressive HTTP cache headers AND (b) the same worker handles multiple slices for the job AND (c) the browser HTTP cache survives. None of these are guaranteed. Realistic expectation for 100-slice job on public network: most slices pay full 30-90 sec download. **The spike must measure whether browser cache + same-worker reuse actually memoizes in practice.**

2. **V8 heap pressure.** E2B Q4 needs ~1.5GB weights + ~500MB-1GB activation tensors and ORT = ~2-2.5GB inside the 4GB Isolate. Workable but tight. Spike measures peak heap.

3. **WebGPU availability distribution on public network.** If <30% of workers expose WebGPU, throughput drops to CPU-tier (5-10 tok/s). Demo still works, cost narrative weakens. Private Compute Group on team M-series is the safety net.

4. **Larger Gemma variants are off the table.** E4B Q4 at 5GB exceeds practical V8 envelope. 31B and 26B A4B are server-only. E2B is the only Gemma 4 we can ship to DCP workers.

### Workarounds if cold-start dominates

1. **Batch multiple input units per slice.** 10 docs per slice instead of 1. Cold-start amortizes over 10 outputs. Slices become 80-200 sec each, throughput unchanged, cold-start cost relative drops 10x.

2. ~~**Pre-warm workers.**~~ **Source-verified as unreliable.** DCP does not cache `RemoteDataPattern` payloads at the DCP layer. A pre-warming job would only succeed in cases where (a) the same workers happened to be selected for both jobs (unguaranteed without job-side Compute Group selection, which is also not implemented), AND (b) the browser HTTP cache held the weights between job runs. Replace this workaround with: run on a Private Compute Group on team hardware where weights can be pre-cached on workers' filesystems out of band, or with: serve weights with aggressive Cache-Control headers and accept that cache hit rate will be uneven.

3. **Drop to smaller model.** Qwen 2.5 0.5B Q4 is ~400MB, 3x smaller bundle, 30+ tok/s commodity. Smaller heap pressure. Loses some quality, eliminates most cold-start risk.

4. **Use Private Compute Group only.** 4 team M-series laptops + 2 cloud VMs as worker pool. Pre-cache once per worker. Cold-start happens once ever. Trade-off: pitch story weakens from public-network rhetoric to "compute we already control."

### Honest engineering verdict

**Gemma 4 E2B Q4 on DCP is viable for a 36-hour demo on a Private Compute Group with pre-cached weights. Public-network deployment is not viable as designed.**

Why public-network is blocked:
- `job.requires` does not exist as a public API (source-verified)
- `RemoteDataPattern` has no DCP-layer cache; per-slice re-fetch is default behavior
- Job-side capability requirements API is not implemented; cannot route slices to WebGPU-capable workers specifically
- Pyodide adds ~26MB constant memory baseline per sandbox

Why Private Compute Group works:
- Pre-cache weights on each worker's filesystem out of band (download once at setup, serve from localhost URL)
- All workers known to have WebGPU (we control the hardware)
- Pitch story shifts from "global distributed network" to "private compute group of trusted hardware," which is closer to the Honeyvision case study itself (factory-floor PCs)

E4B and larger Gemma variants remain non-viable in V8 sandbox at any deployment. E2B Q4 is the only ship-able variant.

**Gemma vs dedicated-model decision** rebalances based on the project shape:

- Manufacturing-RAG hybrid (multimodal swiss-army worker): Gemma 4 E2B is the right choice if cold-start spike passes.
- Single-modality case (transcription only, video moderation only, document extraction only): dedicated model wins on engineering. Whisper-base 150MB, YOLOv8n 12MB, sentence-transformers 80MB all ship 10-100x smaller bundles with proportionally smaller cold-start exposure.

The Gemma sponsor track is worth one MLH swag prize. The engineering risk of Gemma cold-start is worth weighing against that prize. For the multimodal hybrid the Gemma path is genuinely the right engineering choice; for single-task cases it is not.

## Summary recommendations

Three concrete recommendations on top of the existing pressure-test files:

1. **Manufacturing pivot is real, especially for document extraction + RAG.** The CEO judge will recognize the pattern instantly because it is his company's customer profile. The "manufacturing technical knowledge base" (Section 1D) is the strongest single pivot of any case studied. Score-equivalent to the top tier (26+) and uniquely well-aligned with the case study's customer.

2. **Video moderation pivot to manufacturing safety/quality is essentially rebuilding Overwatch.** This is fine but needs a differentiator: federated multi-plant, or multi-task via Gemma 4, or cross-modal (video + voice notes). Without a differentiator, the pitch is "we did Honeyvision in 36 hours." The YouTube objection dissolves under the manufacturing pivot, because YouTube has no manufacturing-video offering.

3. **Gemma 4 E2B is the swiss-army worker option.** Apache 2.0, multimodal (text+image+audio+video for E2B specifically), ONNX-available, runs in the V8+wasm+WebGPU sandbox. Same bundle-size class as Phi-3.5-mini, so same cold-start risks. Use it when the architecture genuinely needs multimodality (the document+RAG hybrid). Do not use it when a dedicated model is task-better (transcription-only, image-classification-only).

The strongest single pitch shape after this round of analysis: **manufacturing technical knowledge base, Gemma 4 E2B running on DCP private Compute Group across plant workstations, document+RAG hybrid pipeline, pitched as the natural extension of the Honeyvision/Overwatch pattern from physical-floor surveillance to plant-wide intelligence.**

## Sources

Gemma 4 license and architecture:
- Google Open Source Blog announcement: https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html
- Google AI for Developers Gemma 4 overview: https://ai.google.dev/gemma/docs/core
- Hugging Face Gemma 4 announcement: https://huggingface.co/blog/gemma4
- Gemma 4 E2B ONNX checkpoint: https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX
- VentureBeat license analysis: https://venturebeat.com/technology/google-releases-gemma-4-under-apache-2-0-and-that-license-change-may-matter

Content moderation customer landscape:
- Best AI Content Moderation APIs 2026 (vendor list): https://wavespeed.ai/blog/posts/best-ai-content-moderation-apis-tools-2026/
- Best Image Moderation APIs 2026: https://www.edenai.co/post/best-image-moderation-apis
- Hive customer profile: https://thehive.ai/

AWS Rekognition Custom Labels (manufacturing pricing):
- AWS Rekognition pricing: https://aws.amazon.com/rekognition/pricing/

Manufacturing context (Honeyvision case study):
- See `Case Study Distributive.md` in this folder
- NGen Canada original case capture
