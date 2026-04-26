# Auth0 Integration — Next.js + Stub Mode

Strata supports two auth modes. Develop in `stub`, demo in `auth0`.

Owner: BE2.

## Two account types

Both Distributors and Clients use the same Auth0 tenant. The role lives in a custom `account_type` claim on the access + ID tokens.

Nodes (visitor browsers) have **no Auth0 account** — they're anonymous. This is intentional and unique to Strata.

## Auth0 tenant setup (do at preflight, see [01-preflight.md](01-preflight.md))

1. Create tenant `strata-bearhacks-2026.auth0.com`
2. Create application "Strata" (Regular Web Application — not SPA, since Next.js does the OAuth dance server-side)
3. Set Allowed Callback URLs:
   ```
   http://localhost:3000/api/auth/callback,
   https://strata-*.vercel.app/api/auth/callback,
   https://strata.dev/api/auth/callback
   ```
4. Set Allowed Logout URLs (same hosts, no `/api/auth/callback`)
5. Create API: identifier (audience) = `https://strata-api`
6. Add a **Login Action** (post-login trigger) for the `account_type` claim:

```js
// Auth0 Action: post-login → set account_type claim
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://strata.dev/';
  let accountType = event.user.user_metadata?.account_type;
  if (!accountType) {
    accountType = event.request.query?.account_type || 'client';
    api.user.setUserMetadata('account_type', accountType);
  }
  api.idToken.setCustomClaim(namespace + 'account_type', accountType);
  api.accessToken.setCustomClaim(namespace + 'account_type', accountType);
};
```

7. Activate the Action in the Login flow.

## Next.js integration (`@auth0/nextjs-auth0` v3+)

```bash
npm i @auth0/nextjs-auth0
```

`.env.local`:
```
AUTH_MODE=auth0
AUTH0_SECRET=<openssl rand -hex 32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://strata-bearhacks-2026.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://strata-api
AUTH0_SCOPE='openid profile email'
```

Catch-all route at [app/api/auth/[auth0]/route.ts]:
```ts
import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  signupDistributor: handleLogin({
    authorizationParams: { screen_hint: 'signup', account_type: 'distributor' },
    returnTo: '/distributor',
  }),
  signupClient: handleLogin({
    authorizationParams: { screen_hint: 'signup', account_type: 'client' },
    returnTo: '/client',
  }),
  loginDistributor: handleLogin({ returnTo: '/distributor' }),
  loginClient:      handleLogin({ returnTo: '/client' }),
});
```

Signup buttons link to `/api/auth/signupDistributor` or `/api/auth/signupClient`.

## Unified `getSession()` (replaces stub-only version from [02-skeleton.md](02-skeleton.md))

[src/lib/auth.ts]:
```ts
import { cookies } from 'next/headers';
import { getSession as getAuth0Session } from '@auth0/nextjs-auth0';
import { prisma } from './db';

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
  // auth0 path
  const a0 = await getAuth0Session();
  if (!a0?.user) return null;
  const role = a0.user['https://strata.dev/account_type'] as Session['role'];

  // Sync Auth0 user → DB User row (idempotent)
  const user = await prisma.user.upsert({
    where: { auth0Sub: a0.user.sub },
    update: { email: a0.user.email },
    create: { auth0Sub: a0.user.sub, email: a0.user.email!, role },
  });
  return { userId: user.id, email: a0.user.email!, role };
}

export function requireRole(session: Session | null, role: Session['role']) {
  if (!session) throw new Response('Unauthorized', { status: 401 });
  if (session.role !== role) throw new Response('Forbidden', { status: 403 });
}
```

## Role-gated layouts

`app/distributor/layout.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DistributorLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/api/auth/loginDistributor');
  if (session.role !== 'distributor') redirect('/client');
  return <AppShell role="distributor">{children}</AppShell>;
}
```

Mirror for `app/client/layout.tsx`.

## SSE authentication

`EventSource` doesn't support custom headers, so SSE auth piggy-backs on the auth cookie (Auth0 session cookie or stub cookie). Both are httpOnly + sameSite=lax — included automatically on same-origin SSE requests.

[app/api/jobs/[id]/stream/route.ts]:
```ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  // Authorization: only the job's owner can subscribe
  const job = await prisma.job.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!job || job.client.userId !== session.userId) return new Response('Forbidden', { status: 403 });

  const stream = new ReadableStream({ /* ... */ });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
```

Same pattern for `/api/distributors/[id]/stream`.

## DCP submit worker → Next.js callback authentication

The submit worker POSTs slice results back to `/api/jobs/[id]/slice-result` (and the other six callback routes listed in [02-skeleton.md](02-skeleton.md#routes-app-router)). This is server-to-server, no Auth0 involved. Use a shared secret:

```
# .env.local (Next.js) AND dcp-submit-worker/.env
DCP_WORKER_SHARED_SECRET=<openssl rand -hex 32>
```

In submit worker:
```js
fetch(`${callbackUrl}/api/jobs/${jobId}/slice-result`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

In Next.js callback handler:
```ts
const auth = req.headers.get('authorization');
if (auth !== `Bearer ${process.env.DCP_WORKER_SHARED_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

## Switching AUTH_MODE for the demo

For Phase 1–3 development, leave `AUTH_MODE=stub`. At T+22 (Phase 4 start), flip to `AUTH_MODE=auth0` on Vercel preview, run through the full signup flow once. Both account types should land on their respective dashboards.

If Auth0 misbehaves during demo: flip back to `AUTH_MODE=stub` on Vercel, redeploy. Pre-staged demo accounts work in both modes since `getSession()` returns the same shape.

## Env vars summary

```
# Common
AUTH_MODE=stub|auth0
DATABASE_URL=...

# Stub mode only
NEXTAUTH_SECRET=...

# Auth0 mode only
AUTH0_SECRET=...
AUTH0_BASE_URL=...
AUTH0_ISSUER_BASE_URL=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://strata-api

# Server-to-server
DCP_WORKER_SHARED_SECRET=...
DCP_SUBMIT_WORKER_URL=https://...ngrok.app
STRATA_GROUP_KEY=strata-2026
STRATA_GROUP_SECRET=...

# Frontend
NEXT_PUBLIC_HF_TOKEN=hf_...     # Gemma 4 translator
NEXT_PUBLIC_STRIPE_PK=pk_test_... # Stripe test mode
```
