# Strata — Build Plan Overview

BearHacks 2026 · April 24–26 · 36 hours

## What we're building

AdSense-replacement on DCP. Website owners (Distributors) replace ad slots with a `<script>` tag; visitor browsers silently run Gemma inference slices for paying researchers (Clients) and earn DCC for the Distributor.

## Live demo path (phases 3–6 only)

1. Sarah (pre-logged-in Client) types plain-English job intent
2. Gemma 4 translator emits job spec JSON → validate/cost preview → Submit
3. Switch to Distributor dashboard → watch earnings tick live
4. Switch back to Client → results stream in problem-by-problem
5. Read swarm accuracy aloud (target: ~58% vs 23% single-shot)
6. Optional: show embed footer chip on demo site

Phases 1–2 (Auth0 signup) and 7 (Stripe payout) = screenshots only.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, WebSocket (ws) |
| Frontend | React (Vite) |
| Auth | Auth0 Universal Login |
| Compute | DCP (`compute.for()`) |
| AI model | Gemma 3 1B-IT ONNX via `@huggingface/transformers` + WebGPU |
| Payments | Stripe (mocked — fake UI only) |

## Repo structure

```
strata/
  backend/          # Node.js DCP job orchestrator + REST + WebSocket
  frontend/         # React app (Client dash + Distributor dash + Landing)
  embed/            # embed.js + worker.js (the script Distributors paste)
  demo-site/        # Fake ML blog with embed installed (for demo step 6)
```

## Build order (time-boxed)

| Hour | Milestone |
|---|---|
| 0-2 | Backend skeleton: Express + DCP init + keystore setup |
| 2-4 | DCP job submission working (Node.js localExec first) |
| 4-6 | embed.js: DCP Worker registration + Gemma loading |
| 6-10 | Client dashboard: job form + result streaming |
| 10-14 | Verifier pass (second compute.for()) |
| 14-18 | Distributor dashboard: live earnings ticks |
| 18-22 | Auth0 wired in (both account types) |
| 22-28 | Polish: accuracy comparison panel, animations, demo site |
| 28-34 | End-to-end rehearsal + fix bugs |
| 34-36 | Devpost submission + demo video |

## Prize tracks to hit

- **Best Use of DCP** — `compute.for()` for both rollout and verifier jobs, Compute Groups, real DCC flow
- **MLH Best Use of Gemma 4** — Gemma running in browser via WebGPU for inference
- **MLH Best Use of Auth0** — both Distributor and Client account types, custom claims
- **Best UI/UX** — clean dashboards, live ticks, comparison panel
