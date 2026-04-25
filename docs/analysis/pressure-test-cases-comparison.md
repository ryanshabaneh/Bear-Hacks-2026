---
type: project-analysis
project: Tessera
context: hackathon
tier: 0
status: decision-input
created: 2026-04-25
updated: 2026-04-25
related:
  - "[[idea-dcp-saas-replacement]]"
  - "[[Case Study Distributive]]"
  - "[[ideas]]"
  - "[[CLAUDE]]"
tags:
  - tessera
  - dcp
  - distributive
  - pressure-test
  - decision
---

# DCP-replaces-SaaS: pressure-test of all candidate cases

Five candidate workloads pressure-tested against Honeyvision-shape filter, against current-2026 incumbent pricing (verified from official sources), and against the actual DCP V8 + Dawn WebGPU + WebAssembly sandbox constraints. Each case scored on six dimensions with a final ranking.

The transcription case (already captured separately at `idea-dcp-saas-replacement.md`) is reproduced here in summary form for comparison.

## The Honeyvision filter (recap)

A candidate must satisfy all four:

1. Real recurring compute workload (not one-time ingest)
2. Specific incumbent SaaS with public list-price
3. Embarrassingly parallel (per-unit fan-out)
4. Bundle-size and runtime fit inside V8 + Dawn WebGPU + WebAssembly sandbox

Bonus: privacy or compliance pressure that makes "stay on-prem" not just cheaper but required. This is what made Honeyvision's pitch land with manufacturers.

## Scoring rubric

Each case scored 1 to 5 on:

| Dimension | What gets a 5 |
|---|---|
| Cost-savings narrative | Absolute dollar saving is large enough to motivate enterprise procurement, against an incumbent the customer is *forced* to use |
| Privacy / compliance pressure | Customer cannot legally use cloud incumbent. DCP is the only viable path. |
| Engineering risk (inverted: 5 = lowest risk) | Bundle under 100MB, sandbox fit known, cold-start under 5s |
| Demo viability in 36hr | Visual demo, judges grok it in 30 sec, end-to-end runnable on team laptops |
| Sponsor-stack stacking | Earns multiple sponsor tracks honestly with same compute primitive |
| Honeyvision-shape parallel | Pitch story has a 1:1 analog to the case study (manufacturer to X) |

Maximum score: 30.

---

## Case 0: Transcription (baseline reference)

Replaced incumbent: AWS Transcribe Medical at $0.075/min, Azure Speech at $0.017/min, both HIPAA-eligible by default. (OpenAI Whisper at $0.006/min disqualified as the *target* incumbent because it requires custom BAA + zero-retention setup, not the turnkey path enterprise procurement actually takes.)

Stack:
- Whisper-base.en quantized ONNX, ~150MB
- transformers.js + ONNX Runtime Web on V8 + WebGPU
- LibriSpeech `test-clean` for ground-truth WER comparison

Savings math (100 min audio): AWS Transcribe Medical $7.50 vs DCP ~$0.0002 = ~45,000x multiplier. Scales linearly: 200 doctors × 4hr/day × $0.075/min ≈ $108k/year on AWS, ≈ $50/year on DCP.

Honeyvision parallel: Honeyvision replaced Microsoft Custom Vision; we replace Microsoft Azure Speech. Same vendor, different cognitive service.

| Dimension | Score | Note |
|---|---|---|
| Cost narrative | 4 | Strong absolute savings against medical/legal incumbent. Weak against OpenAI baseline (must pick framing carefully). |
| Privacy pressure | 5 | HIPAA, attorney-client privilege, journalist source protection are real legal pressures. |
| Engineering risk | 3 | 150MB bundle is on the larger side. Cold-start needs measurement. WebGPU optional. |
| Demo viability | 4 | Audio-in / text-out is universal. Live cost ticker is visceral. |
| Sponsor-stack | 3 | DCP + UI/UX + Theme: Design + potentially Theme: ML-AI. No double-sponsor stacking. |
| Honeyvision parallel | 5 | Direct Microsoft-to-Microsoft analog. Privacy + cost both load-bearing. |
| **Total** | **24** | |

---

## Case 1: Document extraction (Textract / Document AI / Form Recognizer)

Replaced incumbents (verified Apr 2026):

| Provider | Service | Rate | HIPAA-eligible? |
|---|---|---|---|
| AWS | Textract Detect Document Text (basic OCR) | $0.0015/page | Yes |
| AWS | Textract Analyze Forms | $0.05/page | Yes |
| AWS | Textract Analyze Tables | $0.015/page | Yes |
| AWS | Textract Analyze Queries | $0.015/page | Yes |
| AWS | Textract Analyze Lending | $0.07/page | Yes |
| AWS | Textract combined (Forms + Tables + Queries) | $0.055 to $0.07/page | Yes |
| Google | Document AI Enterprise OCR | $1.50 per 1000 pages | Yes |
| Google | Document AI Form Parser | $30 per 1000 pages | Yes |
| Google | Document AI Layout Parser | $10 per 1000 pages | Yes |
| Google | Document AI Custom Extractor | $30 per 1000 pages | Yes |

Stack on DCP:
- Tesseract.js / tesseract-wasm, ~5MB, pure WASM port. Mature. Runs cleanly in any V8 + WASM sandbox.
- For form/table understanding: Donut-small (~300MB) or LayoutLMv3-base (~134MB). Donut is officially supported by transformers.js. LayoutLMv3 status in transformers.js is uncertain (the standard `transformers` library has it; transformers.js port unclear). Tesseract+heuristics path avoids the dependency.

Bundle reality: tesseract-only path is ~5MB, smallest of any non-trivial case. With Donut-small, ~300MB. Both within DCP `requires` envelope.

Savings math:

100-page demo, lending document workflow:
- AWS Textract Lending: $7.00
- Google Document AI Form Parser: $3.00
- DCP cost: ~$0.0002 (Tesseract WASM is fast, ~1 page/sec on commodity CPU)
- Multiplier: 15,000x to 35,000x

1000-page legal discovery batch (real-world enterprise scale):
- AWS Textract combined: $55 to $70
- Google Document AI Form Parser: $30
- DCP cost: ~$0.002
- Absolute saving: $30 to $70 per batch. Scales fast in legal-discovery contexts where firms process millions of pages.

Honeyvision parallel: Law firm processing 10M pages of discovery cannot send to cloud (attorney-client privilege, work-product doctrine). Uses idle paralegal workstations via private DCP Compute Group. Same exact pattern as factory-floor PCs running buffer-zone detection.

Privacy/compliance angle: legal discovery, medical records, audit working papers, tax returns. All have hard legal pressure against cloud egress. Stronger compliance pressure than transcription because attorney-client privilege has been case-law-litigated against cloud transmission, where transcription's HIPAA story is more procedural.

Engineering risks:
- Form/table extraction quality with Tesseract + heuristics is mid vs AWS Textract Forms ($0.05/page). Honest delta needs to be acknowledged in pitch.
- For high-fidelity extraction, Donut or LayoutLMv3-class models needed, which means 134-300MB bundle.
- Per-page latency on CPU: Tesseract is ~1-3 sec/page on commodity CPU; embarrassingly parallel solves throughput.

Demo path: drop a 100-page court filing into upload box; watch per-page slices fan out across DCP workers; structured JSON returned. Live cost calculator showing AWS Textract list-price vs actual DCP credits consumed.

| Dimension | Score | Note |
|---|---|---|
| Cost narrative | 5 | Highest per-unit incumbent rate ($0.07/page lending; $0.075/page Textract Forms+Tables+Queries combined). Enterprise-scale absolute savings substantial. |
| Privacy pressure | 5 | Attorney-client privilege, work-product doctrine, HIPAA. Legally enforceable. |
| Engineering risk | 4 | Tesseract WASM is mature and tiny (~5MB). LayoutLM/Donut path is heavier but optional. |
| Demo viability | 5 | Visual: see the page parse, structure render. Universally legible to judges. |
| Sponsor-stack | 3 | DCP + UI/UX + Theme: Design. No double-sponsor stacking. |
| Honeyvision parallel | 4 | Strong (law firm = factory floor, paralegals = on-prem PCs). Slightly less direct than Azure Speech analog. |
| **Total** | **26** | |

---

## Case 2: Video moderation (Rekognition / Hive / Google SafeSearch)

Replaced incumbents (verified Apr 2026):

| Provider | Service | Rate |
|---|---|---|
| AWS | Rekognition image moderation | $0.001/image (first 1M), $0.0008/image after |
| AWS | Rekognition stored video moderation | $0.10/min |
| AWS | Rekognition streaming video events | $0.00817/min |
| AWS | Custom Moderation inference | $0.0012/image |
| Google | Cloud Vision SafeSearch | $1.50 per 1000 images |
| Hive | Content moderation | Custom enterprise (opaque) |

Stack on DCP:
- YOLOv8n: 6-12MB ONNX, smallest viable production object detector. ONNX Runtime Web with WebGPU supported. Multiple browser demos including live webcam detection.
- NSFWjs: tens of MB, dedicated NSFW classifier
- CLIP-base for zero-shot classification: ~340MB if more flexibility needed
- For pose/violence detection: YOLOv8n-pose at similar size

Bundle reality: smallest of any case. Per-frame slice is genuinely cheap.

Savings math:

30-minute video at 1fps sampling = 1800 frames:
- AWS Rekognition image moderation: $1.80
- AWS Rekognition stored video moderation: $3.00
- Google Vision SafeSearch: $2.70
- DCP cost: <$0.001
- Multiplier: 1,800x to 3,000x

24-hour platform livestream (real-world scale, 1fps): 86,400 frames:
- AWS Rekognition image moderation: $86.40
- DCP: ~$0.005
- Per-month for one always-on stream: ~$2,600 AWS vs ~$0.15 DCP

Honeyvision parallel: literally identical to the case study. Honeyvision = video monitoring of factory floor for safety violations, alerting human supervisors. This case = video monitoring of platform content for moderation violations, alerting human moderators. The CEO judge will recognize the pattern instantly. The naming "Overwatch" could be reused with no change.

Privacy/compliance angle: weaker than transcription/documents. Most user-generated-content platforms have already accepted cloud moderation as a norm. The pressure exists for: small/niche platforms that don't want to share user data with a moderation vendor that also competes (e.g. Discord-clones avoiding sending content to a Hive that also serves their competitors); regulated platforms (financial chat, medical telehealth) where user content has compliance constraints.

Engineering risks: lowest of any case. YOLOv8n is mature, runs well in WASM-only fallback, ONNX Runtime Web has multiple production browser deployments.

Demo path: live video feed (or pre-recorded short loop) with moderation overlays rendering in real time. Judge sees buffer-zone-style violations being detected frame-by-frame. The visual is dramatic and the parallel to the case study is unmistakable.

| Dimension | Score | Note |
|---|---|---|
| Cost narrative | 4 | Strong absolute savings at always-on streaming scale. Per-frame rates are low so demo-input savings are small in dollar terms. |
| Privacy pressure | 3 | Real but softer than HIPAA/attorney-client. Niche platforms only. |
| Engineering risk | 5 | Smallest bundles, mature tooling, lowest cold-start cost. |
| Demo viability | 5 | Visually dramatic. Live overlays. Codename reuse opportunity. |
| Sponsor-stack | 4 | DCP + UI/UX + Theme: Design + Most Fun (visual mechanic) + potentially Theme: ML-AI. Strongest stacking among single-track candidates. |
| Honeyvision parallel | 5 | Literal 1:1 shape match. CEO judge cannot miss it. |
| **Total** | **26** | |

---

## Case 3: LLM batch inference (OpenAI / Claude batch, Gemma 4 + DCP stack)

Replaced incumbents (verified Apr 2026):

| Provider | Service | Rate |
|---|---|---|
| OpenAI | gpt-4o-mini batch | ~$0.075 input / $0.30 output per M tokens (50% off real-time) |
| OpenAI | gpt-4o batch | higher (real-time $2.50/$10 per M tokens, batch 50% off) |
| Anthropic | Claude Haiku 4.5 batch | $0.50 input / $2.50 output per M tokens |
| Anthropic | Claude Sonnet 4.6 batch | $1.50 input / $7.50 output per M tokens |

Stack on DCP:
- Gemma 4 E2B quantized ONNX: ~1.5GB
- Gemma 4 E4B: larger (~3GB)
- Phi-3.5-mini ONNX: ~2-4GB
- Qwen 3.5 0.8B: ~500MB-1GB
- Performance reality: Phi-3.5-mini runs at 71 tok/s on M3 Max with WebGPU, drops to 10-30 tok/s on commodity laptop hardware. Qwen-class smaller models proportionally faster.

Bundle reality: this is the gating risk. 1.5GB+ is well outside what `job.requires` typically ships cleanly. Must use `RemoteDataPattern` to serve weights from CORS-enabled bucket, with worker-side caching on first slice. Cold-start per worker = 30 to 90 seconds for first download.

Savings math:

100 enterprise documents × 500 input tokens × 200 output tokens each:
- OpenAI gpt-4o-mini batch: $0.0375 + $0.006 = ~$0.04
- Claude Haiku batch: $0.025 + $0.04 = ~$0.07
- DCP cost: ~$0.001
- Multiplier: 40x to 70x but absolute dollars trivial

1M documents/month (enterprise scale):
- OpenAI gpt-4o-mini batch: ~$400/month
- DCP: ~$10/month
- Absolute saving: $390/month per workflow. Scales with workflow count.

Honeyvision parallel: corporate legal department needs to summarize / classify / extract from internal contracts. Cannot send to OpenAI (vendor risk, IP exposure, compliance). Runs Gemma 4 on idle workstations via DCP. Direct shape match to factory-floor PCs running CV.

Privacy/compliance angle: HIGH for regulated industries (healthcare summarization, legal contract review, financial document analysis, internal HR). OpenAI and Anthropic both *can* sign BAAs but it requires explicit setup; many enterprises have policies blocking generative-AI vendor send-out entirely. DCP + open-weights = airgap-eligible.

**Sponsor stack stacking (the unique upside)**: this is the only case that earns *MLH Gemma 4 + DCP + UI/UX* honestly. Two sponsor tracks for the same compute primitive. The Gemma 4 sponsor track is otherwise hard to earn legitimately without exactly this kind of "open-weights LLM doing real work" demo.

Engineering risks (highest of any viable case):
- Bundle size 1.5 to 4GB is the real gate. Worker cooperation matters: if a worker leaves mid-job, model re-downloads on the next worker.
- Cold-start dominance is severe. Single-slice latency is roughly: weight download (30-90s) + model warmup (5-10s) + actual inference (2-10s for 200 output tokens). Parallelism gain only kicks in once each worker has cached the model.
- Output quality of small models on enterprise tasks is mid vs gpt-4-class. WER-equivalent here is not as universally accepted as transcription WER. The judge can see a noticeably worse summary.
- Tokenizer + chat template handling for Gemma in browser is non-trivial.

Demo path: drop folder of internal docs, watch fan-out across workers, accumulated cost ticker. Less visually exciting than video moderation, more domain-abstract than document extraction.

| Dimension | Score | Note |
|---|---|---|
| Cost narrative | 3 | Multiplier is fine but absolute dollars on demo-scale input are tiny. Enterprise-scale narrative requires hand-waving "imagine 1M docs/month." |
| Privacy pressure | 5 | Strongest case: many enterprises hard-block generative-AI vendor send-out. |
| Engineering risk | 2 | Bundle size, cold-start, output-quality delta all major. |
| Demo viability | 3 | Functional but not visceral. Hard to make a 30-second hook. |
| Sponsor-stack | 5 | Unique double-stacking: Gemma 4 + DCP + UI/UX. |
| Honeyvision parallel | 4 | Strong (corporate dept = factory; idle workstations = idle PCs). Slightly more abstract than CV cases. |
| **Total** | **22** | |

---

## Case 4: Genomic variant calling (Illumina BaseSpace / DNAnexus)

Replaced incumbents:
- Illumina BaseSpace: iCredit-based, opaque per-sample pricing. Storage 22.5 iCredits/TB/month. Compute apps priced per app, requires login to view.
- DNAnexus: enterprise contract pricing.
- Estimated per-sample for whole-genome variant calling: $200 to $2,000 depending on workflow and depth.

Toolchain:
- BWA (Burrows-Wheeler Aligner): C, native binary
- GATK: Java, native JVM
- DeepVariant: Python + TensorFlow, native binary
- Samtools, bcftools, etc.: all C native

**Sandbox fit: blocked.** None of these tools have WASM ports. The standard variant-calling stack does not run in V8 + Dawn WebGPU + WebAssembly. Even DeepVariant's TF model is shipped as a native TF runtime, not ONNX-Runtime-Web compatible.

Workarounds (all bad):
- DCP Native executor (Linux container worker) does exist, but it is for trusted compute groups, not the public network. Using it would mean running our own VMs as workers, which weakens the "real distributed compute via DCP public network" pitch to the CEO judge.
- Ship a wasm-compiled subset (e.g. minimap2 has experimental wasm builds) and skip variant calling. Loses the headline workload.
- Pivot to lighter-weight bioinformatics: VCF annotation, microbiome alpha/beta diversity, genomic sequence embeddings. All are domain-niche and lose the "we replace expensive incumbent" story.

Additional disqualifiers:
- Input file sizes: FASTQ files are 10-100GB per sample. Shipping as slice input is impractical even via RemoteDataPattern.
- Demo viability: judges cannot grok variant calling in 90 seconds. The visual is a VCF file, which is text.
- Pricing opacity: Illumina iCredits do not give a clean public list-price for the cost-comparison slide.

| Dimension | Score | Note |
|---|---|---|
| Cost narrative | 1 | Pricing opaque, hard to cite a clean list-price baseline. |
| Privacy pressure | 5 | PHI / patient genome is the strongest privacy case in healthcare. |
| Engineering risk | 1 | Toolchain blocked at sandbox layer. |
| Demo viability | 1 | Domain too specialized for hackathon. Visual is text. |
| Sponsor-stack | 2 | DCP + Theme: ML-AI weak. No clean Google Vision angle. |
| Honeyvision parallel | 4 | Conceptually clean (hospital lab = factory) but no actual technical path to demonstrate. |
| **Total** | **14** | |

Verdict: drop. Drop entirely. Even the pivots within the domain do not save this case.

---

## Scoring matrix (sorted)

| Rank | Case | Cost | Privacy | Eng-risk | Demo | Sponsor | Honeyvision | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | Document extraction | 5 | 5 | 4 | 5 | 3 | 4 | **26** |
| 1 | Video moderation | 4 | 3 | 5 | 5 | 4 | 5 | **26** |
| 3 | Transcription | 4 | 5 | 3 | 4 | 3 | 5 | **24** |
| 4 | LLM batch (Gemma + DCP) | 3 | 5 | 2 | 3 | 5 | 4 | **22** |
| 5 | Genomic variant calling | 1 | 5 | 1 | 1 | 2 | 4 | **14** |

## Reading the matrix

Three cases score 24+ and are viable. They split clean:

- **Document extraction (26)**: highest absolute-dollar incumbent rates, strongest legal-compliance pressure, solid demo, smallest bundle option (Tesseract).
- **Video moderation (26)**: smallest engineering risk, most visually dramatic demo, literal 1:1 case-study parallel, weaker privacy story.
- **Transcription (24)**: strongest Microsoft-vendor parallel, strongest privacy story, slightly heavier bundle, demo is auditory not visual.

LLM batch (22) is interesting only for the unique Gemma 4 + DCP sponsor double-stacking. The engineering risk and demo viability are real drawbacks. If sponsor stacking weren't a factor it would not justify the engineering exposure in 36 hours.

Genomic (14) is dead.

## Decision recommendation

Three viable shapes. Each implies a different team conversation:

**If the team's strongest skill is frontend / visual demos** -> Video moderation. Lowest engineering risk, smallest bundle, most striking demo, literal Honeyvision parallel. Codename "Overwatch" reuse is a deliberate rhetorical move at the CEO judge. Risk: privacy pressure is softer and the absolute-dollar saving on demo-scale input is small (must scale narrative carefully).

**If the team's strongest skill is backend / data pipeline** -> Document extraction. Highest absolute incumbent rates, strongest enterprise-procurement pitch, hardest legal-compliance pressure (attorney-client privilege has actual case law against cloud egress, stronger than HIPAA's procedural pressure). Tesseract baseline path is technically conservative.

**If the team's strongest skill is ML / accuracy work and one teammate genuinely owns the WER eval pipeline** -> Transcription. Strongest Microsoft-to-Microsoft pitch (Honeyvision replaced Microsoft Custom Vision; we replace Microsoft Azure Speech), strongest legally-enforceable privacy story (HIPAA, attorney-client, journalist source protection). Requires the WER comparison to be honest and live.

**Hybrid play (highest ceiling, highest risk)**: build the document-extraction case as the demo, but also wire in a Gemma-4-on-DCP path for *one* extracted document type (e.g. structured contract summarization on top of extracted text). This honestly earns the Gemma 4 + DCP sponsor double-stack on top of the document-extraction primary pitch. Risk: more surface to maintain in 36 hours, more cold-start exposure, more places for the demo to fall over.

## Pre-commit gates (any case)

Before team commits to *any* of these, the same 4-hour spike from `idea-dcp-saas-replacement.md` applies, retargeted to the chosen case:

1. Single coordinator, single DCP slice, single input unit (page / frame / audio chunk / document).
2. Measure: bundle ship time, model cold-start, slice wall-clock, ResultHandle credit metadata.
3. Pass gate: cold-start under 15s, end-to-end under 20s for the single-unit slice.

If gate fails on the chosen case, fall back along this priority order: video moderation > document extraction (Tesseract path) > transcription. LLM batch and genomic do not enter the fallback chain.

## What this analysis does *not* answer

Three open questions remain that the team must answer with judgment, not pressure-test:

1. **Bundle ship time on DCP public network during hackathon weekend.** Marketing materials and docs do not commit to a `requires` payload limit. Has to be measured in the spike.
2. **Worker pool size and WebGPU availability mix on hackathon weekend.** If public pool is sparse, all cases fall back to a private Compute Group on team hardware, which weakens the "real distributed" rhetoric to the CEO judge.
3. **Team composition and skill split.** This file's recommendation depends on the team's strongest skill. That is in `team-canvas.md`, currently undocumented.

## Sources

DCP (verified):
- DCP runtime architecture (V8 + Dawn WebGPU + WebAssembly): https://distributive.network/docs/security-worker.html
- DCP SDK getting started (compute.for / job.exec): https://docs.dcp.dev/intro/getting-started.html
- DCP job.requires pattern (mandelbrot tutorial): https://docs.dcp.dev/tutorials/node/mandelbrot.html
- DCP RemoteDataPattern (large/binary slice inputs): https://docs.dcp.dev/advanced/data-uri.html
- DCP compute economics (credit pricing): https://distributive.network/docs/compute-economics.html

Cloud incumbents (verified Apr 2026):
- AWS Transcribe pricing: https://aws.amazon.com/transcribe/pricing/
- AWS Textract pricing: https://aws.amazon.com/textract/pricing/
- AWS Rekognition pricing: https://aws.amazon.com/rekognition/pricing/
- Google Document AI pricing: https://cloud.google.com/document-ai/pricing
- Google Cloud Vision pricing: https://cloud.google.com/vision/pricing
- Azure Speech pricing: https://azure.microsoft.com/en-us/pricing/details/speech/
- OpenAI API pricing: https://openai.com/api/pricing/
- Anthropic Claude API pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI HIPAA BAA: https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai

Open-weights model viability:
- Transformers.js v3 / v4 (WebGPU support): https://huggingface.co/blog/transformersjs-v3
- Transformers.js GitHub: https://github.com/huggingface/transformers.js/
- Tesseract.js (pure WASM OCR): https://tesseract.projectnaptha.com/
- Donut model (transformers.js supported): referenced via transformers.js docs
- Gemma 4 ONNX checkpoints: https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX
- Phi-3-mini ONNX web: https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx-web
- ONNX Runtime Web YOLOv8 demos: https://github.com/nomi30701/yolo-object-detection-onnxruntime-web

Genomics (for completeness, blocked path):
- BWA: https://bio-bwa.sourceforge.net/
- DeepVariant: https://github.com/google/deepvariant
- Illumina iCredits: https://www.illumina.com/products/by-type/informatics-products/icredits.html

Case study (NGen Canada):
- Honeyvision Overwatch case study: see `Case Study Distributive.md` in this folder

---

## Post-probe addendum (added 2026-04-25 after SDK source verification)

After cloning the DCP SDK source (`~/dcp-sdks/dcp-client`, `dcp-worker`, `use-dcp-worker`) and running a 3-agent deep probe, three findings adjust the scoring above. See `sdk-probe-deep.md` and `sdk-probe-shallow.md` for full detail.

### Engineering risk dimension: revised downward for cases shipping >100MB models

Source verification established:
- `job.requires` is NOT a public API. Modules ship via internal supervisor postMessage; users have only `RemoteDataPattern` for shipping data.
- `RemoteDataPattern` has no DCP-layer cache. Per-slice re-fetch is default behavior.
- Job-side capability requirements API (`requires: { webgpu: true }`) is not implemented.

Adjusted engineering-risk scores (negative = riskier than originally scored):

| Case | Original eng-risk | Revised | Why |
|---|---|---|---|
| Document extraction (Tesseract path, ~5MB) | 4 | 4 | unchanged; bundle small enough that re-fetch per slice is acceptable |
| Document extraction (LayoutLMv3 path, ~134MB) | 4 | 3 | shifts to LayoutLM only if Tesseract path fails; the 134MB re-fetch becomes meaningful |
| Video moderation (YOLOv8n, ~12MB) | 5 | 5 | unchanged; smallest bundle, lowest risk confirmed |
| Transcription (Whisper-base, ~150MB) | 3 | 2 | moderate risk added: 150MB per-slice re-fetch unless browser HTTP cache + same-worker reuse memoizes |
| LLM batch / Gemma E2B Q4 (1.5GB) | 2 | 1 | cold-start + no cache + no capability filtering = public network not viable; only Private Compute Group works |
| Genomic variant calling | 1 | 1 | unchanged; was already blocked at sandbox layer |

### Cost narrative dimension: caveat applies to all cases

Source verification confirms `marketRate` and `marketValue` are placeholder constants. No metering backend in the source. Worker minimum wage defaults to 0. README:171 caveat ("MVP release will include an implementation of the costing and metering algorithms") was current 7 months ago and has not been updated.

Implication: every case's cost-narrative claim must be reframed as "based on Distributive's published reference rate of $0.0005/CPU-hour, the savings vs cloud incumbent would be $X" rather than "we measured $Y in DCP credits." This does not change relative scoring across cases (every case is affected equally), but it weakens the absolute strength of the cost pitch for all of them.

Recommendation: pivot every case's pitch to lead with **privacy / sovereignty / parallelism**, with cost as supporting evidence under explicit caveat. The Honeyvision case study itself leads with both cost and privacy; we should match that framing while being honest that our cost numbers are reference-rate estimates, not metered measurements.

### Top three retain their ranking

After revisions, the top three cases by total score are unchanged in order:

1. Video moderation (26 → 26): unaffected by SDK findings, smallest bundle, lowest engineering risk confirmed by source
2. Document extraction (26 → 25 if LayoutLM, 26 if Tesseract-only): minor downgrade in LayoutLM variant
3. Transcription (24 → 23): one-point downgrade for the Whisper-base 150MB bundle re-fetch risk

Gemma-LLM hybrid drops from 22 to ~19 (engineering risk floor + sponsor-stack value still real but achievable only via Private Compute Group, not public network).

### Updated commit recommendation

Pre-commit checklist for the team, given source-verified findings:

1. **Pick a top-three case** (video moderation / document extraction / transcription). Avoid Gemma-as-primary unless the team accepts Private Compute Group only.
2. **Plan to run on a Private Compute Group of team hardware**, not the public DCP network. Reasons: no job-side capability filtering, no DCP-layer caching, pricing in placeholder mode. Public network demo would have unpredictable outcomes.
3. **Pitch privacy/parallelism, not cost.** Cost numbers are valid only as references against Distributive's published rate, not as measured metering.
4. **The 4-hour spike question revised**: not "does `job.requires` cache" (the API doesn't exist), but "does RemoteDataPattern + Cache-Control + same-worker reuse actually memoize the model in practice?"
5. **Six questions to ask the Distributive CEO at the event** (see `sdk-probe-deep.md` end). Their answers could change item 2 above.
