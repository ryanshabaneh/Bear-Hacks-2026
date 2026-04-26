# Preflight (T-1 hour → T+0)

Do these BEFORE the hackathon clock starts. Each blocks something downstream.

## 1. DCP keystore + funding (BE3)

DCP keystores can only be created via the Portal (no CLI). Source: [docs/dcp-docs/Wallet API — DCP documentation.md](../docs/dcp-docs/Wallet%20API%20—%20DCP%20%20documentation.md).

Steps:
1. Create an account at https://dcp.cloud
2. In the Portal → Wallet, create two keystores:
   - **`bearhacks`** — bank account keystore (will hold DCC, pays for jobs)
   - **`id`** — identity keystore (signs requests)
3. Download both as JSON files; place in `~/.dcp/bearhacks.keystore` and `~/.dcp/id.keystore` on the BE3 dev machine AND on the Vultr VM where the DCP submit worker will run
4. Pre-fund the `bearhacks` keystore with DCC. Hackathon contact (Distributive sponsor table) can grant a promo balance — ask for at least **5,000 DCC**. A 30-minute audio Forecast at k=2 redundancy = 60 chunks × 2 = 120 cycles. At ~10 DCC per cycle (verify with Distributive at the booth), one full demo Forecast costs ~1,200 DCC. 5,000 DCC covers ~4 demo runs plus margin.
5. Verify balance: in the Portal Bank tab, OR programmatically:
   ```js
   const wallet = require('dcp/wallet');
   const acct = await wallet.get('bearhacks');
   console.log(await acct.getBalance());  // should be > 0
   ```

**Test it works:** run the squaring tutorial from [docs/dcp-docs/Getting started](../docs/dcp-docs/Getting%20started%20—%20DCP%20%20documentation.md) end-to-end. If `await job.exec()` returns `[1, 2809, 4, 144]`, your keystore is funded and DCP works.

## 2. Public DCP network (no Compute Group)

The DCP Portal does not expose Compute Group provisioning to hackathon-tier accounts (verified 2026-04-26 — `Deploying jobs with remote input data.md` documents the SDK signature `job.computeGroups = [{ joinKey, joinSecret }]` but no Portal UI surface exists for creating one).

**Decision:** stay on the public DCP network. `job.computeGroups` is omitted entirely. The runtime iframe joins as a regular DCP worker. Random DCP workers may also pick up Strata slices and Strata workers may also pick up other groups' jobs — both acceptable for the demo.

**Demo narrative impact:** the "Strata Sky" story still works because the visitor sees Strata's branded chip + iframe runtime on a Distributor's site. Under the hood the worker pool is public DCP, but that's invisible at the user surface.

## 3. Audio fixture (BE2 + FE)

The demo workload is Whisper transcription on a creator-content fixture. Total duration **30 to 60 minutes** (locked range — fits a 5-minute live demo with the Catchment sealing on stage).

Recommended fixture shape:
- 3-4 short clips of ~10 minutes each (easier to talk through chunk-by-chunk), or
- One ~30-minute episode (cleaner narrative arc on stage)

Source candidates:
- Creative Commons podcasts (e.g. content under CC-BY licensing)
- Public-domain audio archives (LibriVox, Internet Archive)
- A teammate's recorded content with permission

Create [fixtures/audio-demo.json](../fixtures/audio-demo.json):
```json
{
  "name": "demo-fixture-2026-04-26",
  "totalSeconds": 1800,
  "clips": [
    { "id": "clip-01", "title": "Intro", "url": "https://cdn.strata.app/fixtures/clip-01.wav", "durationSeconds": 600 },
    { "id": "clip-02", "title": "Middle", "url": "https://cdn.strata.app/fixtures/clip-02.wav", "durationSeconds": 600 },
    { "id": "clip-03", "title": "Outro", "url": "https://cdn.strata.app/fixtures/clip-03.wav", "durationSeconds": 600 }
  ],
  "groundTruthSrtUrl": "https://cdn.strata.app/fixtures/demo-ground-truth.srt"
}
```

Pin the fixture by T+22 so dry-runs use the same audio every time. **Do NOT improvise live audio on stage.**

Server-side audio normalization at upload: re-encode to 16kHz mono WAV before chunking. All Slices get the same canonical format.

## 4. Server-side oracle Whisper (BE3)

The 1-3% oracle spot-check requires a server-side Whisper instance to compare against. Easiest path: a tiny Express server on the same Vultr VM as the DCP submit worker, wrapping `transformers.js` server-side or shelling out to `whisper.cpp`.

Stub for now; wire after the BE3 spike confirms the work-function path. Spot-check disagreements flag the Slice's Attestation as `oracleAgreed=false` and contribute to `Client.zeroAnomalies` for tier-promotion gating.

## 5. Whisper-in-sandbox spike (BE3 — HIGHEST RISK ITEM)

This is the central technical unknown. Resolve at T+2, not later.

**The question:** can a DCP work function (which is `Function.prototype.toString()`-stringified, then eval'd inside a sandboxed Web Worker) load `@huggingface/transformers` v3 and run Whisper-base ONNX with `device: "webgpu"`? Can it use `OfflineAudioContext` to decode audio fetched via RemoteDataPattern?

**Three paths to test, in order:**

**Path A — Strata-hosted version-pinned bundle (PRIMARY):**
```js
async function whisperWorkFn(input) {
  progress(0);
  const { transcribe } = await import('https://cdn.strata.app/runtime/whisper-work-v1.js');
  progress(0.2);
  const result = await transcribe({
    audioUrl: input.chunkUrl,
    modelUrl: input.modelUrl,
    onProgress: (p) => progress(0.2 + p * 0.7),
  });
  progress(0.95);
  return result;
}
```
The bundle inlines transformers.js v3 + audio decode helpers + WebGPU/WASM fallback logic. Bundle is content-addressed (SHA in path) and registered as a RemoteDataPattern entry. **Test:** publish a one-slice Forecast in BE3's dev environment and watch for ENOPROGRESS / module-load errors.

**Path B — Content-addressed jsdelivr fallback:**
Same shape but bundle URL is `https://cdn.jsdelivr.net/npm/strata-whisper-work@1.0.0/dist/whisper-work.js` with the package published. Used only if Strata's own CDN can't be set up in time. Still pinned, never `@latest`.

**Path C — Localhost inference fallback:**
The work function does `fetch('http://localhost:8080/transcribe', { body: JSON.stringify(input) })` to a small HTTP server we run on the demo laptop. Real DCP scheduling, fake distribution. Acceptable for demo if A and B fail. The HTTP server is 30 lines of Express wrapping transformers.js.

**Spike deliverable:** a one-page note in `dcp-submit-worker/SPIKE.md` saying "Path X works because ___" or "all three failed because ___". Locks the architecture for everyone else.

The spike must also confirm:
- `navigator.gpu` is available inside the sandbox (or the WASM-SIMD fallback works)
- `OfflineAudioContext` is available for chunk decode
- RemoteDataPattern fetch succeeds for both the bundle URL and a chunk URL
- Total cold-start (model fetch + warm + first decode) fits inside the 30s ENOPROGRESS budget with `progress()` heartbeats

## 6. Auth0 tenant + Vercel project provisioning (BE2)

- Create Auth0 tenant `strata-bearhacks-2026.auth0.com`
- Create Regular Web Application "Strata" (NOT SPA — Next.js does the OAuth dance server-side)
- Create API: audience = `https://strata-api`
- Set Allowed Callback URLs to `/auth/callback` (NOT `/api/auth/callback` — SDK v4 default)
- Create Vercel project, link to repo, set environment variables (placeholders fine)
- Note the Vercel preview URL pattern — Auth0 callback URLs need to allow `https://strata-*.vercel.app/auth/callback`

Detail in [06-auth0.md](06-auth0.md). Just provision now so DNS and tenant exist when BE2 starts wiring.

## 7. Vultr VM + ngrok fallback (BE3)

The DCP submit worker needs a public callback URL so DCP can deliver results back. Two options:
- **Vultr VM**: spin up a $5 instance, install Node.js, expose port 3001 with a domain. Stable. Slow to provision (15 min).
- **ngrok**: run submit worker on dev laptop, `ngrok http 3001` for a public URL. Fast. URL changes on restart.

**Recommendation:** ngrok for the hackathon. Vultr is over-engineering for 36 hours.

## Preflight checklist (sign off before T+0)

- [ ] `~/.dcp/bearhacks.keystore` exists and has DCC balance > 1000
- [ ] `~/.dcp/id.keystore` exists
- [ ] [fixtures/audio-demo.json](../fixtures/audio-demo.json) committed (30-60 min total audio + ground-truth SRT references)
- [ ] Whisper work-function bundle URL reachable: `curl https://cdn.strata.app/runtime/whisper-work-v1.js | head` returns JS
- [ ] `dcp-submit-worker/SPIKE.md` documents which Whisper-in-sandbox path works
- [ ] Auth0 tenant + Regular Web Application created (not SPA), Vercel project created
- [ ] Auth0 Allowed Callback URLs include `/auth/callback` (not `/api/auth/callback`)
- [ ] ngrok account created, authtoken saved
