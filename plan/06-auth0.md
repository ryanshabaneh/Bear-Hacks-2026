# Auth0 Integration — Next.js 16 + SDK v4

Strata supports two auth modes. Develop in `stub`, demo in `auth0`.

Owner: BE2.

> **Stack lock:** `@auth0/nextjs-auth0` v4.19 + Next.js 16.2 App Router. The v4 surface is **completely different** from v3 (no `handleAuth`/`handleLogin` factories, no `/api/auth/[auth0]/route.ts` catch-all). v4 mounts `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/profile`, `/auth/access-token` automatically through a `proxy.ts` interceptor.

## Two account types

Both Distributors and Clients use the same Auth0 tenant. The role lives in a custom `account_type` claim on the access + ID tokens.

Nodes (visitor browsers) have **no Auth0 account** — they're anonymous. This is intentional and unique to Strata.

## Auth0 tenant setup (do at preflight, see [01-preflight.md](01-preflight.md))

1. Create tenant `strata-bearhacks-2026.auth0.com`
2. Create application "Strata" (Regular Web Application — not SPA, since Next.js does the OAuth dance server-side)
3. Set Allowed Callback URLs (note: SDK v4 default is `/auth/callback`, NOT `/api/auth/callback`):
   ```
   http://localhost:3000/auth/callback,
   https://strata-*.vercel.app/auth/callback,
   https://strata.app/auth/callback
   ```
4. Set Allowed Logout URLs:
   ```
   http://localhost:3000,
   https://strata-*.vercel.app,
   https://strata.app
   ```
5. Create API: identifier (audience) = `https://strata-api`
6. Add a **Login Action** (post-login trigger) for the `account_type` claim. The Distributor vs Client choice arrives via `app_metadata.account_type`, set on first login from the `/auth/login?account_type=...` query the SDK forwards as a custom param:

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://strata.app/';
  let accountType = event.user.app_metadata?.account_type;
  if (!accountType) {
    accountType = event.request.query?.account_type === 'distributor' ? 'distributor' : 'client';
    api.user.setAppMetadata('account_type', accountType);
  }
  api.idToken.setCustomClaim(namespace + 'account_type', accountType);
  api.accessToken.setCustomClaim(namespace + 'account_type', accountType);
};
```

7. Activate the Action in the Login flow.

> **Why `app_metadata` not `user_metadata`:** `account_type` is an authorization claim, not a user preference. `user_metadata` is writable by the user via the Management API; using it here would let a Client self-promote to Distributor. `app_metadata` is server-only.

## Next.js integration (`@auth0/nextjs-auth0` v4.19, Next.js 16 App Router)

```bash
npm i @auth0/nextjs-auth0@4.19.0
```

`.env.local`:
```
AUTH_MODE=auth0
AUTH0_SECRET=<openssl rand -hex 32>
AUTH0_DOMAIN=strata-bearhacks-2026.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://strata-api
AUTH0_SCOPE='openid profile email'
APP_BASE_URL=http://localhost:3000
```

(Vercel preview deployments: omit `APP_BASE_URL` so the SDK infers from request host. Auth0's Allowed Callback URLs list is the safety net.)

In v4 the SDK is a single client object you instantiate once and call from `proxy.ts`. There is no `handleAuth`/`handleLogin` factory and no `/api/auth/[auth0]/route.ts` catch-all. The SDK auto-mounts `/auth/login`, `/auth/logout`, `/auth/callback`, `/auth/profile`, `/auth/access-token`, `/auth/backchannel-logout`.

[src/lib/auth0.ts]:
```ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client();
```

[proxy.ts] (project root, Next.js 16 convention — replaces `middleware.ts`):
```ts
import { auth0 } from '@/lib/auth0';

export async function proxy(request: Request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
```

Signup buttons are plain `<a>` tags (not `<Link>` — client-side routing breaks the redirect dance) pointing at `/auth/login` with query params the SDK forwards to Auth0:

```tsx
<a href="/auth/login?screen_hint=signup&account_type=distributor&returnTo=/distributor">
  Sign up as Distributor
</a>
<a href="/auth/login?screen_hint=signup&account_type=client&returnTo=/client">
  Sign up as Client
</a>
<a href="/auth/login?returnTo=/distributor">Log in (Distributor)</a>
<a href="/auth/login?returnTo=/client">Log in (Client)</a>
```

The `account_type` query param flows to the Auth0 Action via `event.request.query` (see Login Action above). `returnTo` is honored by the SDK on callback.

## Unified `getSession()` (replaces stub-only version from [02-skeleton.md](02-skeleton.md))

[src/lib/auth.ts]:
```ts
import { cookies } from 'next/headers';
import { auth0 } from './auth0';
import { prisma } from './db';

export type Session = {
  userId: string;
  email: string;
  role: 'distributor' | 'client' | 'admin';
};

export async function getSession(): Promise<Session | null> {
  if (process.env.AUTH_MODE === 'stub') {
    const cookieStore = await cookies();
    const c = cookieStore.get('strata-stub-session');
    return c ? JSON.parse(c.value) : null;
  }

  const a0 = await auth0.getSession();
  if (!a0?.user) return null;

  const sub = a0.user.sub;
  const email = a0.user.email;
  if (!sub || !email) return null;

  const role = (a0.user['https://strata.app/account_type'] as Session['role']) ?? 'client';

  const user = await prisma.user.upsert({
    where: { auth0Sub: sub },
    update: { email },
    create: { auth0Sub: sub, email, role },
  });
  return { userId: user.id, email, role };
}

export function requireRole(session: Session | null, role: Session['role']) {
  if (!session) throw new Response('Unauthorized', { status: 401 });
  if (session.role !== role) throw new Response('Forbidden', { status: 403 });
}
```

Notes:
- `cookies()` is async in Next.js 15+; await it before `.get()`.
- `auth0.getSession()` reads from cookies internally — no argument needed in App Router server components, route handlers, and server actions.
- The role upsert race is benign: Prisma `upsert` is atomic on the unique `auth0Sub` constraint. Concurrent first-logins from the same sub will collapse to one row.
- Treat missing `account_type` claim as `client` (safer default than throwing — the Action sets it on first login, but stale tokens from before the Action was deployed will lack it).

## Role-gated layouts

`app/distributor/layout.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/auth/login?returnTo=/distributor');
  if (session.role !== 'distributor') redirect('/client');
  return <AppShell role="distributor">{children}</AppShell>;
}
```

Mirror for `app/client/layout.tsx`. Note the redirect target is `/auth/login` (SDK v4 mount point), not `/api/auth/loginDistributor`.

## SSE authentication

`EventSource` doesn't support custom headers, so SSE auth piggy-backs on the auth cookie (Auth0 SDK v4 session cookie or stub cookie). Both are httpOnly + sameSite=lax — included automatically on same-origin SSE requests. Cross-origin SSE (e.g. from a Distributor's embedded site) is not supported by this auth path; that's intentional, as Node browsers don't authenticate.

[app/api/forecasts/[id]/stream/route.ts] — note the route uses `forecasts`, not `jobs`:
```ts
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!forecast || forecast.client.userId !== session.userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const stream = new ReadableStream({ /* see 03-dcp-integration.md */ });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

`X-Accel-Buffering: no` is required for nginx/Vercel edge proxies to flush event chunks instead of buffering. Same pattern for `/api/distributors/[id]/stream`. Note `params` is a Promise in Next.js 15+ App Router — await it.

### Why `/api/forecasts/` not `/api/jobs/`

Routes follow the atmospheric vocabulary lock: user-facing copy uses **Forecast** for the job spec, **Slice** for one chunk of work, **Catchment** for the assembled bundle. Code-side primitives match (`Forecast` Prisma model, `Slice` rows, `Catchment` deliverable), so routes that surface in URLs — which are user-visible in the browser bar, in shareable links, in error messages — match the user-facing register. Internal scheduler-to-Strata callbacks stay technical-flavored (`/api/scheduler/slice-callback`); those are protocol surfaces, not user-facing.

## DCP submit worker → Next.js callback authentication

The submit worker POSTs to the single canonical `/api/scheduler/slice-callback` endpoint. Server-to-server, no Auth0 involved. Use a shared secret with constant-time compare:

```
# .env.local (Next.js) AND dcp-submit-worker/.env
DCP_WORKER_SHARED_SECRET=<openssl rand -hex 32>
```

In submit worker (already shown in [03-dcp-integration.md](03-dcp-integration.md)):
```js
fetch(`${callbackUrl}/api/scheduler/slice-callback`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

In Next.js callback handler (constant-time compare to avoid timing-attack surface):
```ts
import { timingSafeEqual } from 'node:crypto';

const auth = req.headers.get('authorization') ?? '';
const expected = `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`;
const a = Buffer.from(auth);
const b = Buffer.from(expected);
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  return new Response('Unauthorized', { status: 401 });
}
```

(String `===` on a secret is a timing-attack surface even if low-stakes for hackathon. Cheap fix.)

## Switching AUTH_MODE for the demo

For Phase 1-3 development, leave `AUTH_MODE=stub`. At T+22 (Phase 4 start), flip to `AUTH_MODE=auth0` on Vercel preview, run through the full signup flow once. Both account types should land on their respective dashboards.

If Auth0 misbehaves during demo: flip back to `AUTH_MODE=stub` on Vercel, redeploy. Pre-staged demo accounts work in both modes since `getSession()` returns the same shape.

## Env vars summary

```
# Common
AUTH_MODE=stub|auth0
DATABASE_URL=...

# Stub mode only
NEXTAUTH_SECRET=...

# Auth0 mode only (SDK v4 names — NOT the v3 names)
AUTH0_SECRET=...
AUTH0_DOMAIN=strata-bearhacks-2026.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://strata-api
AUTH0_SCOPE='openid profile email'
APP_BASE_URL=http://localhost:3000   # omit on Vercel preview, set on prod

# Server-to-server (Strata Distributor callback bus)
DCP_WORKER_SHARED_SECRET=...
DCP_SUBMIT_WORKER_URL=https://...ngrok.app
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=...

# Frontend
NEXT_PUBLIC_STRIPE_PK=pk_test_...     # Stripe Connect test mode for Distributor payouts
WHISPER_MODEL_CDN_URL=https://cdn.strata.app/runtime/
```
