# Strata — Build Plan Overview

BearHacks 2026 · April 24–26 · 36 hours · Team of 4 (FE + BE1 + BE2 + BE3)

> **Source of truth:** [strata-architecture.md](strata-architecture.md). When 00–08 docs conflict with the architecture doc, the architecture doc wins.

## What we're building

AdSense-replacement compute marketplace on DCP. Clients pay to run AI workloads; Distributors embed a `<script>` tag on their site and earn 68% revenue share; Nodes (visitor browsers) silently run Gemma inference slices.

## Three actors (locked terminology — do not rename)

- **Client** — orgs that submit compute jobs, pay per compute-second (Auth0 account)
- **Distributor** — site owners who embed Strata, earn 68% revenue share (Auth0 account)
- **Node** — end-user browser running embed.js. **No signup, no account, no PII.** Surfaces only the footer chip + "What is this?" modal.

Economic model: Client pays USD → Strata escrows DCC on DCP → Distributor gets 68%, Strata keeps 32%. Nodes are unpaid; ad-free experience is the value exchange.

## Stack (one canonical choice — do not branch)

| Layer | Technology |
|---|---|
| App framework | Next.js 14 (App Router), one project, role-gated by Auth0 claim |
| ORM / DB | Prisma + SQLite (dev) / Neon Postgres (prod) |
| Live updates | Server-Sent Events (SSE) — `/api/jobs/:id/stream` |
| Auth | Auth0 Universal Login + stub mode (env-gated `AUTH_MODE=stub\|auth0`) |
| DCP submit worker | Node.js + `dcp-client`, runs on Vultr VM (or local with ngrok) |
| Embed runtime | IIFE (`strata.js`) on Cloudflare Pages → injects iframe → DCP browser worker |
| AI model | Gemma 3 1B-IT ONNX via `@huggingface/transformers` + WebGPU |
| Payments | Stripe Connect (mocked — Elements UI in test mode, no real money flow) |
| Hosting | Vercel (Next.js app), Vultr (DCP submit worker), Cloudflare Pages (embed) |

## Live demo path (phases 3–6 only)

1. Sarah (pre-logged-in Client) types plain-English job intent
2. Gemma 4 translator emits job spec JSON → validate/cost preview → Submit
3. Switch to Distributor dashboard → watch earnings tick live
4. Switch back to Client → results stream in problem-by-problem
5. Read swarm accuracy aloud (target: ~58% vs 23% single-shot)
6. Optional: show embed footer chip on demo site

Phases 1–2 (Auth0 signup, Stripe funding) and 7 (Stripe Connect payout) = screenshots in deck/Devpost.

## Build phases (mirrors [strata-architecture.md](strata-architecture.md))

| Phase | Hours | Goal |
|---|---|---|
| **0. Preflight** | T-1 → 0 | Keystore funded, AIME fixture in repo, Gemma sandbox spike confirmed — see [01-preflight.md](01-preflight.md) |
| **1. Skeleton + DCP Proof** | 0–6 | App boots, stub auth works, `compute.for()` returns one Gemma result — see [02-skeleton.md](02-skeleton.md) + [03-dcp-integration.md](03-dcp-integration.md) |
| **2. Vertical Slices** | 6–14 | Each dashboard renders, job submission API works, embed loads — see [04-embed.md](04-embed.md) + [05-frontend.md](05-frontend.md) |
| **3. Integration + Verifier** | 14–22 | End-to-end demo path runs once; verifier pass implemented; SSE live |
| **4. Polish + Demo Prep** | 22–30 | Real Auth0 swap-in, fallback mode, 5x dry-runs |
| **5. Demo Video + Submit** | 30–36 | 90-second video, Devpost description, submit at T-35:50 |

Detailed task ownership per phase is in [strata-architecture.md](strata-architecture.md#build-phases-and-task-assignment).

## Repo layout (target)

The work happens **inside this `Bear-Hacks-2026/` repo**. Scaffold each app as a top-level sibling directory — do not nest in a `strata/` subdir. The existing `docs/`, `tessera-test/`, `plan/` directories stay where they are.

```
Bear-Hacks-2026/                # this repo
  strata/                       # Next.js app (created via `npx create-next-app strata` from repo root)
    app/                        # App Router (one project, role-gated)
      (marketing)/              # landing, signup
      distributor/              # Distributor dashboard
      client/                   # Client dashboard
      api/                      # see 02-skeleton.md for full route list
    prisma/
      schema.prisma             # User/Distributor/Client/Site/ComputeSlot/Job/Slice/Settlement
    src/lib/                    # auth, db, sse, worker-callbacks, translator
  dcp-submit-worker/            # Node.js — owns ~/.dcp/ keystores, calls compute.for()
    src/index.js                # Express server (port 3001)
    src/dcp.js                  # init helpers
    src/rollout.js              # Phase 4 job
    src/verifier.js             # Phase 5 job + aggregator
    package.json                # see 03-dcp-integration.md
    SPIKE.md                    # Gemma-in-sandbox spike outcome (T+2)
  embed/                        # Cloudflare Pages target
    strata.js                   # IIFE loader, ~2KB
    runtime.html                # iframe content, loads dcp-client + worker
    what-is-this.html           # explainer modal page
  demo-site/                    # Static fake ML blog with embed installed (demo step 6)
    index.html
    post-2.html
    styles.css
  fixtures/
    aime-2024.json              # 30 AIME problems + ground truth answers
    single-shot-baseline.json   # pre-computed Gemma single-shot results
  docs/                         # (existing) DCP docs, Devpost info
  tessera-test/                 # (existing) Gemma-in-browser standalone proof
  plan/                         # (this) build plan
```

After Phase 1, the repo root will hold 4 sibling app dirs (`strata/`, `dcp-submit-worker/`, `embed/`, `demo-site/`) plus `fixtures/` and the existing `docs/`, `tessera-test/`, `plan/`.

## Prize tracks

| Track | How Strata hits it |
|---|---|
| **Best Use of DCP** ($660 CAD) | Two `compute.for()` calls (rollout + verifier), private Compute Group, real DCC flow, browser worker via embed |
| **MLH Best Use of Gemma 4** (Google swag) | Gemma 4 used twice — translator (Phase 3) + workload (Phase 4+5), browser-side via WebGPU |
| **MLH Best Use of Auth0** (headphones) | Real Universal Login for Distributor + Client, custom `account_type` claim, Login Action |
| **Best UI/UX** ($700 CAD) | Two polished dashboards, live SSE streaming, footer chip, accuracy comparison panel |
| **Best Demo Video** ($100 GC) | 90-second video per [07-demo-script.md](07-demo-script.md) |
| **Most Fun** ($400 CAD) | Live tile-fill of slice results is engaging |
