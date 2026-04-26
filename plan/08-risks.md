# Risks & Mitigations

Numbered roughly by likelihood × impact. Risk 1 is the one most likely to kill the demo.

## Risk 1 — Gemma can't load inside DCP sandbox

**Risk:** The work function (stringified `Function.prototype.toString()`, eval'd inside a sandboxed Web Worker) can't dynamic-import `@huggingface/transformers` or can't access `navigator.gpu`. Result: every slice fails, no demo.

**Likelihood:** HIGH. Impact: critical.

**Mitigation:** Resolve at T+2 with the spike in [01-preflight.md §5](01-preflight.md#5-gemma-in-sandbox-spike-be3--highest-risk-item). Three paths in priority order:
- **A.** Dynamic import inside sandbox
- **B.** Pre-load model in runtime iframe + postMessage from sandbox
- **C.** Sandbox `fetch()` to localhost inference endpoint (a 30-line Express wrapper around transformers.js running on the demo laptop)

Path C always works. The "wow" survives because the DCP scheduler is still real, the model is still really running on a laptop GPU — only the location changes.

## Risk 2 — DCP scheduler unreachable (conference WiFi)

**Risk:** Conference WiFi blocks `scheduler.distributed.computer` or rate-limits enough to break job submission.

**Likelihood:** Medium. Impact: total demo failure.

**Mitigation:**
- **Primary:** phone hotspot for the presenter laptop. Tested before go-time.
- **Secondary:** Submit worker has `DCP_MODE=fallback` that runs slices in-process synchronously with mock latency, posting results to the same Next.js callbacks. SSE still streams. UI still animates. Demo still tells the story; the "real DCP scheduler" claim weakens — pivot the talking point to "compute.for() syntax + result aggregation."
- **Tertiary:** pre-recorded backup video on second laptop. Play while narrating live.

## Risk 3 — Gemma cold start during demo (2-3 minutes)

**Risk:** A demo Node browser hasn't pre-cached the model; first slice stalls 2-3 min on download; ENOPROGRESS kills slices.

**Likelihood:** Medium. Impact: visible stall.

**Mitigation:**
- Pre-warm all 6 demo laptops ≥30 min before judging. Tabs stay open.
- Work function calls `progress(0.05)`, `progress(0.1)`, `progress(0.5)` during model download stages so ENOPROGRESS doesn't fire.
- Fallback: if a laptop goes cold, immediately switch to a pre-warmed one. Demo only needs 1-2 active Nodes to look convincing.

## Risk 4 — DCP keystore not funded

**Risk:** `job.exec()` throws `ENOFUNDS` mid-demo.

**Likelihood:** Low (if preflight done). Impact: total demo failure.

**Mitigation:**
- Pre-fund keystore at T-1h with ≥5,000 DCC (see [01-preflight.md §1](01-preflight.md#1-dcp-keystore--funding-be3))
- Re-check balance at T+34 (one hour before demo): `await acct.getBalance()`
- If we somehow run out: flip to `DCP_MODE=fallback` (Risk 2 mitigation also covers this)

## Risk 5 — Gemma 4 translator fails / rate-limited

**Risk:** HF inference for `google/gemma-2-9b-it` is slow, returns malformed JSON, or rate-limits during demo.

**Likelihood:** Medium. Impact: cosmetic but visible (the "AI translates English" moment is core to the pitch).

**Mitigation:** [src/lib/translator.ts](../src/lib/translator.ts) short-circuits when the input matches the canonical demo phrase (`/AIME.*N\s*=\s*8/i`), returning a cached spec instantly. Live demo never depends on HF. The translator still works for off-script inputs but the demo path doesn't need it.

## Risk 6 — Auth0 callback misconfigured on Vercel

**Risk:** Vercel preview URL not in Auth0 callback whitelist, login breaks.

**Likelihood:** Medium. Impact: signup screenshots only, not demo path.

**Mitigation:**
- Lock to one Vercel production URL (`strata.dev` if domain ready, else a fixed `strata.vercel.app` alias). Configure Auth0 callbacks for that exact URL at T+0.
- Test full Auth0 flow at T+22, T+30, T+34.
- If broken at demo time: flip `AUTH_MODE=stub` on Vercel, redeploy (~30s). Pre-staged demo accounts work in both modes — `getSession()` returns the same shape per [06-auth0.md](06-auth0.md).

## Risk 7 — SSE connection drops / Vercel 5-min timeout

**Risk:** Long jobs exceed Vercel's serverless function timeout (~5 min for SSE), connection drops, results stop streaming.

**Likelihood:** Medium for full 480-slice runs. Impact: cosmetic — results in DB are fine, UI just stops updating.

**Mitigation:**
- EventSource auto-reconnects on close; reducer applies missed events from the catch-up snapshot endpoint `/api/jobs/[id]` on reconnect.
- For demo: the rollout phase finishes in ~3 min on 6 Nodes, well under the 5 min limit. Verifier phase starts a fresh stream.
- Long-term option: run Next.js on Vultr alongside the submit worker (no Vercel timeout). Don't do this during hackathon unless 5-min limit actually breaks something.

## Risk 8 — Cross-origin iframe / CSP issues on Distributor's site

**Risk:** Real Distributor sites have CSP that blocks `https://embed.strata.dev/runtime.html` or `https://scheduler.distributed.computer/dcp-client/dcp-client.js`.

**Likelihood:** N/A for hackathon (we control the demo-site). Medium for production.

**Mitigation:** demo-site has permissive CSP (we own it). Production: documented CSP requirements for Distributors in onboarding.

## Risk 9 — Verifier phase runs too slowly with only 6 Nodes

**Risk:** 240 verifier slices on 6 Nodes ≈ 40 slices each at 15s each = 10 min. Demo runs over time.

**Likelihood:** Medium. Impact: demo cuts off before the money shot.

**Mitigation:**
- Reduce N=8 → N=4 → 120 rollouts + ~60 verifiers ≈ 4 min total
- OR: pre-compute the rollout + verifier results, replay through the same SSE channels with mock latency. The DCP integration and aggregation logic are still real — only the inference is pre-staged.
- During run, watch the timer; if at T+3min the rollout phase isn't done, narrate "let's check the Distributor dashboard" to buy 30s.

## Risk 10 — DCP work function can't access Compute Group secret

**Risk:** [04-embed.md](04-embed.md) bakes the joinSecret into the runtime iframe via the `/api/embed/[slotId]/config` endpoint. If CORS or auth misfires, the worker can't join the group.

**Likelihood:** Low. Impact: workers don't pick up our slices, slices stay queued.

**Mitigation:** test at T+10. Curl the config endpoint from the runtime origin, check the JSON. Fallback: omit `computeGroups` entirely and accept any DCP worker (slice routing degrades).

---

## Hackathon-safe baseline

If everything goes wrong, this version still demos well:

1. Submit worker runs in `DCP_MODE=fallback` (in-process, no scheduler dependency)
2. SSE streams results to frontend in real-time
3. Distributor dashboard ticks up via the same SSE infrastructure (real DB Settlement rows, just credited from in-process slices)
4. `AUTH_MODE=stub` skips Auth0 entirely
5. embed.js still loads on demo-site, footer chip visible
6. Gemma still runs in [tessera-test/index.html](../tessera-test/index.html) for the "real Gemma in browser" moment via DevTools

This hits: **DCP integration** (real `compute.for()` syntax + result aggregation, even if execution is in-process), **Auth0** (real if it works, stub if not), **Gemma 4** (real model in browser, shown via DevTools), **UI/UX** (polished dashboards, live SSE). Three of four prize tracks survive a worst-case demo.

## Risk dashboard (check at T+10, T+22, T+30, T+34)

| Item | Owner | T+10 | T+22 | T+30 | T+34 |
|---|---|---|---|---|---|
| DCP balance > 100 DCC | BE3 | | | | |
| Gemma sandbox path confirmed | BE3 | | | | |
| Auth0 callback URLs match Vercel preview | BE2 | | | | |
| 6 demo laptops with model warm | ALL | n/a | n/a | | |
| `AUTH_MODE=auth0` round-trip works | BE2 | n/a | | | |
| Full demo path runs end-to-end | ALL | n/a | | | |
| Backup video recorded | FE | n/a | | | |
| Phone hotspot tested | ALL | n/a | n/a | | |
