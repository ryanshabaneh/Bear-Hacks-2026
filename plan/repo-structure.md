# Repo Structure (target after Phase 1)

Complete file/folder layout once Phase 1 scaffolding is done. Annotations show which plan doc owns each piece and which build phase creates it.

Legend:
- `(existing)` — already in repo
- `(P0)` — created during preflight
- `(P1)` — created during Phase 1 skeleton (hours 0-6)
- `(P2)` — Phase 2 vertical slices (hours 6-14)
- `(P3)` — Phase 3 quorum + Catchment (hours 14-22)
- `(P4)` — Phase 4 polish + Auth0 swap (hours 22-30)
- `(P5)` — Phase 5 demo video + submit (hours 30-36)

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
│   ├── AUDIT-SCOPE.md                      hackathon lens for which audit fixes are in scope
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
├── fixtures/                               (P0) — owned by 01-preflight.md §3
│   └── audio-demo.json                     30-60 min demo audio manifest + ground-truth SRT references
│
├── strata/                                 (P1) — Next.js 16.2.4 app, owned by 02-skeleton.md
│   │                                       created via `npx create-next-app@latest strata --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"`
│   ├── .env.local                          (gitignored) — see 02-skeleton.md §Scaffold + 06-auth0.md §Env vars summary
│   ├── .env.example                        committed template
│   ├── .gitignore                          (Next.js default + .env.local)
│   ├── README.md
│   ├── next.config.ts                      Next.js 16 default
│   ├── next-env.d.ts
│   ├── package.json                        deps in 05-frontend.md §Deps (Next 16.2.4, React 19.2.4, Prisma 6.19.3, @auth0/nextjs-auth0 4.19, @base-ui/react 1.4.1, shadcn 4.5, Tailwind 4)
│   ├── package-lock.json
│   ├── postcss.config.mjs                  Tailwind 4 PostCSS shape
│   ├── tsconfig.json
│   ├── components.json                     (shadcn config — created by `npx shadcn@latest init`)
│   ├── proxy.ts                            (P1) — Auth0 v4 middleware mount, see 06-auth0.md
│   ├── public/
│   │   └── favicon.ico
│   ├── prisma/                             (P1)
│   │   ├── schema.prisma                   full schema in 02-skeleton.md §Prisma schema
│   │   ├── dev.db                          (gitignored) SQLite DB
│   │   └── migrations/                     created by `npx prisma migrate dev --name init`
│   │       └── 20260425_init/
│   │           └── migration.sql
│   └── src/
│       ├── app/                            App Router — full route tree below
│       │   ├── layout.tsx                  root layout (P1)
│       │   ├── page.tsx                    landing (P1) — see 05-frontend.md §Landing page
│       │   ├── globals.css                 Tailwind 4 @theme tokens (P1)
│       │   │
│       │   ├── (marketing)/                route group, no URL prefix
│       │   │   └── signup/
│       │   │       └── page.tsx            (P1) — role picker (Distributor / Client), see 05-frontend.md §Signup
│       │   │
│       │   ├── distributor/                role-gated layout
│       │   │   ├── layout.tsx              (P1) — requireRole 'distributor'
│       │   │   ├── page.tsx                (P2) — earnings dashboard, see 05-frontend.md
│       │   │   ├── sites/
│       │   │   │   ├── page.tsx            (P2) — sites list + add site
│       │   │   │   └── [id]/
│       │   │   │       └── verify/
│       │   │   │           └── page.tsx    (P2) — verification instructions
│       │   │   └── slots/
│       │   │       └── [slotId]/
│       │   │           └── page.tsx        (P2) — slot detail + embed snippet
│       │   │
│       │   ├── client/                     role-gated layout
│       │   │   ├── layout.tsx              (P1)
│       │   │   ├── page.tsx                (P2) — Forecast list + balance card
│       │   │   ├── billing/
│       │   │   │   └── page.tsx            (P4) — Stripe Elements mock
│       │   │   └── forecasts/
│       │   │       ├── page.tsx            (P2) — Forecast list
│       │   │       ├── new/
│       │   │       │   └── page.tsx        (P3) — Forecast Composer (RSS / YouTube / file upload + Gemma translator stretch)
│       │   │       └── [id]/
│       │   │           └── page.tsx        (P3) — Forecast Detail (live demo hero), see 05-frontend.md
│       │   │
│       │   └── api/                        all server routes
│       │       ├── auth/
│       │       │   └── stub/
│       │       │       └── route.ts        (P1) — POST stub login (AUTH_MODE=stub only). Auth0 v4 mounts /auth/* via proxy.ts; no /api/auth/[auth0]/route.ts catch-all.
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
│       │       ├── forecasts/
│       │       │   ├── route.ts            (P2) — POST create Forecast
│       │       │   └── [id]/
│       │       │       └── stream/
│       │       │           └── route.ts    (P3) — GET SSE (Forecast Detail page)
│       │       ├── scheduler/
│       │       │   └── slice-callback/
│       │       │       └── route.ts        (P3) — POST single canonical callback from submit worker
│       │       │                            body discriminator: phase = accepted|status|result|error|done|failed
│       │       │                            timingSafeEqual on Bearer DCP_WORKER_SHARED_SECRET
│       │       └── distributors/
│       │           └── [id]/
│       │               └── stream/
│       │                   └── route.ts    (P2) — GET SSE (SliceTicker)
│       │
│       ├── components/                     (P1+) — UI components
│       │   ├── AppShell.tsx                topbar + sidebar + content slot
│       │   ├── SliceTicker.tsx             (P2) — Distributor SSE component (live Slice ticks)
│       │   ├── ForecastDetail.tsx          (P3) — Client Forecast detail live view
│       │   ├── CatchmentAssembling.tsx     (P3) — column-by-column SRT fill in timestamp order
│       │   ├── CycleBudgetMeter.tsx        (P3) — barometric gauge, dollars on hover
│       │   ├── CapabilityBloom.tsx         (P3) — radial chip with petals = active Node capabilities
│       │   ├── CostComparePanel.tsx        (P3) — counterfactual cost ticker (Rev / Whisper API / AssemblyAI)
│       │   ├── EmbedSnippet.tsx            (P2) — copy-to-clipboard snippet panel
│       │   └── ui/                         shadcn + @base-ui/react primitives
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
│           ├── auth0.ts                    Auth0Client singleton (P4)
│           ├── db.ts                       Prisma client singleton
│           ├── sse.ts                      subscribeSSE/broadcastSSE in-memory channels
│           ├── worker-callbacks.ts         (P3) — requireWorkerAuth (timingSafeEqual), runQuorumOnSlice, maybeRunOracleSpotCheck
│           ├── forecast-translator.ts      (P3) — Gemma 4 1B browser-WebGPU plain-English → Forecast spec (stretch)
│           └── useForecastStream.ts        (P3) — client hook for SSE consumption
│
├── dcp-submit-worker/                      (P1) — Node.js, owned by 03-dcp-integration.md
│   │                                       sibling of strata/, NOT inside it
│   ├── .env                                (gitignored) — STRATA_GROUP_KEY, DCP_WORKER_SHARED_SECRET, etc.
│   ├── .env.example                        committed template
│   ├── .gitignore                          node_modules + .env
│   ├── package.json                        full template in 03-dcp-integration.md §Setup (dcp-client pinned, NOT @latest)
│   ├── package-lock.json
│   ├── SPIKE.md                            (P0) — Whisper-WebGPU sandbox spike outcome from 01-preflight.md §5
│   └── src/
│       ├── index.js                        (P1) — Express server on :3001, POST /submit
│       ├── dcp.js                          (P1) — initDCP() + getCompute/getWallet
│       ├── forecast.js                     (P1→P3) — single compute.for() per Forecast with k=2 redundancy
│       └── callbacks.js                    (P3) — POST helper for /api/scheduler/slice-callback (Bearer auth)
│
├── embed/                                  (P2) — Cloudflare Pages target → embed.strata.app, owned by 04-embed.md
│   ├── strata.js                           IIFE loader (~2KB), full source in 04-embed.md
│   ├── runtime.html                        iframe content with dcp-client + worker
│   └── what-is-this.html                   explainer modal page (P3)
│
├── demo-site/                              (P2) — fake creator-content blog with embed installed, owned by 05-frontend.md §Demo site
│   ├── index.html                          "How I Cut My Podcast Editing Time by 80%"
│   ├── post-2.html                         "Subtitles Aren't Optional Anymore"
│   └── styles.css                          minimal blog styling
│
├── .gitignore                              (existing or P1) — adds: node_modules, .env*, .next, dev.db, strata-app/
└── README.md                               (P5) — Devpost-facing, what Strata is + how to run
```

Note: `strata-app/` (rejected pre-pivot scaffold) is being deleted. `tessera-test/` (pre-pivot Gemma-in-browser proof) is being replaced; if BE3 ships a standalone Whisper-WebGPU proof, name it `whisper-webgpu-test/` and add to this tree.

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
| Next.js app | Vercel | `https://strata.app` (apex; embed origin lock requires apex) |
| DCP submit worker | Vultr VM (or laptop + ngrok) | `https://<ngrok-or-vultr>/` — set in Vercel env as `DCP_SUBMIT_WORKER_URL` |
| Embed runtime | Cloudflare Pages | `https://embed.strata.app/` |
| Worker bundle | Strata-hosted CDN | `https://cdn.strata.app/runtime/whisper-work-v1.js` |
| Demo site | Cloudflare Pages OR `npx serve` on demo laptop | `http://localhost:5174` (demo) or `https://demo.strata.app/` |

## What lives where (cross-doc index)

| Concept | File(s) |
|---|---|
| Prisma models | `strata/prisma/schema.prisma` — defined in [02-skeleton.md](02-skeleton.md) |
| Auth (`getSession`, `requireRole`) | `strata/src/lib/auth.ts` — [02-skeleton.md](02-skeleton.md) + [06-auth0.md](06-auth0.md) |
| Auth0 v4 mount | `strata/proxy.ts` + `strata/src/lib/auth0.ts` — [06-auth0.md](06-auth0.md) |
| SSE infra | `strata/src/lib/sse.ts` — [03-dcp-integration.md](03-dcp-integration.md) |
| Single canonical scheduler callback | `strata/src/app/api/scheduler/slice-callback/route.ts` — [03-dcp-integration.md](03-dcp-integration.md) |
| DCP Forecast pipeline | `dcp-submit-worker/src/forecast.js` — [03-dcp-integration.md](03-dcp-integration.md) |
| Embed loader | `embed/strata.js` — [04-embed.md](04-embed.md) |
| Embed runtime iframe | `embed/runtime.html` — [04-embed.md](04-embed.md) |
| Embed config endpoint | `strata/src/app/api/embed/[slotId]/config/route.ts` — [04-embed.md](04-embed.md) |
| Whisper-WebGPU worker bundle | Strata-hosted version-pinned URL (Option B); content-addressed (Option C) fallback — [03-dcp-integration.md](03-dcp-integration.md) |
| Forecast Composer translator (stretch) | `strata/src/lib/forecast-translator.ts` — [05-frontend.md](05-frontend.md) |
| Demo HTML | `demo-site/*.html` — [05-frontend.md](05-frontend.md) |
| Audio fixture | `fixtures/audio-demo.json` — [01-preflight.md](01-preflight.md) |
| Whisper-WebGPU sandbox spike notes | `dcp-submit-worker/SPIKE.md` — [01-preflight.md](01-preflight.md) |
