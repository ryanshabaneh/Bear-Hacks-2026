# Strata — Build Plan Overview

BearHacks 2026 · April 24-26 · 36 hours · Team of 4 (FE + BE1 + BE2 + BE3)

> **Source of truth:** [strata-architecture.md](strata-architecture.md). When 00-08 docs conflict with the architecture doc, the architecture doc wins.
>
> **Audit lens:** [AUDIT-SCOPE.md](AUDIT-SCOPE.md) lists what's in scope vs deferred for hackathon. Read first before applying any audit overwrite.

## What we're building

Creator-economy transcription marketplace on DCP. Clients pay per audio-hour to transcribe audio (podcasts, YouTube channels, file uploads). Distributors embed a `<script>` tag on their site and earn 68% revenue share. Nodes (visitor browsers) silently run Whisper-WebGPU inference slices.

**Atmospheric vocabulary** (memorize this; it's everywhere):

| User-facing | Technical primitive |
|---|---|
| **Strata** | The platform |
| **Sky** | The aggregate of online Nodes at any moment |
| **Node** | One visitor browser running one slice (no signup, pseudonymous) |
| **Forecast** | A submitted job spec (audio + parameters) |
| **Front** | The dispatch event when a Forecast goes live |
| **Rain** | One audio chunk falling on one Node |
| **Catchment** | The assembled output bundle returned to the Client |

User-facing copy uses atmospheric nouns. Schema fields, API surfaces, and protocol primitives use technical names.

## Three actors (locked terminology — do not rename)

- **Client** — creators (podcasters, YouTubers, course creators) that submit Forecasts, pay per audio-hour (Auth0 account)
- **Distributor** — site owners who embed Strata, earn 68% revenue share (Auth0 account)
- **Node** — end-user browser running embed.js. **No signup, no account, no PII.** Surfaces only the footer chip + "What is this?" modal.

Economic model: Client pays USD → Strata escrows DCC on DCP → Distributor gets 68%, Strata keeps 32%. Nodes are unpaid; ad-free experience is the value exchange.

Tier promotion is automatic based on completed-audio-hours and zero-anomaly attestation. No admin review UI in this build.

## Stack (one canonical choice — do not branch)

Verified against `strata/package.json` after Phase 1 scaffold:

| Layer | Technology |
|---|---|
| App framework | Next.js 16.2.4 (App Router), React 19.2.4, one project, role-gated by Auth0 claim |
| ORM / DB | Prisma 6.19.3 + SQLite (dev) / Neon Postgres (prod) |
| Live updates | Server-Sent Events (SSE) — `/api/forecasts/:id/stream`, `/api/distributors/:id/stream` |
| Auth | Auth0 Universal Login via `@auth0/nextjs-auth0` 4.19 + stub mode (env-gated `AUTH_MODE=stub\|auth0`) |
| DCP submit worker | Node.js + `dcp-client` (pinned), runs on Vultr VM (or local with ngrok) |
| Embed runtime | IIFE (`strata.js`) on Cloudflare Pages → injects iframe at `embed.strata.app` → DCP browser worker |
| AI model (workload) | Whisper-base ONNX via `@huggingface/transformers` v3 + WebGPU (Whisper-tiny WASM-SIMD fallback) |
| AI model (Forecast Composer translator, stretch) | Gemma 3 1B-IT ONNX via `@huggingface/transformers` v3 + WebGPU |
| UI primitives | `@base-ui/react` 1.4 + `shadcn` 4.5 + Tailwind 4 |
| Payments | Stripe Connect (mocked — Elements UI in test mode, no real money flow) |
| Hosting | Vercel (Next.js app, apex `strata.app`), Vultr (DCP submit worker), Cloudflare Pages (embed at `embed.strata.app`) |

Note: `AGENTS.md` says "this is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before App Router work. See [02-skeleton.md](02-skeleton.md) for env keys, [04-embed.md](04-embed.md) for embed origin lock.

## Live demo path (phases 3-5 only)

1. Maya (pre-logged-in Client) drops audio in the Forecast Composer
2. Gemma 4 1B translator emits Forecast spec JSON → validate/cost preview → Open Front
3. Switch to Distributor dashboard → watch SliceTicker tick live
4. Switch back to Client → Catchment fills column-by-column in timestamp order
5. Read the cost wedge aloud (target: $0.04/audio-hour vs Rev AI $1.20)
6. Optional: show embed footer chip on demo site

Phases 1-2 (Auth0 signup, Stripe funding) and Phase 7 (Stripe Connect payout) = screenshots in deck/Devpost.

See [07-demo-script.md](07-demo-script.md) for the full narrated script.

## Build phases (mirrors [strata-architecture.md](strata-architecture.md))

| Phase | Hours | Goal |
|---|---|---|
| **0. Preflight** | T-1 → 0 | Keystore funded, audio fixture in repo, Whisper-WebGPU sandbox spike confirmed — see [01-preflight.md](01-preflight.md) |
| **1. Skeleton + DCP Proof** | 0-6 | App boots, stub auth works, `compute.for()` returns one Whisper transcript — see [02-skeleton.md](02-skeleton.md) + [03-dcp-integration.md](03-dcp-integration.md) |
| **2. Vertical Slices** | 6-14 | Each dashboard renders, Forecast submission API works, embed loads — see [04-embed.md](04-embed.md) + [05-frontend.md](05-frontend.md) |
| **3. Quorum + Catchment** | 14-22 | End-to-end demo path runs once; quorum + oracle implemented; SSE live |
| **4. Polish + Demo Prep** | 22-30 | Real Auth0 v4 swap-in, pre-baked Catchment fallback, 5x dry-runs |
| **5. Demo Video + Submit** | 30-36 | 90-second video, Devpost description, submit at T-35:50 |

Detailed task ownership per phase is in [strata-architecture.md](strata-architecture.md#build-phases-and-task-assignment).

## Repo layout (target)

The work happens **inside this `Bear-Hacks-2026/` repo**. Scaffold each app as a top-level sibling directory — do not nest in a `strata/` subdir. The existing `docs/` and `plan/` directories stay where they are. The `strata-app/` directory is rejected scaffold and will be deleted; do not reference it.

```
Bear-Hacks-2026/                # this repo
  strata/                       # Next.js 16.2 app (created via `npx create-next-app strata` from repo root)
    app/                        # App Router (one project, role-gated)
      (marketing)/              # landing, signup
      distributor/              # Distributor dashboard
      client/                   # Client dashboard
      api/                      # see 02-skeleton.md for full route list
    prisma/
      schema.prisma             # User/Distributor/Client/Site/ComputeSlot/Forecast/Slice/Catchment/Attestation/Settlement
    src/lib/                    # auth, db, sse, worker-callbacks, forecast-translator
    proxy.ts                    # Auth0 v4 middleware mount
  dcp-submit-worker/            # Node.js — owns ~/.dcp/ keystores, calls compute.for()
    src/index.js                # Express server (port 3001)
    src/dcp.js                  # init helpers
    src/forecast.js             # Forecast pipeline (k=2 redundancy)
    src/callbacks.js            # POST helper for /api/scheduler/slice-callback
    package.json                # see 03-dcp-integration.md
    SPIKE.md                    # Whisper-WebGPU sandbox spike outcome (T+2)
  embed/                        # Cloudflare Pages target → embed.strata.app
    strata.js                   # IIFE loader, ~2KB
    runtime.html                # iframe content, loads dcp-client + worker
    what-is-this.html           # explainer modal page
  demo-site/                    # Static fake creator-content blog with embed (demo step 6)
    index.html
    post-2.html
    styles.css
  fixtures/
    audio-demo.json             # demo audio manifest (30-60 min total) + ground-truth SRT references
  docs/                         # (existing) DCP docs, Devpost info
  plan/                         # (this) build plan
```

After Phase 1, the repo root will hold 4 sibling app dirs (`strata/`, `dcp-submit-worker/`, `embed/`, `demo-site/`) plus `fixtures/`, `docs/`, `plan/`.

## Reading order by role

- **Frontend / UI engineer (Kelly):** [01-CONCEPT working notes](../../miu-brain/projects/bearhacks-2026/strata/claude-session-2026-04-25-docs/01-CONCEPT.md), [02-BRAND working notes](../../miu-brain/projects/bearhacks-2026/strata/claude-session-2026-04-25-docs/02-BRAND.md), [03-IMAGE working notes](../../miu-brain/projects/bearhacks-2026/strata/claude-session-2026-04-25-docs/03-IMAGE.md), [05-frontend.md](05-frontend.md), [04-embed.md](04-embed.md), [02-skeleton.md](02-skeleton.md).
- **Backend / fullstack engineer:** [strata-architecture.md](strata-architecture.md), [02-skeleton.md](02-skeleton.md), [03-dcp-integration.md](03-dcp-integration.md), [06-auth0.md](06-auth0.md).
- **DCP / scheduler integration:** [strata-architecture.md](strata-architecture.md) §DCP Integration, [03-dcp-integration.md](03-dcp-integration.md), [04-embed.md](04-embed.md).
- **Demo / pitch / video:** [07-demo-script.md](07-demo-script.md), [strata-architecture.md](strata-architecture.md) §Prize Targets.
- **Risks / preflight:** [08-risks.md](08-risks.md), [01-preflight.md](01-preflight.md).

## Prize tracks

| Track | How Strata hits it |
|---|---|
| **Best Use of DCP** ($660 CAD) | One `compute.for()` call per Forecast with k=2 redundancy + server-side semantic-hash quorum + 1-3% oracle spot-check, private Compute Group, real DCC flow, browser worker via embed |
| **MLH Best Use of Gemma 4** (Google swag) | Gemma 4 1B as Forecast Composer translator (browser-WebGPU, plain-English → Forecast spec). Stretch — discard if not feasible. |
| **MLH Best Use of Auth0** (headphones) | Real Universal Login (SDK v4.19) for Distributor + Client, custom `account_type` claim, post-login Action |
| **Best UI/UX** ($700 CAD) | Two polished dashboards, atmospheric signature components (CycleBudgetMeter, SliceTicker, CatchmentAssembling), live SSE streaming, footer chip, prefers-reduced-motion fallback |
| **Best Demo Video** ($100 GC) | 90-second video per [07-demo-script.md](07-demo-script.md) |
| **Most Fun** ($400 CAD) | CatchmentAssembling fills column-by-column in timestamp order |
