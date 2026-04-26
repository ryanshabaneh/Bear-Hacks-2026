# Frontend — Next.js Dashboards

Owner: FE.

Routes are defined in [02-skeleton.md](02-skeleton.md#routes-app-router). This doc covers the UI for each surface.

## Landing page (`/`)

Hero with two CTAs side-by-side:
- "Earn from your site" → `/auth/login?screen_hint=signup&account_type=distributor&returnTo=/distributor`
- "Transcribe at four cents an hour" → `/auth/login?screen_hint=signup&account_type=client&returnTo=/client`

Below the fold: pricing comparison panel (Strata $0.04/audio-hour vs Rev human $90, Rev AI $1.20, OpenAI Whisper API $0.36, AssemblyAI batch $0.12), how-it-works in 3 steps (Forecast → Front → Catchment), prize-track shoutouts (small).

Server-rendered, no auth needed.

## Signup (`/signup`)

Reads `?role=` from URL or shows the picker:

```
┌────────────────────────────────────────────────────────────────────┐
│  Join Strata as...                                                 │
│                                                                    │
│  ┌───────────────────────┐  ┌───────────────────────────────────┐  │
│  │  Distributor          │  │  Client                           │  │
│  │  Host the Sky on      │  │  Transcribe audio at $0.04 per    │  │
│  │  your site. Earn      │  │  hour. Cheaper than Whisper API,  │  │
│  │  AdSense-shape RPM.   │  │  no GPU box to manage.            │  │
│  └───────────────────────┘  └───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

When `AUTH_MODE=stub`: clicking either card POSTs to `/api/auth/stub` with `{ role, email: 'demo+role@strata.app' }`, then redirects to `/distributor` or `/client`.

When `AUTH_MODE=auth0`: signup buttons are plain `<a>` tags pointing at `/auth/login?screen_hint=signup&account_type=<role>&returnTo=<dashboard>`. The SDK v4 forwards the query to Auth0; the post-login Action sets `app_metadata.account_type`. See [06-auth0.md](06-auth0.md).

## Distributor dashboard (`/distributor`)

Server Component fetches sites, slots, settlements (last 7 days) from Prisma. Client Component subscribes to `/api/distributors/[id]/stream` for live SliceTicker.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  myblog.com — earnings                  [Withdraw]          │
│                                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────────┐ │
│  │ AUDIO-HOURS    │ │ THIS WEEK      │ │ SKY DENSITY     │ │
│  │ SERVED (24H)   │ │ $89.40         │ │ 6 active Nodes  │ │
│  │ 142            │ │                │ │                 │ │
│  └────────────────┘ └────────────────┘ └─────────────────┘ │
│                                                              │
│  ─── SliceTicker ─────────────────────────────────────      │
│  ↑ Slice (NA-W) +$0.012   2s ago                            │
│  ↑ Slice (EU)   +$0.012   5s ago                            │
│  ↑ Slice (NA-E) +$0.009   8s ago                            │
│                                                              │
│  ─── Sites ─────────────────────────────────────────────    │
│  myblog.com  ●Active  6 Nodes  [embed snippet ▾]            │
│  + Add site                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Embed snippet panel (per slot)

```
┌──────────────────────────────────────────────────────┐
│  Embed snippet for "myblog.com — sidebar slot"      │
│                                                      │
│  <script src="https://embed.strata.app/strata.js"   │
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
4. "Verify" button POSTs `/api/sites/[id]/verify`. Backend fetches the well-known URL, checks token match, sets `verifiedAt`.
5. After verification, "Create slot" button → `/api/slots` → returns embed snippet.

### SliceTicker component (Client Component)

```tsx
'use client';
import { useEffect, useState } from 'react';

type Tick = { id: string; amountCents: number; regionGlyph: string; at: number };

export function SliceTicker({ distributorId, initial }: { distributorId: string; initial: Tick[] }) {
  const [ticks, setTicks] = useState<Tick[]>(initial);
  useEffect(() => {
    const es = new EventSource(`/api/distributors/${distributorId}/stream`);
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'earnings_tick') {
        setTicks(prev => [
          { id: crypto.randomUUID(), amountCents: msg.amountCents, regionGlyph: msg.regionGlyph ?? '?', at: Date.now() },
          ...prev,
        ].slice(0, 20));
      }
    };
    return () => es.close();
  }, [distributorId]);
  return (
    <ul>
      {ticks.map(t => (
        <li key={t.id}>↑ Slice ({t.regionGlyph}) +${(t.amountCents/100).toFixed(3)} <Ago at={t.at}/></li>
      ))}
    </ul>
  );
}
```

## Client dashboard (`/client`)

Server Component fetches recent Forecasts + balance + tier ceiling. Forecast Composer at `/client/forecasts/new`.

### Forecast Composer (`/client/forecasts/new`)

```
┌─────────────────────────────────────────────────────┐
│  Release a Forecast                                  │
│                                                      │
│  Drop an audio file or paste a URL. We slice it     │
│  into Rain and dispatch it on the next Front.       │
│                                                      │
│  [ Paste RSS ]  [ Paste YouTube ]  [ Upload ]       │
│  ┌──────────────────────────────────────────────┐   │
│  │ https://feeds.example.com/podcast.xml         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Language scope: ( ) English  ( ) Multi  ( ) Trans  │
│  Output formats: [x] SRT [x] VTT [x] JSON [x] plain │
│  Webhook URL (optional): _________________________  │
│                                                      │
│  Estimated: 0.5 audio-hours · ~$0.020 · ETA 2-4 min │
│                                                      │
│  [ Release Forecast → ]                              │
└─────────────────────────────────────────────────────┘
```

Estimate is computed from the input manifest at submit time (see Forecast.audioHoursTotal). Cost = audioHoursTotal × $0.04. ETA is shown as a band, not a fixed time, because it depends on Sky density at dispatch.

### Forecast Detail (`/client/forecasts/[id]`)

Three states driven by `forecast.status`:

**Active (Front opening / Rain falling) — the demo hero:**
```
┌─────────────────────────────────────────────────────┐
│  Front opening. Sky is dispersing slices.            │
│  ███████████░░░░░░░░░  72 / 120 cycles               │
│                                                      │
│  ─── CycleBudgetMeter ─── (barometric gauge)        │
│  1012 mb remaining ($0.014 of $0.020)               │
│                                                      │
│  ─── Catchment assembling ──────────────────────    │
│  00:00:00 → 00:00:30  "Welcome to the show, today…" │
│  00:00:30 → 00:01:00  "we're talking about distri-" │
│  00:01:00 → 00:01:30  [pending]                     │
│  00:01:30 → 00:02:00  "and that's why DCP works."   │
│                                                      │
│  ─── CapabilityBloom ──── (right rail)              │
│  6 Nodes · 4 WebGPU · 2 WASM-SIMD                   │
│                                                      │
│  vs Rev AI ($0.60)   vs Whisper API ($0.18)         │
│  Strata: $0.020                                      │
└─────────────────────────────────────────────────────┘
```

SRT segments populate in **timestamp order, not arrival order**. Counterfactual cost panel ticks live against Rev AI / Whisper API.

**Sealed:**
```
┌─────────────────────────────────────────────────────┐
│  Catchment sealed in 3m 12s.                         │
│  0.5 audio-hours · 60 chunks · $0.020               │
│                                                      │
│  vs Rev human:        $45     (-99.96%)             │
│  vs Rev AI:           $0.60   (-96.7%)              │
│  vs Whisper API:      $0.18   (-88.9%)              │
│  vs AssemblyAI batch: $0.06   (-66.7%)              │
│                                                      │
│  [ Download Catchment (.zip) ]                       │
│  Includes: SRT, VTT, JSON, plain, attestation log   │
└─────────────────────────────────────────────────────┘
```

The "vs Rev human -99.96%" line is the demo payoff. Animates large.

### useForecastStream hook

```ts
// src/lib/useForecastStream.ts
'use client';
import { useEffect, useReducer } from 'react';

export function useForecastStream(forecastId: string, initial: ForecastState) {
  const [state, dispatch] = useReducer(forecastReducer, initial);
  useEffect(() => {
    const es = new EventSource(`/api/forecasts/${forecastId}/stream`);
    es.onmessage = (e) => dispatch(JSON.parse(e.data));
    es.onerror = () => { /* EventSource auto-reconnects; reducer keeps last good state */ };
    return () => es.close();
  }, [forecastId]);
  return state;
}
```
SSE on Vercel has a 5-min cap. Demo Forecasts target ≤5 min, so the native EventSource retry is sufficient. Catch-up snapshot on remount is a stretch.

## Demo site (`demo-site/`)

A static fake creator-content blog hosted separately (Cloudflare Pages or `vercel dev` on a different port) that includes the Strata embed. Used in demo step 6.

```
demo-site/
  index.html    # Blog post: "How I Cut My Podcast Editing Time by 80%"
  post-2.html   # Blog post: "Subtitles Aren't Optional Anymore"
  styles.css    # Minimal blog styling
```

`index.html` outline:
```html
<!doctype html>
<html><head><title>Creator Stack · Indie Podcast Notes</title></head>
<body>
  <header><h1>Indie Podcast Notes</h1><nav>Home · Posts · About</nav></header>
  <article>
    <h2>How I Cut My Podcast Editing Time by 80%</h2>
    <p class="byline">by Maya Patel · Apr 2026 · 8 min read</p>
    <p>3-4 paragraphs of plausible podcaster blog content.</p>
  </article>
  <footer>© 2026 Indie Podcast Notes</footer>

  <!-- Strata embed -->
  <script src="https://embed.strata.app/strata.js" data-slot="DEMO_SLOT_ID" async></script>
</body></html>
```

Two posts is enough texture for the demo. Footer chip should appear bottom-right within 1s of page load.

## Gemma 4 Forecast Composer translator (stretch — MLH track)

Optional plain-English-to-Forecast-spec translator on the Composer screen. User types "transcribe my podcast feed" and Gemma 4 emits a structured Forecast spec. Targets the MLH Best Use of Gemma 4 track. Cheap to wire if BE3's Whisper-WebGPU spike succeeds (same `transformers.js` v3 dependency, just a second pipeline call).

```ts
// src/lib/forecast-translator.ts
'use client';
import { pipeline } from '@huggingface/transformers';

let generator: any = null;

export async function translateToForecastSpec(intent: string): Promise<ForecastSpec> {
  // Demo short-circuit: known phrase returns cached spec, avoids cold-start in front of judges.
  if (/podcast.*RSS|aime|test/i.test(intent)) return demoCachedSpec();

  generator ||= await pipeline('text-generation', 'onnx-community/gemma-3-1b-it-ONNX', {
    dtype: 'q4', device: 'webgpu',
  });
  const prompt = forecastSpecPrompt(intent);
  const result = await generator([{ role: 'user', content: prompt }], { max_new_tokens: 512 });
  return parseForecastSpec(result[0].generated_text);
}
```

Browser-side WebGPU Gemma (not HF inference API) so we don't depend on an external token at demo time. Cold start ~5-8s; pre-warm by visiting `/client/forecasts/new` once during dry-run.

If feasibility blocks (Gemma cold-start in front of judges, structured-JSON output drift), the smoke-and-mirrors version is the demo short-circuit above — type a known phrase, get the cached spec instantly, no live model call. BE2 owns wiring; BE3 confirms WebGPU shape during the Whisper spike. Discard the live path if neither smoke-and-mirrors nor real inference is reliable.

## Settle / billing (mocked)

Stripe Elements in test mode for "fund balance" UI. Card capture works, no real charge:

```tsx
// /client/billing
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
// Use Stripe test publishable key. Balance increment is just `prisma.client.update({ balanceCents: { increment: amount } })`
```

Distributor "Withdraw" button: opens a modal saying "Connecting Stripe Connect…" then "Withdrew $X to bank account ****4242" — pure UI mock.

## Deps

```json
{
  "dependencies": {
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "@prisma/client": "^6.19.3",
    "@auth0/nextjs-auth0": "^4.19.0",
    "@base-ui/react": "^1.4.1",
    "@huggingface/transformers": "^3",
    "shadcn": "^4.5.0",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "zod": "^3"
  },
  "devDependencies": {
    "prisma": "^6.19.3",
    "typescript": "^5",
    "@types/react": "^19",
    "@tailwindcss/postcss": "^4"
  }
}
```

Stripe deps deferred. Add `@stripe/react-stripe-js` only if real Stripe Elements wiring lands in Phase 4.
