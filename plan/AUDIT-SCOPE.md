# Audit scope (hackathon lens)

Read first if you're picking up edits from the audit pass on the `/plan/` files.

The audit applies a senior-engineer lens scoped to **hackathon constraints**. Submission is Sun 2026-04-26 10:00 AM EDT. We do not have time, and judges do not have access, to ship production-grade hardening across the surface area.

## Filter rule

A flagged issue gets fixed only if **at least one** of these holds:

1. **Judge-exposed.** The bug or drift is visible in the booth demo, the README, the Devpost, or anywhere a judge will poke (URL bar, devtools network tab, Auth0 login page, footer chip, page source).
2. **Demo-breaking.** The issue prevents the live demo path from running, or causes a visible regression mid-run.

If neither holds, the issue is documented but not fixed. Production hardening is a post-hackathon concern.

## What got kept

| Fix | Why it stayed in scope |
|---|---|
| Workload references rewritten from Gemma+AIME to Whisper transcription | Visible in every plan-doc surface and every demo narration |
| Atmospheric vocabulary (Forecast / Front / Rain / Catchment / Sky / Node) | User-facing and judge-facing copy |
| Stack version bumps (Next 16.2.4, React 19.2.4, Prisma 6.19.3, Auth0 v4.19) | Prevents `npm install` reverts; matches actual `package.json` |
| Route naming `/api/forecasts/` not `/api/jobs/` | Visible in URL bar, devtools, error messages |
| Auth0 SDK v4 surface (`Auth0Client`, `proxy.ts`, `/auth/*`) | BE2 must wire against the installed package; v3 examples will silently fail |
| Auth0 Action `app_metadata` over `user_metadata` for `account_type` | Privilege escalation surface. Judges may poke Auth0 |
| `timingSafeEqual` on shared-secret callback compare | Cheap five-line fix. Borderline judge-exposed if curl'd, but free |
| Worker bundle delivery: Strata-hosted version-pinned (Option B) over jsdelivr `@latest` | Demo-breaking — `@latest` floats and can ship breaking changes mid-judging |
| Pricing math + counterfactual cost panel | Demo payoff line; numbers must be correct |
| Whisper cold-start sizing in plan docs (replaces Gemma 2GB numbers) | Pre-stage checklist depends on accurate pre-warm timing |
| RemoteDataPattern + no-IndexedDB / no-WebSocket constraint | Demo-breaking if violated; DCP rejects |

## What got dropped

| Fix | Why it's deferred |
|---|---|
| iframe `sandbox` attribute deep-analysis | Not judge-exposed; current attrs work in Chrome |
| Firefox `location.ancestorOrigins[0]` portability rewrite in `runtime.html` | Demo runs in Chrome; no Firefox path on stage. Keep the original origin check |
| SSE `lastEventId` reconnect cursor for >5min Forecasts | Demo Forecasts cap at ~5 min; native `EventSource` retry is sufficient |
| HF inference API token (`NEXT_PUBLIC_HF_TOKEN`) exposure analysis | Resolved by switching Gemma translator to browser-WebGPU; no token surface |
| Idempotency key on Forecast submit endpoint | Single-laptop demo, no concurrent submits |
| Stripe Connect production-grade webhook signing | Payments are mocked end-to-end |
| Multi-region failover for the Strata scheduler bridge | Single dev instance behind ngrok is fine |

## Single source of truth for "is this in scope"

If you find a flagged issue that isn't listed above and you can't decide, ask Kelly. Default to dropping unless you can name a specific judge-touch surface or demo-path break.

## Update protocol

When a new audit lands, add a row to **What got kept** or **What got dropped** with the reason in the same shape. If a deferred item turns out to be demo-breaking after all (e.g. WebGPU detection breaks on a target browser), promote it to "kept" and note the trigger.
