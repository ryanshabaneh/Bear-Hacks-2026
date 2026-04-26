# Skeleton — Next.js + Prisma + Auth Stub

Phase 1 deliverable. Goal: app boots, `/`, `/signup`, `/distributor`, `/client` routes render with stub auth, DB migrated, Vercel preview deploys on push.

Owner: BE1 (scaffold) + BE2 (auth stub) + FE (shell layout)

## Scaffold (BE1, ~30 min)

```bash
npx create-next-app@latest strata --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"
cd strata
npm i prisma @prisma/client zod
npm i -D @types/node
npx prisma init --datasource-provider sqlite
```

`.env.local`:
```
DATABASE_URL="file:./dev.db"
AUTH_MODE=stub
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://strata-api
NEXTAUTH_SECRET=<openssl rand -base64 32>
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=
DCP_SUBMIT_WORKER_URL=http://localhost:3000
```

## Prisma schema ([prisma/schema.prisma])

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model User {
  id        String   @id @default(cuid())
  auth0Sub  String?  @unique
  email     String   @unique
  role      String   // "distributor" | "client" | "admin"
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
  dcpPaymentAddress        String  // public address of the Distributor's DCP keystore — Nodes earn DCC here
  status                   String  @default("active")
  sites                    Site[]
  slots                    ComputeSlot[]
  settlements              Settlement[]
}

model Client {
  id               String  @id @default(cuid())
  userId           String  @unique
  user             User    @relation(fields: [userId], references: [id])
  displayName      String
  stripeCustomerId String?
  balanceCents     Int     @default(0)
  jobs             Job[]
}

model Site {
  id                String  @id @default(cuid())
  distributorId     String
  distributor       Distributor @relation(fields: [distributorId], references: [id])
  domain            String
  verificationToken String   @unique
  verified          Boolean  @default(false)
  slots             ComputeSlot[]
}

model ComputeSlot {
  id            String  @id @default(cuid())
  siteId        String
  site          Site    @relation(fields: [siteId], references: [id])
  distributorId String
  distributor   Distributor @relation(fields: [distributorId], references: [id])
  name          String
  active        Boolean @default(true)
}

model Job {
  id                String   @id @default(cuid())
  clientId          String
  client            Client   @relation(fields: [clientId], references: [id])
  name              String
  description       String?
  status            String   @default("queued") // queued|rollouts|verifying|done|failed
  workFnTemplate    String   // "tessera_eval" etc.
  inputSetConfig    String   // JSON
  inputCount        Int
  nRollouts         Int      @default(8)
  useVerifier       Boolean  @default(true)
  budgetCents       Int
  perSliceCents     Int
  dcpJobId          String?  // rollout phase DCP job id
  dcpVerifierJobId  String?
  pcgJoinKey        String
  pcgJoinSecret     String
  createdAt         DateTime @default(now())
  slices            Slice[]
  settlements       Settlement[]
}

model Slice {
  id          String  @id @default(cuid())
  jobId       String
  job         Job     @relation(fields: [jobId], references: [id])
  index       Int
  phase       String  // "rollout" | "verifier"
  status      String  @default("pending") // pending|claimed|completed|failed
  nodeSession String?
  resultHash  String?
  resultData  String? // JSON
  createdAt   DateTime @default(now())
  completedAt DateTime?
}

model Settlement {
  id               String   @id @default(cuid())
  jobId            String
  job              Job      @relation(fields: [jobId], references: [id])
  distributorId    String
  distributor      Distributor @relation(fields: [distributorId], references: [id])
  slotId           String
  grossCents       Int
  distributorCents Int
  strataCents      Int
  createdAt        DateTime @default(now())
}
```

```bash
npx prisma migrate dev --name init
```

## Auth stub mode (BE2, ~2h)

Strata supports two auth modes via `AUTH_MODE` env var:
- `stub` — cookie-based, picks role from a query param. For dev/demo. No real Auth0 round-trip.
- `auth0` — real Auth0 Universal Login (see [06-auth0.md](06-auth0.md))

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
    const c = cookies().get('strata-stub-session');
    return c ? JSON.parse(c.value) : null;
  }
  // auth0 path: validate Auth0 session cookie / JWT — see 06-auth0.md
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

```
app/
  layout.tsx                   # root layout, fonts, providers
  page.tsx                     # landing
  signup/page.tsx              # role picker (Distributor / Client)
  distributor/
    layout.tsx                 # role-gated: requireRole(session, 'distributor')
    page.tsx                   # dashboard
    sites/page.tsx             # site list + add site
    sites/[id]/verify/page.tsx # verification instructions
  client/
    layout.tsx                 # role-gated: requireRole(session, 'client')
    page.tsx                   # dashboard
    jobs/page.tsx              # job list
    jobs/new/page.tsx          # job submission (Gemma translator)
    jobs/[id]/page.tsx         # job detail + live results
  api/
    auth/stub/route.ts                  # POST stub login (AUTH_MODE=stub only)
    auth/[auth0]/route.ts               # Auth0 catch-all callbacks (AUTH_MODE=auth0)
    sites/route.ts                      # POST create site
    sites/[id]/verify/route.ts          # GET poll verification, POST trigger check
    slots/route.ts                      # POST create slot
    embed/[slotId]/config/route.ts      # GET runtime config (paymentAddress + joinSecret) — see 04-embed.md
    jobs/route.ts                       # POST create job
    jobs/[id]/stream/route.ts           # GET SSE stream (Client dashboard)
    jobs/[id]/accepted/route.ts         # POST callback: DCP scheduler accepted the job
    jobs/[id]/status/route.ts           # POST callback: status tick from submit worker
    jobs/[id]/slice-result/route.ts     # POST callback: one slice completed (body has sliceIndex + phase)
    jobs/[id]/slice-error/route.ts      # POST callback: one slice failed
    jobs/[id]/done/route.ts             # POST callback: verifier complete, body has winners
    jobs/[id]/failed/route.ts           # POST callback: job failed before completion
    distributors/[id]/stream/route.ts   # GET SSE stream (Distributor dashboard earnings ticks)

# All /api/jobs/[id]/* and /api/distributors/[id]/stream callbacks from the submit worker
# require Authorization: Bearer ${DCP_WORKER_SHARED_SECRET} — see 06-auth0.md.
```

## Design system (FE, ~3h, parallel with BE work)

- `globals.css` with `@theme` tokens (CSS-first per Tailwind v4 if available, else config)
- Init shadcn/ui: `npx shadcn-ui@latest init`
- Add components: `button`, `card`, `input`, `select`, `dialog`, `tabs`, `table`
- Build `AppShell` component: topbar (logo, role badge, sign-out) + sidebar (role-aware nav) + content slot

## Running locally (4 processes)

| Process | Port | Command (run from each dir) |
|---|---|---|
| Next.js app | 3000 | `cd strata && npm run dev` |
| DCP submit worker | 3001 | `cd dcp-submit-worker && npm run dev` — see [03-dcp-integration.md](03-dcp-integration.md) |
| Demo site (fake ML blog) | 5174 | `cd demo-site && npx serve -l 5174` |
| ngrok (so DCP can call back to localhost:3001) | — | `ngrok http 3001` then paste the https URL into `DCP_SUBMIT_WORKER_URL` in `strata/.env.local` |

Optional 5th: `npx prisma studio` on 5555 for inspecting DB during dev.

For the demo, set `DCP_SUBMIT_WORKER_URL` to the ngrok URL (or the Vultr public URL). The Next.js app POSTs to `${DCP_SUBMIT_WORKER_URL}/submit` with the job spec; the submit worker POSTs back to the Vercel preview URL (or `http://localhost:3000` during dev — but DCP scheduler can't reach localhost, so use ngrok in reverse for that direction too if testing real DCP, OR run the submit worker on the same machine as Next.js dev and use `http://localhost:3000`).

## Phase 1 exit criteria

- [ ] `npm run build` green on Vercel preview deploy
- [ ] Landing page renders, two signup buttons work in stub mode
- [ ] Clicking Distributor → lands on `/distributor` with role-gated layout
- [ ] Clicking Client → lands on `/client` with role-gated layout
- [ ] Prisma migrations applied, can create User row via stub login
- [ ] Sign-out clears cookie and redirects home

## Why Next.js (not separate Express + Vite)

- One deploy target (Vercel) instead of two (Vercel + separate API host)
- Server Components let us read DB directly in dashboards without an API call
- Route handlers cover the small REST surface; SSE works natively via streaming responses
- Auth0 has a first-class Next.js SDK
- Prisma Client tree-shakes well in Next.js
- The DCP submit worker is the ONLY thing that lives outside the Next.js app, because it needs `~/.dcp/` keystores and a long-lived process — see [03-dcp-integration.md](03-dcp-integration.md)
