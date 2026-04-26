# Skeleton — Next.js + Prisma + Auth Stub

Phase 1 deliverable. Goal: app boots, `/`, `/signup`, `/distributor`, `/client` routes render with stub auth, DB migrated, Vercel preview deploys on push.

Owner: BE1 (scaffold) + BE2 (auth stub) + FE (shell layout)

> **Note:** `AGENTS.md` says "this is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before touching App Router APIs. The locked stack is Next 16.2.4 + React 19.2.4 — several conventions (proxy.ts, async cookies, async params) differ from training-data Next.js examples.

## Scaffold (BE1, ~30 min)

```bash
npx create-next-app@latest strata --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"
cd strata
npm i prisma @prisma/client zod @auth0/nextjs-auth0@4.19 @base-ui/react@1.4 lucide-react class-variance-authority clsx tailwind-merge
npm i -D @types/node
npx shadcn@latest init
npx prisma init --datasource-provider sqlite
```

Confirm `package.json` after install pins:
- next 16.2.x
- react / react-dom 19.2.x
- @prisma/client 6.19.x
- @auth0/nextjs-auth0 4.19.x
- @base-ui/react 1.4.x
- shadcn 4.5.x
- tailwindcss 4.x

`.env.local`:
```
DATABASE_URL="file:./dev.db"
AUTH_MODE=stub
AUTH0_SECRET=
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://strata-api
APP_BASE_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=
DCP_WORKER_SHARED_SECRET=<openssl rand -hex 32>
DCP_SUBMIT_WORKER_URL=http://localhost:3001
WHISPER_MODEL_CDN_URL=https://cdn.strata.app/runtime/
```

Note port: Next.js dev runs on 3000, DCP submit worker runs on 3001.

## Prisma schema ([prisma/schema.prisma])

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model User {
  id        String   @id @default(cuid())
  auth0Sub  String?  @unique
  email     String   @unique
  role      String   // "distributor" | "client" | "admin" (admin reserved, unused)
  createdAt DateTime @default(now())
  distributor Distributor?
  client      Client?
}

model Distributor {
  id                       String  @id @default(cuid())
  userId                   String  @unique
  user                     User    @relation(fields: [userId], references: [id])
  displayName              String
  stripeConnectAccountId   String?
  dcpPaymentAddress        String  // public address of the Distributor's DCP keystore
  status                   String  @default("active")
  cocAcceptedAt            DateTime?
  cocVersionHash           String?
  sites                    Site[]
  slots                    ComputeSlot[]
  settlements              Settlement[]
}

model Client {
  id                          String   @id @default(cuid())
  userId                      String   @unique
  user                        User     @relation(fields: [userId], references: [id])
  displayName                 String
  stripeCustomerId            String?
  balanceCents                Int      @default(0)
  tier                        String   @default("provisional") // provisional|verified|trusted
  capabilities                String   @default("[\"English\"]") // JSON: language scope
  expectedScale               String?  // audio-hours/month bucket
  cocAcceptedAt               DateTime?
  cocVersionHash              String?
  reviewedAt                  DateTime?
  reviewNotes                 String?
  forecasts                   Forecast[]
}

model Site {
  id                String  @id @default(cuid())
  distributorId     String
  distributor       Distributor @relation(fields: [distributorId], references: [id])
  domain            String
  category          String?
  monthlyPageviewsBucket String?
  verificationToken String   @unique
  verifiedAt        DateTime?
  slots             ComputeSlot[]
}

model ComputeSlot {
  id                  String  @id @default(cuid())
  siteId              String
  site                Site    @relation(fields: [siteId], references: [id])
  distributorId       String
  distributor         Distributor @relation(fields: [distributorId], references: [id])
  name                String
  allowedCategories   String  // JSON: ["Inference: Audio"]
  maxTimePerNode      Int?
  defaultPosition     String?
  embedKey            String  @unique
  active              Boolean @default(true)
}

// New transcription-runtime models

model Forecast {
  id                   String   @id @default(cuid())
  clientId             String
  client               Client   @relation(fields: [clientId], references: [id])
  inputManifestUrl     String
  audioHoursTotal      Float
  languageScope        String   // "English" | "Multilingual" | "Translation"
  outputFormats        String   // JSON: subset of ["srt","vtt","json","plain"]
  webhookUrl           String?
  status               String   @default("queued") // queued|active|sealing|sealed|failed
  budgetCents          Int
  budgetCyclesUsed     Int      @default(0)
  workFunctionVersion  String   @default("strata-whisper-v1")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  frontOpenedAt        DateTime?
  sealedAt             DateTime?
  slices               Slice[]
  catchment            Catchment?
  settlements          Settlement[]
  @@index([clientId, status])
  @@index([clientId])
}

model Slice {
  id              String   @id @default(cuid())
  forecastId      String
  forecast        Forecast @relation(fields: [forecastId], references: [id])
  chunkIndex      Int
  timestampStart  Float
  timestampEnd    Float
  inputUrl        String
  attemptNumber   Int      // 1, 2 for k=2; 99 for oracle
  status          String   @default("issued") // issued|running|completed|failed|dropped
  nodePubkey      String?
  outputHash      String?
  outputText      String?
  cyclesConsumed  Int?
  issuedAt        DateTime @default(now())
  completedAt     DateTime?
  attestation     Attestation?
  @@index([forecastId, chunkIndex, attemptNumber])
}

model Catchment {
  id               String   @id @default(cuid())
  forecastId       String   @unique
  forecast         Forecast @relation(fields: [forecastId], references: [id])
  bundleUrl        String
  audioHoursSealed Float
  slicesCompleted  Int
  slicesTotal      Int
  sealedAt         DateTime @default(now())
  @@index([forecastId])
}

model Attestation {
  id              String   @id @default(cuid())
  sliceId         String   @unique
  slice           Slice    @relation(fields: [sliceId], references: [id])
  nodePubkey      String
  nodeRegionGlyph String
  outputHash      String
  schedulerSig    String
  ts              DateTime @default(now())
  @@index([sliceId])
}

model Settlement {
  id               String   @id @default(cuid())
  forecastId       String
  forecast         Forecast @relation(fields: [forecastId], references: [id])
  distributorId    String
  distributor      Distributor @relation(fields: [distributorId], references: [id])
  slotId           String
  grossCents       Int
  distributorCents Int      // 68%
  strataCents      Int      // 32%
  createdAt        DateTime @default(now())
}
```

```bash
npx prisma migrate dev --name init
```

## Auth stub mode (BE2, ~2h)

Strata supports two auth modes via `AUTH_MODE` env var:
- `stub` — cookie-based, picks role from a query param. For dev/demo. No real Auth0 round-trip.
- `auth0` — real Auth0 Universal Login via `@auth0/nextjs-auth0` v4 (see [06-auth0.md](06-auth0.md))

Both expose the same `getSession()` API to route handlers and components.

[src/lib/auth.ts]:
```ts
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type Session = {
  userId: string;
  email: string;
  role: 'distributor' | 'client' | 'admin';
};

export async function getSession(): Promise<Session | null> {
  if (process.env.AUTH_MODE === 'stub') {
    const cookieStore = await cookies();           // async in Next 15+
    const c = cookieStore.get('strata-stub-session');
    return c ? JSON.parse(c.value) : null;
  }
  // auth0 path: see 06-auth0.md
  return await getAuth0Session();
}

export function requireRole(session: Session | null, role: Session['role']) {
  if (!session) throw new Response('Unauthorized', { status: 401 });
  if (session.role !== role) throw new Response('Forbidden', { status: 403 });
}
```

Stub login route [app/api/auth/stub/route.ts]:
```ts
export async function POST(req: NextRequest) {
  if (process.env.AUTH_MODE !== 'stub') return new Response('Disabled', { status: 404 });
  const { role, email } = await req.json();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role },
  });
  const session: Session = { userId: user.id, email, role };
  const res = NextResponse.json({ ok: true });
  res.cookies.set('strata-stub-session', JSON.stringify(session), { httpOnly: true, sameSite: 'lax' });
  return res;
}
```

In landing page, two buttons "Continue as Distributor" / "Continue as Client" POST to `/api/auth/stub` with the role, then redirect to the matching dashboard.

## Routes (App Router)

Atmospheric vocabulary lock: routes use `forecasts` not `jobs`. Internal scheduler-to-Strata callbacks stay under `/api/scheduler/`.

```
app/
  layout.tsx                              # root layout, fonts, providers
  page.tsx                                # landing
  signup/page.tsx                         # role picker (Distributor / Client)
  distributor/
    layout.tsx                            # role-gated: requireRole(session, 'distributor')
    page.tsx                              # dashboard
    sites/page.tsx                        # site list + add site
    sites/[id]/verify/page.tsx            # verification instructions
    slots/[slotId]/page.tsx               # slot detail + embed snippet
  client/
    layout.tsx                            # role-gated: requireRole(session, 'client')
    page.tsx                              # dashboard
    forecasts/page.tsx                    # Forecast list
    forecasts/new/page.tsx                # Forecast Composer (RSS / YouTube / file upload)
    forecasts/[id]/page.tsx               # Forecast Detail (live demo hero)
  api/
    auth/stub/route.ts                    # POST stub login (AUTH_MODE=stub only)
    sites/route.ts                        # POST create site
    sites/[id]/verify/route.ts            # GET poll verification, POST trigger check
    slots/route.ts                        # POST create slot
    embed/[slotId]/config/route.ts        # GET runtime config (paymentAddress + joinSecret) — see 04-embed.md
    forecasts/route.ts                    # POST create Forecast
    forecasts/[id]/stream/route.ts        # GET SSE stream (Client Forecast Detail)
    distributors/[id]/stream/route.ts     # GET SSE stream (Distributor SliceTicker)
    scheduler/slice-callback/route.ts     # POST single canonical callback from submit worker
                                          # body discriminator: { phase: 'accepted'|'status'|'result'|'error'|'done'|'failed', ... }
                                          # Authorization: Bearer ${DCP_WORKER_SHARED_SECRET} verified with timingSafeEqual

# Auth0 v4 mounts /auth/login, /auth/callback, /auth/logout automatically via proxy.ts at repo root.
# Do NOT add /api/auth/[auth0]/route.ts — that's the v3 catch-all pattern. v4 doesn't use it.
```

## Design system (FE, ~3h, parallel with BE work)

- `globals.css` with `@theme` tokens (Tailwind 4 CSS-first)
- Init shadcn 4.5: `npx shadcn@latest init`
- Add components: `npx shadcn@latest add button card input select dialog tabs table`
- @base-ui/react 1.4 primitives for accessibility-critical surfaces
- Build `AppShell` component: topbar (logo, role badge, sign-out) + sidebar (role-aware nav) + content slot

## Running locally (4 processes)

| Process | Port | Command (run from each dir) |
|---|---|---|
| Next.js app | 3000 | `cd strata && npm run dev` |
| DCP submit worker | 3001 | `cd dcp-submit-worker && npm run dev` — see [03-dcp-integration.md](03-dcp-integration.md) |
| Demo site (creator-content blog) | 5174 | `cd demo-site && npx serve -l 5174` |
| ngrok (so DCP can call back to localhost:3001) | — | `ngrok http 3001` then paste the https URL into `DCP_SUBMIT_WORKER_URL` in `strata/.env.local` |

Optional 5th: `npx prisma studio` on 5555 for inspecting DB during dev.

For the demo, set `DCP_SUBMIT_WORKER_URL` to the ngrok URL (or the Vultr public URL). The Next.js app POSTs to `${DCP_SUBMIT_WORKER_URL}/submit` with the Forecast spec; the submit worker POSTs back to the Vercel preview URL via the single canonical `/api/scheduler/slice-callback` endpoint.

## Phase 1 exit criteria

- [ ] `npm run build` green on Vercel preview deploy
- [ ] Landing page renders, two signup buttons work in stub mode
- [ ] Clicking Distributor → lands on `/distributor` with role-gated layout
- [ ] Clicking Client → lands on `/client` with role-gated layout
- [ ] Prisma migrations applied (User/Distributor/Client/Site/ComputeSlot/Forecast/Slice/Catchment/Attestation/Settlement), can create User row via stub login
- [ ] Sign-out clears cookie and redirects home

## Why Next.js (not separate Express + Vite)

- One deploy target (Vercel) instead of two (Vercel + separate API host)
- Server Components let us read DB directly in dashboards without an API call
- Route handlers cover the small REST surface; SSE works natively via streaming responses
- Auth0 has a first-class Next.js SDK (v4)
- Prisma Client tree-shakes well in Next.js
- The DCP submit worker is the ONLY thing that lives outside the Next.js app, because it needs `~/.dcp/` keystores and a long-lived process — see [03-dcp-integration.md](03-dcp-integration.md)
