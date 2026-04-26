# Repo Structure (target after Phase 1)

Complete file/folder layout once Phase 1 scaffolding is done. Annotations show which plan doc owns each piece and which build phase creates it.

Legend:
- `(existing)` — already in repo
- `(P0)` — created during preflight
- `(P1)` — created during Phase 1 skeleton (hours 0–6)
- `(P2)` — Phase 2 vertical slices (hours 6–14)
- `(P3)` — Phase 3 integration + verifier (hours 14–22)

```
Bear-Hacks-2026/
│
├── docs/                                   (existing) — DCP docs + Devpost info
│   ├── Devpost-Info/
│   │   └── BearHacks 2026 ... .md
│   └── dcp-docs/
│       ├── Compute API — DCP  documentation 1.md
│       ├── DCP with Browsers.md
│       ├── DCP with Node.js.md
│       ├── DCP with Python.md
│       ├── Deploying jobs with remote input data.md
│       ├── Distributive Compute Platform (DCP).md
│       ├── Getting started — DCP  documentation.md
│       ├── Glossary — DCP  documentation.md
│       ├── Protocol API — DCP  documentation.md
│       ├── Setting up DCP workers.md
│       ├── Wallet API — DCP  documentation.md
│       ├── Worker API — DCP  documentation.md
│       ├── dcp-client — DCP  documentation.md
│       ├── dcpcompute — DCP  documentation.md
│       └── dcpwallet — DCP  documentation.md
│
├── plan/                                   (existing) — build plan
│   ├── 00-overview.md
│   ├── 01-preflight.md
│   ├── 02-skeleton.md
│   ├── 03-dcp-integration.md
│   ├── 04-embed.md
│   ├── 05-frontend.md
│   ├── 06-auth0.md
│   ├── 07-demo-script.md
│   ├── 08-risks.md
│   ├── repo-structure.md                   (this file)
│   └── strata-architecture.md              source-of-truth deep reference
│
├── tessera-test/                           (existing) — Gemma-in-browser standalone proof
│   └── index.html
│
├── fixtures/                               (P0) — owned by 01-preflight.md §3-4
│   ├── aime-2024.json                      30 AIME problems + ground-truth answers
│   └── single-shot-baseline.json           pre-computed Gemma single-shot results
│
├── strata/                                 (P1) — Next.js 14 app, owned by 02-skeleton.md
│   │                                       created via `npx create-next-app@latest strata --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"`
│   ├── .env.local                          (gitignored) — see 02-skeleton.md §Scaffold + 06-auth0.md §Env vars summary
│   ├── .env.example                        committed template
│   ├── .gitignore                          (next.js default + .env.local)
│   ├── README.md
│   ├── next.config.js
│   ├── next-env.d.ts
│   ├── package.json                        deps in 05-frontend.md §Deps
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── components.json                     (shadcn/ui config — created by `npx shadcn-ui init`)
│   ├── public/
│   │   └── favicon.ico
│   ├── prisma/                             (P1)
│   │   ├── schema.prisma                   full schema in 02-skeleton.md §Prisma schema
│   │   ├── dev.db                          (gitignored) SQLite DB
│   │   └── migrations/                     created by `npx prisma migrate dev --name init`
│   │       └── 20260424_init/
│   │           └── migration.sql
│   └── src/
│       ├── app/                            App Router — full route tree below
│       │   ├── layout.tsx                  root layout (P1)
│       │   ├── page.tsx                    landing (P1) — see 05-frontend.md §Landing page
│       │   ├── globals.css                 Tailwind + design tokens (P1)
│       │   │
│       │   ├── (marketing)/                route group, no URL prefix
│       │   │   └── signup/
│       │   │       └── page.tsx            (P1) — role picker, see 05-frontend.md §Signup
│       │   │
│       │   ├── distributor/                role-gated layout
│       │   │   ├── layout.tsx              (P1) — requireRole 'distributor'
│       │   │   ├── page.tsx                (P2) — earnings dashboard, see 05-frontend.md
│       │   │   └── sites/
│       │   │       ├── page.tsx            (P2) — sites list + add site
│       │   │       └── [id]/
│       │   │           └── verify/
│       │   │               └── page.tsx    (P2) — verification instructions
│       │   │
│       │   ├── client/                     role-gated layout
│       │   │   ├── layout.tsx              (P1)
│       │   │   ├── page.tsx                (P2) — job list + balance card
│       │   │   ├── billing/
│       │   │   │   └── page.tsx            (P4) — Stripe Elements mock
│       │   │   └── jobs/
│       │   │       ├── page.tsx            (P2) — job list
│       │   │       ├── new/
│       │   │       │   └── page.tsx        (P3) — Gemma translator + submit form
│       │   │       └── [id]/
│       │   │           └── page.tsx        (P3) — job detail + live results, see 05-frontend.md
│       │   │
│       │   └── api/                        all server routes
│       │       ├── auth/
│       │       │   ├── stub/
│       │       │   │   └── route.ts        (P1) — POST stub login (AUTH_MODE=stub)
│       │       │   └── [auth0]/
│       │       │       └── route.ts        (P4) — Auth0 catch-all callbacks
│       │       ├── sites/
│       │       │   ├── route.ts            (P2) — POST create site
│       │       │   └── [id]/
│       │       │       └── verify/
│       │       │           └── route.ts    (P2) — GET poll + POST trigger
│       │       ├── slots/
│       │       │   └── route.ts            (P2) — POST create slot
│       │       ├── embed/
│       │       │   └── [slotId]/
│       │       │       └── config/
│       │       │           └── route.ts    (P2) — GET runtime config (paymentAddress + joinSecret), see 04-embed.md
│       │       ├── jobs/
│       │       │   ├── route.ts            (P2) — POST create job
│       │       │   └── [id]/
│       │       │       ├── stream/
│       │       │       │   └── route.ts    (P3) — GET SSE (Client dashboard)
│       │       │       ├── accepted/
│       │       │       │   └── route.ts    (P3) — POST callback: DCP accepted job
│       │       │       ├── status/
│       │       │       │   └── route.ts    (P3) — POST callback: status tick
│       │       │       ├── slice-result/
│       │       │       │   └── route.ts    (P3) — POST callback: one slice done, full handler in 03-dcp-integration.md
│       │       │       ├── slice-error/
│       │       │       │   └── route.ts    (P3) — POST callback: slice failed
│       │       │       ├── done/
│       │       │       │   └── route.ts    (P3) — POST callback: verifier complete
│       │       │       └── failed/
│       │       │           └── route.ts    (P3) — POST callback: job failed
│       │       └── distributors/
│       │           └── [id]/
│       │               └── stream/
│       │                   └── route.ts    (P2) — GET SSE (Distributor earnings)
│       │
│       ├── components/                     (P1+) — UI components
│       │   ├── AppShell.tsx                topbar + sidebar + content slot
│       │   ├── LiveTicks.tsx               (P2) — Distributor SSE component
│       │   ├── JobProgress.tsx             (P3) — Client job detail live view
│       │   ├── ResultsTable.tsx            (P3) — Problem × Single-shot × Swarm
│       │   ├── ComparisonPanel.tsx         (P3) — the +35pp money shot
│       │   ├── EmbedSnippet.tsx            (P2) — copy-to-clipboard snippet panel
│       │   └── ui/                         shadcn-generated primitives
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── dialog.tsx
│       │       ├── input.tsx
│       │       ├── select.tsx
│       │       ├── table.tsx
│       │       └── tabs.tsx
│       │
│       └── lib/                            (P1+) — shared modules
│           ├── auth.ts                     getSession() + requireRole(), see 02-skeleton.md + 06-auth0.md
│           ├── db.ts                       Prisma client singleton
│           ├── sse.ts                      subscribeSSE/broadcastSSE in-memory channels
│           ├── worker-callbacks.ts         (P3) — requireWorkerAuth + helpers, in 03-dcp-integration.md
│           ├── translator.ts               (P3) — Gemma 4 → JSON, in 05-frontend.md
│           └── useJobStream.ts             (P3) — client hook for SSE consumption
│
├── dcp-submit-worker/                      (P1) — Node.js, owned by 03-dcp-integration.md
│   │                                       sibling of strata/, NOT inside it
│   ├── .env                                (gitignored) — STRATA_GROUP_KEY, DCP_WORKER_SHARED_SECRET, etc.
│   ├── .env.example                        committed template
│   ├── .gitignore                          node_modules + .env
│   ├── package.json                        full template in 03-dcp-integration.md §Setup
│   ├── package-lock.json
│   ├── SPIKE.md                            (P0) — Gemma-in-sandbox spike outcome from 01-preflight.md §5
│   └── src/
│       ├── index.js                        (P1) — Express server on :3001, POST /submit
│       ├── dcp.js                          (P1) — initDCP() + getCompute/getWallet
│       ├── rollout.js                      (P1→P3) — Phase 4 compute.for() job
│       ├── verifier.js                     (P3) — Phase 5 compute.for() job + pickWinners aggregator
│       └── fallback.js                     (P4) — DCP_MODE=fallback in-process implementation, Risk 2 in 08-risks.md
│
├── embed/                                  (P2) — Cloudflare Pages target, owned by 04-embed.md
│   ├── strata.js                           IIFE loader (~2KB), full source in 04-embed.md
│   ├── runtime.html                        iframe content with dcp-client + worker
│   └── what-is-this.html                   explainer modal page (P3)
│
├── demo-site/                              (P2) — fake ML blog with embed installed, owned by 05-frontend.md §Demo site
│   ├── index.html                          "5 Things I Learned Tuning a Tiny LLM"
│   ├── post-2.html                         "Why Best-of-N Beats Bigger Models"
│   └── styles.css                          minimal blog styling
│
├── .gitignore                              (existing or P1) — adds: node_modules, .env*, .next, dev.db
└── README.md                               (P5) — Devpost-facing, what Strata is + how to run
```

## Process map (what runs where during dev)

| Process | Cwd | Port | Started by |
|---|---|---|---|
| Next.js dev server | `strata/` | 3000 | `npm run dev` |
| DCP submit worker | `dcp-submit-worker/` | 3001 | `npm run dev` |
| Demo site static server | `demo-site/` | 5174 | `npx serve -l 5174` |
| ngrok tunnel → :3001 | (anywhere) | — | `ngrok http 3001` |
| Prisma Studio (optional) | `strata/` | 5555 | `npx prisma studio` |

## Process map (production / demo day)

| Process | Hosted on | URL |
|---|---|---|
| Next.js app | Vercel | `https://strata-<branch>.vercel.app` (or `https://strata.dev` if domain wired) |
| DCP submit worker | Vultr VM (or laptop + ngrok) | `https://<ngrok-or-vultr>/` — set in Vercel env as `DCP_SUBMIT_WORKER_URL` |
| Embed runtime | Cloudflare Pages | `https://embed.strata.dev/` (or Pages preview URL) |
| Demo site | Cloudflare Pages OR `npx serve` on demo laptop | `http://localhost:5174` (demo) or `https://demo.strata.dev/` |

## What lives where (cross-doc index)

| Concept | File(s) |
|---|---|
| Prisma models | `strata/prisma/schema.prisma` — defined in [02-skeleton.md](02-skeleton.md#prisma-schema-prismaschemaprisma) |
| Auth (`getSession`, `requireRole`) | `strata/src/lib/auth.ts` — [02-skeleton.md](02-skeleton.md#auth-stub-mode-be2-2h) + [06-auth0.md](06-auth0.md#unified-getsession-replaces-stub-only-version-from-02-skeletonmd) |
| SSE infra | `strata/src/lib/sse.ts` — [03-dcp-integration.md](03-dcp-integration.md#sse-infrastructure-srclibssets) |
| Slice callback handlers | `strata/src/app/api/jobs/[id]/*` — [03-dcp-integration.md](03-dcp-integration.md#nextjs-side--slice-result-handler-appapijobsidslice-resultroutets) |
| DCP rollout job | `dcp-submit-worker/src/rollout.js` — [03-dcp-integration.md](03-dcp-integration.md#phase-4--rollout-job-dcp-submit-workersrcrolloutjs) |
| DCP verifier job | `dcp-submit-worker/src/verifier.js` — [03-dcp-integration.md](03-dcp-integration.md#phase-5--verifier-job-dcp-submit-workersrcverifierjs) |
| Embed loader | `embed/strata.js` — [04-embed.md](04-embed.md#stratajs-loader-iife) |
| Embed runtime iframe | `embed/runtime.html` — [04-embed.md](04-embed.md#runtimehtml-the-actual-worker) |
| Embed config endpoint | `strata/src/app/api/embed/[slotId]/config/route.ts` — [04-embed.md](04-embed.md#compute-group-secret-bake-in) |
| Gemma translator | `strata/src/lib/translator.ts` — [05-frontend.md](05-frontend.md#gemma-4-translator-client-side) |
| Demo HTML | `demo-site/*.html` — [05-frontend.md](05-frontend.md#demo-site-demo-site) |
| AIME fixture | `fixtures/aime-2024.json` — [01-preflight.md](01-preflight.md#3-aime-2024-fixture-be2) |
| Single-shot baseline | `fixtures/single-shot-baseline.json` — [01-preflight.md](01-preflight.md#4-single-shot-baseline-be2-parallel-with-3) |
| Gemma sandbox spike notes | `dcp-submit-worker/SPIKE.md` — [01-preflight.md](01-preflight.md#5-gemma-in-sandbox-spike-be3--highest-risk-item) |
