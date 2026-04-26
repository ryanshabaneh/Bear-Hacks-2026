# Demo Script (5 minutes)

## Terminology reminder

Use atmospheric nouns for user-facing narration, technical primitives for the Q&A architecture beat:

- **Client** = Maya (the podcaster submitting the Forecast)
- **Distributor** = the indie ML-blog owner whose dashboard you flip to
- **Node** = the visitor browser running the embed (no account, no PII)
- **Forecast** = the job spec (e.g., "transcribe these 4 podcast episodes to SRT")
- **Front** = the dispatch event when the Forecast opens
- **Rain** = audio chunks landing on Nodes for transcription
- **Catchment** = the assembled timestamp-ordered output bundle (SRT + VTT + JSON + plain)

Do not say "worker" or "user" — say **Node**. Do not say "job" on stage — say **Forecast**.

## Pre-stage checklist (before judges arrive)

- [ ] **6 team browser tabs** opened to `demo-site/` with the Strata embed loaded and the Whisper-WebGPU bundle warm (cached after first chunk; force a primer chunk during pre-stage)
- [ ] **Strata-hosted worker bundle URL** pinned to a versioned path (Option B, e.g., `https://cdn.strata.app/runtime/whisper-work-v1.js`). No `@latest`. Confirm bundle SHA matches the deployed manifest.
- [ ] **DCP submit worker** running on Vultr (or via ngrok from a stable laptop): `node dcp-submit-worker/src/index.js`. Watch for `Front opened` log line.
- [ ] **Next.js app** deployed to Vercel preview URL with the locked stack (Next 16.2.4, React 19.2.4, `@auth0/nextjs-auth0` 4.19, Prisma 6.19.3). `AUTH_MODE=auth0` if BE2's Auth0 work is green; otherwise `AUTH_MODE=stub`.
- [ ] **Client account** "Maya" pre-logged-in on presenter laptop — first browser tab, on the Forecast Composer.
- [ ] **Distributor account** "Indie ML Blog" pre-logged-in — second browser tab, on the earnings dashboard with SliceTicker visible.
- [ ] **Audio fixture** loaded: total **30 to 60 minutes** of audio (locked range — fits a 5-minute live run with the Catchment sealing on stage). Recommended shape: 3-4 short clips of ~10 min each, or one ~30-min episode. Ground-truth SRT preloaded for the post-demo accuracy panel.
- [ ] **Counterfactual cost panel** seeded with current Rev / Rev AI / OpenAI Whisper API / AssemblyAI rates so the comparison populates immediately when the Front opens.
- [ ] **SSE connection green** — Network tab shows `/api/forecasts/.../stream` returning 200 with `text/event-stream`.
- [ ] **DCP keystore balance** ≥ 100 DCC (re-check, hackathon judges may have run other things).
- [ ] **Pre-baked Catchment** loaded as the safety-net fallback. If the live Front stalls past 90s, swap to the recorded Catchment scrub-through video on a second laptop.
- [ ] **Motion-sensitivity check**: confirm `prefers-reduced-motion` path is wired so the CycleBudgetMeter and Rain visualization don't strobe. Toggle on a backup laptop to verify the static fallback before the booth opens.
- [ ] **Capability ceiling sanity**: Maya's account is Provisional (100 audio-hours/month); demo workload is well under, so no tier-promotion banner mid-demo.

## Live demo order

### Step 1 — Maya composes a Forecast (60s)

Open Client tab. Already on the Forecast Composer. Empty state.

> *"Maya runs a podcast network. Four new episodes dropped this week, about forty audio-hours a month. She needs SRT captions for accessibility and YouTube republishing. Rev human-grade is ninety dollars an audio-hour. Rev AI is a buck-twenty. OpenAI's Whisper API is thirty-six cents. AssemblyAI's batch tier is twelve cents. Watch the Composer."*

Click **New Forecast**. Type in the plain-English box (or pre-fill if nervous):
> "Transcribe these four podcast episodes to SRT, English, no diarization."

Drag the audio files into the upload zone. Wait for them to register (file sizes shown, total audio-hours auto-computed).

Click **Translate →**. Gemma 4 1B (running locally) emits a Forecast spec on screen:
```json
{
  "kind": "transcription",
  "language": "en",
  "outputs": ["srt", "vtt", "json"],
  "chunkSeconds": 30,
  "redundancy": 2,
  "oracleSpotCheck": 0.02
}
```

> *"That's a Gemma 4 1B model running in this browser, translating Maya's plain English into a structured Forecast spec. Pinned chunk size, k=2 redundancy, two-percent oracle spot-check. She didn't write any of that — Gemma did."*

(Pause 2s on the JSON.)

Click **Open Front**. Confirmation panel shows: *"60 Rain chunks · 2x redundancy = 120 cycles · Est. $0.020 · Est. ETA 3-5 min"*.

> *"Front's open. Sixty thirty-second audio chunks, dispatched twice each for redundancy. Total estimated cost: two cents. That's four cents an audio-hour. Three times cheaper than AssemblyAI batch, thirteen times cheaper than the OpenAI Whisper API, two thousand times cheaper than human Rev."*

### Step 2 — Switch to the Distributor dashboard (45s)

Click second tab: Distributor dashboard for "Indie ML Blog".

> *"Meanwhile, somebody on the internet just opened an indie ML blog. They loaded the page — one script tag in the HTML, that's all the blog owner did. No ads. No tracking cookies."*

Watch the SliceTicker tick: *Rain landed (chunk 0:00-0:30) · +$0.0001 · Rain landed (chunk 0:30-1:00) · +$0.0001…*

> *"Every Rain chunk a visitor's browser completes earns the Distributor revenue share. Sixty-eight percent to the Distributor, thirty-two percent Strata margin. Paid out via Stripe Connect."*

Point at the active-Nodes count and the RPM-comparison panel (the panel that always shows the Distributor's ad-RPM next to Strata's estimated-RPM, even when Strata's worse).

> *"Six Nodes are contributing right now. None of them signed up. They just loaded an ML blog. The dashboard mirrors AdSense on purpose — RPM, fill rate, payout threshold. Same shape, different supply side: compute instead of attention."*

### Step 3 — Switch back to Client, watch the Catchment fill (90s)

Return to Client tab. Forecast Detail page. The Catchment is filling **column-by-column in timestamp order**, not arrival order.

> *"This is the Catchment. SRT segments are slotting in by timestamp, not by which Node finished first. Out-of-order arrivals get held in a buffer until the timestamp gap closes. CycleBudgetMeter is ticking down — that's the barometric gauge, millibars on the surface, dollars on hover."*

Let it run for 30-45s. Point at the counterfactual cost panel, which is ticking up against Rev AI / OpenAI Whisper API / AssemblyAI in parallel.

> *"Right now Maya is at half a cent. The same audio through OpenAI's Whisper API would already be at six cents. Through Rev AI, twenty cents. The gap widens every second."*

Point at one specific Rain chunk that arrived twice (k=2 redundancy) and converged on the same transcript via semantic-hash quorum.

> *"That chunk landed on two Nodes independently. Both transcripts hashed to the same semantic class. Quorum cleared, oracle didn't need to spot-check. If they'd disagreed, an oracle Node would arbitrate."*

### Step 4 — Catchment seals, SRT bundle downloads (45s)

Last Rain lands. Catchment animates closed. Bundle download chip appears: `maya-podcast-week-12.srt.zip` (SRT + VTT + JSON + plain in one zip).

Read aloud:
- *"Total audio: thirty minutes."*
- *"Total cost: **two cents**."*
- *"Same workload through OpenAI Whisper API: **eighteen cents**. Through AssemblyAI batch: **six cents**. Through Rev human-grade: **forty-five dollars**."*
- *"Strata's wedge is four cents an audio-hour, paid out to the Distributor whose visitors did the work. Two-thousand-times cheaper than human Rev, three-times cheaper than the cheapest API competitor."*

Pause. Let it land.

**Live narration math.** Step 4's specific dollar callouts assume a 30-minute fixture (30 ÷ 60 × $0.04 = $0.020). If the final fixture is N minutes:
- Strata: `N / 60 × $0.04`
- AssemblyAI batch: `N / 60 × $0.12`
- OpenAI Whisper API: `N / 60 × $0.36`
- Rev AI: `N / 60 × $1.20`
- Rev human: `N / 60 × $90`

Pin one fixture during dry-run. Do not improvise math live.

### Step 5 — Optional: show the embed and the consent surface (45s)

If time permits. Open `http://localhost:5174` (the demo-site indie ML blog).

> *"This is the Distributor's site. Footer chip is visible: 'This page is contributing compute to a transcription Forecast.' One click to pause."*

Click the chip — explainer modal opens.

> *"Two-sentence explainer. Pause toggle is sticky for the session. Zero PII collected. Node identity is a scheduler-internal pseudonymous keypair the user never sees. This is the anti-Coinhive: consent-first, named workload, instant pause."*

Open DevTools → Network tab. Filter for the Strata-hosted worker bundle URL.

> *"That's the worker bundle, served from a version-pinned Strata CDN URL — not from `@latest`, so a bad deploy can't poison the entire fleet. Whisper-base ONNX model loads from a separate RemoteDataPattern URL. Visitor's GPU is doing real inference. They don't see it, they don't feel it, the site owner gets paid."*

## What to cut if running long

- Skip Step 5 entirely (embed demo + consent surface)
- Skip the JSON pause in Step 1 — just say "Gemma translates plain English into a Forecast spec"
- Pre-fill the Composer text box so you don't type live
- Skip the per-chunk redundancy callout in Step 3

## What to add if running short (have 6 min)

Add at end of Step 4:
> *"Quick architecture note: the DCP scheduler distributes Rain chunks across Nodes via a single `compute.for()` call. The submit worker fetches via DCP's RemoteDataPattern — no IndexedDB, no WebSocket, no Playwright, V8-sandbox-clean. Each chunk runs k=2 redundantly, semantic-hash quorum collapses agreeing pairs, one to three percent of chunks get an oracle spot-check. Failed chunks reissue immediately. The Catchment assembles in timestamp order so the Client sees a coherent SRT, not an out-of-order race."*

## Auto-tier-promotion talking point (insert in Step 4 if a judge asks about scale)

> *"There's no admin queue. Maya started Provisional, capped at one hundred audio-hours a month. Once she hits fifty audio-hours processed and seven days on the platform, she auto-promotes to Verified — ten thousand audio-hours a month. After five thousand audio-hours and sixty days, Trusted — effectively unbounded. No human review, no admin UI, ceilings are the safety net."*

## Talking points for Q&A

**Q: Why DCP?**
> *DCP is the only production distributed compute network that runs natively in browsers and is V8-sandboxed. We don't run any GPU servers ourselves. The Distributor's visitors are the entire compute fleet.*

**Q: Is Whisper actually running in the browser?**
> *Yes. WebGPU plus transformers.js v3 plus a quantized Whisper checkpoint. Our standalone proof in the repo confirms it. The demo just showed the version-pinned worker bundle and model chunks downloading in the Network tab.*

**Q: What about non-WebGPU browsers?**
> *Capability detection at slot startup falls back to WASM-SIMD Whisper-tiny. Same chunk size, same redundancy, slower per-chunk. Capability categories filter Forecasts to compatible Nodes.*

**Q: How does the worker bundle get into a DCP sandbox?**
> *Strata-hosted version-pinned CDN URL is the primary path — content-addressed manifest is the fallback for paranoia. No `@latest` anywhere. The bundle uses RemoteDataPattern fetch only — no IndexedDB, no WebSocket, no Playwright. Sandbox-clean by construction.*

**Q: What if a Node leaves mid-chunk?**
> *DCP's scheduler reassigns the chunk to another Node. We also run k=2 redundantly, so even without reassignment we have a second copy en route. Failed chunks reissue immediately. The Client only sees the assembled Catchment.*

**Q: Quality vs Whisper API or AssemblyAI?**
> *Whisper-base WebGPU on a thirty-second window with k=2 plus oracle spot-check on one to three percent. WER is within noise of the OpenAI Whisper API for English clean audio. We don't claim parity for diarization or noisy multilingual — those aren't in the locked vertical.*

**Q: Isn't this Coinhive 2.0?**
> *No. Coinhive was opaque mining without consent. Strata has a named workload chip, an explainer modal, a pause toggle that's sticky for the session, and zero PII. The user always sees what's happening, and the workload is socially legible — transcription, not mining.*

**Q: How do Distributors actually get paid?**
> *DCC accumulates in their DCP keystore. We accumulate USD value via our thirty-two percent margin and use Stripe Connect to push to their bank. Demo is Stripe test mode — UI works, no real money flows.*

**Q: How does scale work without an admin queue?**
> *Auto-tier-promotion. Provisional one hundred audio-hours per month — Verified at fifty audio-hours processed and seven days on platform — Trusted at five thousand audio-hours and sixty days. Capability ceilings are the safety rail, no human in the loop, no admin UI to ship.*

**Q: How big is the Sky?**
> *For the demo, six laptops plus whatever public DCP workers are online. In production, every Distributor's visitor is potentially a Node. Scales with the Distributor's audience.*

**Q: What's the Auth0 angle?**
> *Two account types — Distributor and Client — with a custom `account_type` claim set by a post-login Action, role-gated layouts in Next.js 16 App Router via the v4 SDK's `proxy.ts` interceptor. Standard Universal Login. Nodes are anonymous by design — they have no Auth0 account.*

**Q: Why Gemma 4 in the Forecast Composer?**
> *Plain-English to Forecast-spec translation. Cheap to wire, runs in-browser via WebGPU, qualifies us for the MLH Gemma 4 track. The Forecast spec is structured JSON the scheduler consumes directly — Gemma is the human-friendly front door, not the workload.*
