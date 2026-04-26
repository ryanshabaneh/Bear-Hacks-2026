# Risks & Mitigations

Numbered roughly by likelihood × impact. Risk 1 is the one most likely to kill the demo. Hackathon lens applied — every risk listed has a real demo-day surface or breaks the demo path. Production-hardening concerns are deferred (see [AUDIT-SCOPE.md](AUDIT-SCOPE.md)).

## Risk 1 — Whisper-WebGPU can't load inside DCP sandbox

**Risk:** The work function (stringified `Function.prototype.toString()`, eval'd inside a sandboxed Web Worker) can't load `@huggingface/transformers` v3 or can't access `navigator.gpu` / `OfflineAudioContext`. Result: every Slice fails, no demo.

**Likelihood:** HIGH. Impact: critical.

**Mitigation:** BE3 spike at T+2. Three paths in priority order:
- **A.** Strata-hosted version-pinned bundle (`https://cdn.strata.app/runtime/whisper-work-v1.js`) loaded inside the sandbox via DCP's allowed-fetch surface.
- **B.** Content-addressed bundle (SHA in path) registered as a RemoteDataPattern entry, used if the scheduler enforces hash-pinned URLs.
- **C.** Sandbox `fetch()` to a localhost transcription endpoint (a 30-line Express wrapping transformers.js running on the demo laptop). Real DCP scheduler, fake distribution.

Path C always works. The "wow" survives because the DCP scheduler is still real, the model is still really running on a laptop GPU — only the location changes.

## Risk 2 — DCP scheduler unreachable (conference WiFi)

**Risk:** Conference WiFi blocks `scheduler.distributed.computer` or rate-limits enough to break Forecast submission.

**Likelihood:** Medium. Impact: total demo failure.

**Mitigation:**
- **Primary:** phone hotspot for the presenter laptop. Tested before go-time.
- **Secondary:** pre-baked Catchment replay. The full Slice / Attestation / Catchment set for one canonical Forecast is captured during dry runs. If the live scheduler is down, Strata API replays Slice callbacks via SSE with realistic timing. Quorum, attestation, Catchment math, and settlement run real; only the DCP dispatch is replayed. UI labels the fallback explicitly. **Do NOT ship a hidden synchronous in-process mode that masks DCP errors.**
- **Tertiary:** pre-recorded backup video on second laptop. Play while narrating live.

## Risk 3 — Whisper cold start during demo

**Risk:** A demo Node browser hasn't pre-warmed the model; first Slice stalls 6-12s on download (Whisper-base ONNX ~150MB on WebGPU, ~80MB Whisper-tiny on WASM-SIMD); ENOPROGRESS kills slices.

**Likelihood:** Medium. Impact: visible stall.

**Mitigation:**
- Open all 6 demo browser tabs ≥60s before judging starts. The V8 sandbox has no persistent cache, so each NEW tab is a cold start; existing tabs reuse the in-memory pipeline.
- Work function calls `progress(0)` after fetch, `progress(0.3)` after model warm, `progress(0.5)` mid-inference, `progress(1)` before return — model download alone may exceed the 30s ENOPROGRESS watchdog on a cold browser.
- Fallback: if a tab goes cold, switch to a pre-warmed one. Demo only needs 1-2 active Nodes to look convincing.

## Risk 4 — DCP keystore not funded

**Risk:** `job.exec()` throws `ENOFUNDS` mid-demo.

**Likelihood:** Low (if preflight done). Impact: total demo failure.

**Mitigation:**
- Pre-fund keystore at T-1h with ≥5,000 DCC (see [01-preflight.md §1](01-preflight.md#1-dcp-keystore--funding-be3))
- Re-check balance at T+34 (one hour before demo): `await acct.getBalance()`
- If we somehow run out: switch to the pre-baked Catchment fallback (Risk 2 mitigation). There is no synchronous in-process mode.

## Risk 5 — Gemma 4 translator fails (Forecast Composer stretch)

**Risk:** Browser-WebGPU Gemma 4 1B cold-starts in front of judges, returns malformed JSON, or the WebGPU detection misfires. The "AI translates English" moment is the MLH Gemma 4 track hook.

**Likelihood:** Low (we control the browser). Impact: cosmetic but visible.

**Mitigation:** `src/lib/forecast-translator.ts` short-circuits when input matches a canonical demo phrase, returning a cached Forecast spec instantly. Live demo never depends on a model round-trip. Pre-warm Gemma 4 by visiting `/client/forecasts/new` once during dry-run. The translator still works for off-script inputs but the demo path doesn't need it.

## Risk 6 — Auth0 callback misconfigured on Vercel

**Risk:** Vercel preview URL not in Auth0 callback whitelist (note: SDK v4 uses `/auth/callback`, NOT `/api/auth/callback`); login breaks.

**Likelihood:** Medium. Impact: signup screenshots only, not demo path.

**Mitigation:**
- Lock to one Vercel production URL (`strata.app` if domain ready, else a fixed `strata.vercel.app` alias). Configure Auth0 callbacks for that exact URL at T+0.
- Test full Auth0 v4 flow at T+22, T+30, T+34.
- If broken at demo time: flip `AUTH_MODE=stub` on Vercel, redeploy (~30s). Pre-staged demo accounts work in both modes — `getSession()` returns the same shape per [06-auth0.md](06-auth0.md).

## Risk 7 — SSE connection drops / Vercel 5-min timeout

**Risk:** Long Forecasts exceed Vercel's serverless function timeout (~5 min for SSE), connection drops, results stop streaming.

**Likelihood:** Low for the demo fixture (30-60 min audio = ~3-5 min wall-clock at k=2 with 6 Nodes). Impact: cosmetic — Slices in DB are fine, UI just stops updating.

**Mitigation:**
- EventSource auto-reconnects on close; the Forecast Detail page hits `/api/forecasts/[id]` for a catch-up snapshot on remount, so the reducer resyncs.
- For demo: pin the audio fixture so the Catchment seals in under 5 minutes. Risk surfaces only if a judge insists on a longer fixture.

## Risk 8 — Cross-origin iframe / CSP issues on Distributor's site

**Risk:** Real Distributor sites have CSP that blocks `https://embed.strata.app/runtime.html` or `https://scheduler.distributed.computer/dcp-client/dcp-client.js`.

**Likelihood:** N/A for hackathon (we control the demo-site). Medium for production.

**Mitigation:** demo-site has permissive CSP (we own it). Production: documented CSP requirements for Distributors in onboarding.

## Risk 9 — Forecast runs too slow with only 6 Nodes

**Risk:** A 60-minute audio fixture = 120 chunks × k=2 redundancy = 240 cycles. On 6 Nodes at ~10s per Whisper-base cycle (warm), that's ~7 minutes wall-clock. Demo runs over.

**Likelihood:** Medium. Impact: demo cuts off before the Catchment seals.

**Mitigation:**
- Pin the demo fixture at the lower bound of the locked range (~30 min audio = 60 chunks × k=2 = 120 cycles ≈ 3-4 min wall-clock).
- Pre-warm all demo tabs so first-Slice latency drops from 12s to ~2s.
- During run, watch the timer; if at T+2:30 the Catchment is <60% sealed, narrate "let's check the Distributor dashboard" to buy 30s, then return.
- Pre-baked Catchment as fallback if the live run blows past 4 minutes.

## Risk 10 — Public DCP network worker pool empty

**Risk:** Strata runs on the public DCP network (no Compute Group — see [01-preflight.md §2](01-preflight.md)). If no public DCP workers are online when we submit, slices stay queued and the live demo stalls.

**Likelihood:** Low during waking hours, medium overnight.

**Mitigation:** the demo Distributor sites + judge laptop tabs ARE the worker pool. Each tab opened on `embed.strata.app` joins as a DCP worker. Open ≥6 tabs across teammates' laptops 60s before judging starts. If public-network density still looks thin, the pre-baked Catchment fallback (Risk 2) replays a real recorded run.

---

## Hackathon-safe baseline

If everything goes wrong, this version still demos well — and crucially, no fallback masks DCP errors with a hidden synchronous mode:

1. **DCP submit worker is always real.** No `DCP_MODE=fallback` in-process shortcut.
2. If the live scheduler is unreachable: pre-baked canonical Forecast replay via SSE. Slice rows, Attestation rows, Catchment math all real; only `compute.for()` dispatch is replayed.
3. SSE streams Slice events to the Client dashboard.
4. Distributor dashboard ticks Catchment + Rain animation from real DB rows.
5. `AUTH_MODE=stub` skips Auth0 if its callback URL is broken. Pre-staged accounts work in both modes.
6. Embed still loads on the demo Distributor site from `embed.strata.app`; footer chip + tier badge visible.
7. One demo laptop has the full Whisper runtime warmed; we can decode a Slice live in DevTools as proof the WebGPU path works even if the live Forecast can't dispatch.

This hits: **DCP integration** (real `compute.for()` syntax + result aggregation, even if execution is replayed), **Auth0** (real if it works, stub if not), **Whisper-WebGPU** (real model in browser, demonstrable via DevTools network tab), **UI/UX** (polished dashboards, live SSE, atmospheric components). The MLH Gemma 4 track survives only if the Forecast Composer translator is wired and pre-warmed.

## Risk dashboard (check at T+10, T+22, T+30, T+34)

| Item | Owner | T+10 | T+22 | T+30 | T+34 |
|---|---|---|---|---|---|
| DCP balance > 100 DCC | BE3 | | | | |
| Whisper-WebGPU sandbox path confirmed | BE3 | | | | |
| Auth0 callback URLs match Vercel preview (v4 `/auth/callback`) | BE2 | | | | |
| 6 demo browser tabs warm + Whisper cached | ALL | n/a | n/a | | |
| `AUTH_MODE=auth0` round-trip works | BE2 | n/a | | | |
| Full demo path runs end-to-end | ALL | n/a | | | |
| Pre-baked Catchment + backup video recorded | FE | n/a | | | |
| Phone hotspot tested | ALL | n/a | n/a | | |
| Audio fixture pinned (30-60 min) + ground-truth SRT loaded | FE | n/a | | | |
