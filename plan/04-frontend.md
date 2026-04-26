# Frontend — React Dashboards

## Pages / Routes

```
/                   Landing page (hero, "Replace ads / Run AI cheap")
/signup             Auth0 redirect (account type selection)
/client             Client dashboard (job submission + results)
/distributor        Distributor dashboard (earnings + embed snippet)
/demo-site          Fake ML blog with embed active (optional demo step 6)
```

## Client Dashboard (`/client`)

### Job submission panel

```
┌─────────────────────────────────────────────────────┐
│  Run an AI workload                                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Describe what you want to run...             │   │
│  │                                              │   │
│  │ "Evaluate Gemma on AIME 2024 with N=8        │   │
│  │  rollouts per problem"                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌───────────────────┐  ┌──────────────────────┐    │
│  │  Or pick template │  │  Best-of-N eval       │    │
│  └───────────────────┘  │  Image batch          │    │
│                          │  Synthetic data       │    │
│                          └──────────────────────┘    │
│                                                      │
│  [Translate →]                                       │
└─────────────────────────────────────────────────────┘
```

After translation (call to Gemma 4 API or local), show confirmation:

```
┌─────────────────────────────────────────────────────┐
│  Detected: 30 problems × 8 rollouts = 240 slices    │
│  Estimated cost: $90.00                             │
│  Estimated time: ~4 minutes                         │
│                                                      │
│  [Edit]           [Submit Job]                      │
└─────────────────────────────────────────────────────┘
```

### Active job panel (after submit)

Live progress bar + streaming results table:

```
┌─────────────────────────────────────────────────────┐
│  Job running  ████████████░░░░░░░  147/240 slices   │
│  Time: 2m 14s · Cost so far: $52.10                 │
│                                                      │
│  Problem      │ Single-shot │ Swarm (best so far)   │
│  ─────────────────────────────────────────────────  │
│  AIME #1      │ wrong       │ 391 ✓                 │
│  AIME #2      │ 14          │ 14 ✓                  │
│  AIME #3      │ wrong       │ 720 ✓                 │
│  AIME #4      │ ...         │ pending               │
└─────────────────────────────────────────────────────┘
```

### Completion panel

```
┌─────────────────────────────────────────────────────┐
│  ✓ Job complete  240/240 slices                     │
│  Total cost: $87.40  ·  Time: 4m 32s                │
│                                                      │
│  Single-shot accuracy:  23%                         │
│  Swarm accuracy:        58%   (+35pp)               │
│                                                      │
│  [Download CSV]   [Run again with N=16]             │
└─────────────────────────────────────────────────────┘
```

The "+35pp" number should animate in large and bold — this is the money moment in the demo.

### Key React state

```ts
type JobState =
  | { phase: 'idle' }
  | { phase: 'translating' }
  | { phase: 'confirming'; spec: JobSpec }
  | { phase: 'running'; jobId: string; progress: SliceProgress }
  | { phase: 'done'; results: JobResults };

type SliceProgress = {
  computed: number;
  total: number;
  results: SliceResult[];
  elapsedMs: number;
  costUsd: number;
};
```

### WebSocket connection (client dashboard)

```ts
// Hook: useJobStream(jobId)
useEffect(() => {
  if (!jobId) return;
  const ws = new WebSocket(`ws://localhost:3001/jobs/${jobId}/stream`);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'slice_complete') dispatch({ type: 'SLICE_DONE', payload: msg });
    if (msg.type === 'job_done')      dispatch({ type: 'JOB_DONE',   payload: msg });
  };
  return () => ws.close();
}, [jobId]);
```

---

## Distributor Dashboard (`/distributor`)

### Earnings panel (left)

```
┌──────────────────────────────┐
│  ML Blog — earnings          │
│                              │
│  Today:          $14.27      │
│  This week:      $89.40      │
│  Pending payout: $89.40      │
│                              │
│  [Withdraw to Stripe]        │
│                              │
│  ─── Live ───────────────── │
│  ↑ Node #7843 +$0.12  2s ago │
│  ↑ Node #2201 +$0.12  5s ago │
│  ↑ Node #9912 +$0.09  8s ago │
└──────────────────────────────┘
```

Tick events arrive via WebSocket. Each tick animates in at the top of the list.

### Embed snippet panel (right)

```
┌──────────────────────────────────────────────────────┐
│  Your embed snippet                                  │
│                                                      │
│  <script src="https://strata.com/embed.js"          │
│    data-id="abc123"></script>                        │
│                                                      │
│  [Copy]                                              │
│                                                      │
│  Status: ● Active  (verified via /.well-known/)     │
│  Workers active right now: 6                        │
└──────────────────────────────────────────────────────┘
```

### WebSocket connection (distributor dashboard)

```ts
// Hook: useDistributorStream(distributorId)
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'earnings_tick') {
    dispatch({ type: 'ADD_TICK', payload: msg });
    // Also bump today/week totals
  }
};
```

---

## Auth0 integration

```ts
// frontend/src/auth0-config.ts
export const auth0Config = {
  domain:   import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience:     import.meta.env.VITE_AUTH0_AUDIENCE,
  },
};

// Wrap app with Auth0Provider
// After login, read account_type from token claims
// Route to /client or /distributor based on account_type
```

Account type is set in Auth0 via a Login Action (post-login hook) that reads a custom param passed during signup and writes it as a namespace claim: `https://strata.com/account_type`.

---

## Gemma 4 Translator (frontend)

Call the Google Gemma API (via HF inference or Gemini API) with a structured prompt:

```ts
async function translateToJobSpec(userIntent: string): Promise<JobSpec> {
  const prompt = `
You are a job spec translator for Strata, a distributed AI compute platform.
Convert the user's intent into a JSON job spec.

User intent: "${userIntent}"

Output JSON only, no explanation:
{
  "template": "tessera_eval",
  "model": "gemma-3-1b-it",
  "n_rollouts": <number>,
  "use_verifier": true,
  "input_set": [<problem strings>]
}
`;
  const response = await fetch('https://api-inference.huggingface.co/models/google/gemma-2-9b-it', {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF_TOKEN}` },
    body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512 } }),
  });
  const text = await response.json();
  return JSON.parse(extractJSON(text[0].generated_text));
}
```

For the canonical demo, Sarah's input is pre-scripted. The translator either runs or the result is pre-cached. Either way, the JSON appears on screen.

---

## package.json deps

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@auth0/auth0-react": "^2",
    "react-router-dom": "^6"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5"
  }
}
```
