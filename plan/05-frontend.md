# Frontend — Next.js Dashboards

Owner: FE.

Routes are defined in [02-skeleton.md](02-skeleton.md#routes-app-router). This doc covers the UI for each surface.

## Landing page (`/`)

Hero with two CTAs side-by-side:
- "Earn from your site" → `/signup?role=distributor`
- "Run AI workloads cheap" → `/signup?role=client`

Below the fold: comparison panel ("AWS vs Strata: $1200 → $87 for 240 inferences"), how it works (3 steps), prize-track shoutouts (small).

Server-rendered, no auth needed.

## Signup (`/signup`)

Reads `?role=` from URL or shows the picker:

```
┌──────────────────────────────────────────────────────┐
│  Join Strata as...                                   │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │  Distributor       │  │  Client                │  │
│  │  Earn revenue from │  │  Run AI workloads at   │  │
│  │  your site's idle  │  │  1/10th the AWS cost   │  │
│  │  compute           │  │                        │  │
│  └────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

When `AUTH_MODE=stub`: clicking either card POSTs to `/api/auth/stub` with `{ role, email: 'demo+role@strata.dev' }`, then redirects to `/distributor` or `/client`.

When `AUTH_MODE=auth0`: redirects to Auth0 Universal Login with `screen_hint=signup&account_type=<role>`. See [06-auth0.md](06-auth0.md).

## Distributor dashboard (`/distributor`)

Server Component fetches sites, slots, settlements (last 7 days) from Prisma. Client Component subscribes to `/api/distributors/[id]/stream` for live earnings ticks.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ML Blog — earnings              [Withdraw to Stripe]       │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ Today        │ │ This week    │ │ Active workers   │    │
│  │ $14.27       │ │ $89.40       │ │ 6                │    │
│  └──────────────┘ └──────────────┘ └──────────────────┘    │
│                                                              │
│  ─── Live earnings ─────────────────────────────────────    │
│  ↑ Slice +$0.12   2s ago                                    │
│  ↑ Slice +$0.12   5s ago                                    │
│  ↑ Slice +$0.09   8s ago                                    │
│                                                              │
│  ─── Sites ─────────────────────────────────────────────    │
│  myblog.com  ●Active  6 workers  [embed snippet ▾]          │
│  + Add site                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Embed snippet panel (per slot)

```
┌──────────────────────────────────────────────────────┐
│  Embed snippet for "myblog.com — sidebar slot"      │
│                                                      │
│  <script src="https://embed.strata.dev/strata.js"   │
│    data-slot="slot_abc123" async></script>           │
│                                                      │
│  [Copy]                                              │
│                                                      │
│  Status: ● Active  ·  Verified via /.well-known/    │
└──────────────────────────────────────────────────────┘
```

### Add site flow

1. Click "Add site" → modal asks for domain
2. POST `/api/sites` returns `{ siteId, verificationToken }`
3. Modal shows: "Add this file at `https://yourdomain/.well-known/strata.json`:"
   ```json
   { "verification_token": "tok_abc123" }
   ```
4. "Verify" button POSTs `/api/sites/[id]/verify`. Backend fetches the well-known URL, checks token match, sets `verified=true`.
5. After verification, "Create slot" button → `/api/slots` → returns embed snippet.

### Live tick component (Client Component)

```tsx
'use client';
export function LiveTicks({ distributorId, initial }: Props) {
  const [ticks, setTicks] = useState(initial);
  useEffect(() => {
    const es = new EventSource(`/api/distributors/${distributorId}/stream`);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'earnings_tick') {
        setTicks(prev => [{ id: crypto.randomUUID(), amountCents: msg.amountCents, at: Date.now() }, ...prev].slice(0, 20));
      }
    };
    return () => es.close();
  }, [distributorId]);
  return <ul>{ticks.map(t => <li key={t.id}>↑ Slice +${(t.amountCents/100).toFixed(2)} <Ago at={t.at}/></li>)}</ul>;
}
```

## Client dashboard (`/client`)

Server Component fetches recent jobs + balance. Job submission lives at `/client/jobs/new`.

### Job submission (`/client/jobs/new`)

```
┌─────────────────────────────────────────────────────┐
│  Run an AI workload                                  │
│                                                      │
│  Describe what you want to run...                    │
│  ┌──────────────────────────────────────────────┐   │
│  │ "Evaluate Gemma on AIME 2024 with N=8        │   │
│  │  rollouts per problem"                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Or pick a template ▾                                │
│   • Best-of-N reasoning eval                         │
│   • Image batch (coming soon)                        │
│   • Synthetic data (coming soon)                     │
│                                                      │
│  [Translate →]                                       │
└─────────────────────────────────────────────────────┘
```

### After translate (confirmation)

```
┌─────────────────────────────────────────────────────┐
│  Detected: 30 problems × 8 rollouts = 240 slices    │
│  + ~240 verifier slices                              │
│  Estimated cost: $87.40                              │
│  Estimated time: ~4 minutes                          │
│                                                      │
│  Job spec (edit if needed):                          │
│  { "template": "tessera_eval", "model": ...,        │
│    "n_rollouts": 8, "use_verifier": true,           │
│    "input_set": [...30 AIME problems] }             │
│                                                      │
│  [Edit]           [Submit Job →]                     │
└─────────────────────────────────────────────────────┘
```

Translation: client-side call to Gemma 4 via HF inference (`google/gemma-2-9b-it`) with structured prompt. **Cache the demo-script translation** so live demo doesn't depend on HF latency. See [08-risks.md](08-risks.md) Risk 5.

### Job detail (`/client/jobs/[id]`)

Three states driven by `job.status`:

**Running:**
```
┌─────────────────────────────────────────────────────┐
│  Job running  ████████████░░░░░░  147/240 slices    │
│  Time: 2m 14s · Cost so far: $52.10                 │
│                                                      │
│  Phase: rollouts                                     │
│                                                      │
│  Problem      │ Single-shot │ Best so far           │
│  ─────────────────────────────────────────────────  │
│  AIME-I-1     │ 401 ✗       │ 391 (3 votes)         │
│  AIME-I-2     │ 025 ✓       │ 025 (8 votes)         │
│  AIME-I-3     │ — wrong     │ 720 (5 votes)         │
│  AIME-I-4     │ ...         │ pending               │
└─────────────────────────────────────────────────────┘
```

Single-shot column reads from [fixtures/single-shot-baseline.json](../fixtures/single-shot-baseline.json) baked at preflight time (see [01-preflight.md](01-preflight.md)).

**Done — the money shot:**
```
┌─────────────────────────────────────────────────────┐
│  ✓ Job complete  240/240 slices                     │
│  Total cost: $87.40  ·  Time: 4m 32s                │
│                                                      │
│  Single-shot accuracy:  23%   (7/30)                │
│  Swarm accuracy:        58%   (17/30)               │
│                              +35pp                  │
│                                                      │
│  [Download CSV]   [Run again with N=16]             │
└─────────────────────────────────────────────────────┘
```

The "+35pp" number animates large and bold. This is the demo's payoff.

### SSE hook

```ts
// src/lib/useJobStream.ts
'use client';
export function useJobStream(jobId: string, initial: JobState) {
  const [state, dispatch] = useReducer(jobReducer, initial);
  useEffect(() => {
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.onmessage = (e) => dispatch(JSON.parse(e.data));
    es.onerror = () => { /* reconnect handled by EventSource auto-reconnect */ };
    return () => es.close();
  }, [jobId]);
  return state;
}
```

## Demo site (`demo-site/`)

A static fake ML blog hosted separately (Cloudflare Pages or `vercel dev` on a different port) that includes the Strata embed. Used in demo step 6.

```
demo-site/
  index.html    # Blog post: "5 Things I Learned Tuning a Tiny LLM"
  post-2.html   # Blog post: "Why Best-of-N Beats Bigger Models"
  styles.css    # Minimal blog styling
```

`index.html` outline:
```html
<!doctype html>
<html><head><title>Tiny Models, Big Results · ML Blog</title></head>
<body>
  <header><h1>Tiny Models, Big Results</h1><nav>Home · Posts · About</nav></header>
  <article>
    <h2>5 Things I Learned Tuning a Tiny LLM</h2>
    <p class="byline">by Maya Patel · Apr 2026 · 8 min read</p>
    <p>Lorem ipsum… [3-4 paragraphs of plausible ML blog content]</p>
    <pre><code>// code sample</code></pre>
    <p>More body text…</p>
  </article>
  <footer>© 2026 ML Blog</footer>

  <!-- Strata embed -->
  <script src="https://embed.strata.dev/strata.js" data-slot="DEMO_SLOT_ID" async></script>
</body></html>
```

Two posts is enough texture for the demo. Footer chip should appear bottom-right within 1s of page load.

## Gemma 4 translator (client-side)

```ts
// src/lib/translator.ts
export async function translateToJobSpec(userIntent: string): Promise<JobSpec> {
  const prompt = `You are a job spec translator for Strata, a distributed AI compute platform.
Convert the user's intent into a JSON job spec. Output JSON only, no explanation.

User intent: "${userIntent}"

Schema:
{
  "name":         string,
  "template":     "tessera_eval",
  "model":        "onnx-community/gemma-3-1b-it-ONNX",
  "n_rollouts":   number,
  "use_verifier": boolean,
  "input_set":    [{ "id": string, "text": string }]
}`;

  // For demo: if intent matches the canonical demo phrase, return cached spec immediately
  if (/AIME.*N\s*=\s*8/i.test(userIntent)) return demoCachedSpec();

  const response = await fetch('https://api-inference.huggingface.co/models/google/gemma-2-9b-it', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 2048, return_full_text: false } }),
  });
  if (!response.ok) throw new Error('Translation failed');
  const text = (await response.json())[0].generated_text;
  return JSON.parse(extractJSON(text));
}

function demoCachedSpec(): JobSpec {
  // Loaded from fixtures/aime-2024.json at module init
  return cachedDemoSpec;
}
```

`NEXT_PUBLIC_HF_TOKEN` is a free HF inference token. Rate limit is generous but not unlimited — that's why the demo phrase short-circuits to cached.

## Settle / billing (mocked)

Stripe Elements in test mode for "fund balance" UI. Card capture works, no real charge:

```tsx
// /client/billing
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
// Use Stripe test publishable key, ph balance increment is just `prisma.client.update({ balanceCents: { increment: amount } })`
```

Distributor "Withdraw" button: opens a modal saying "Connecting Stripe Connect…" then "Withdrew $X to bank account ****4242" — pure UI mock.

## Deps

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "@prisma/client": "^5",
    "@auth0/nextjs-auth0": "^3",
    "@stripe/react-stripe-js": "^2",
    "@stripe/stripe-js": "^2",
    "zod": "^3",
    "clsx": "^2",
    "tailwindcss": "^3",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-tabs": "^1"
  },
  "devDependencies": {
    "prisma": "^5",
    "typescript": "^5",
    "@types/react": "^18"
  }
}
```
