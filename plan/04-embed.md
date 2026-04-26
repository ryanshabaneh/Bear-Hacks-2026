# Embed Runtime — strata.js + iframe + DCP Worker

The script Distributors paste into their `<head>`. Visitor browsers (Nodes — no account, no PII) become DCP workers and run Gemma slices.

Owner: BE1 (loader + iframe), FE (footer chip + explainer modal).

## Two-tier architecture

The embed splits into a tiny IIFE loader (parent page) and a runtime iframe (Strata-controlled origin):

- **`strata.js`** — IIFE injected by Distributor's `<script>` tag. Reads `data-slot` attribute, injects an iframe pointing at `https://embed.strata.dev/runtime.html?slot=<slotId>`, injects the footer chip into the parent page. ~2KB.
- **`runtime.html`** (in iframe) — loads `dcp-client`, calls `worker.start()`, runs Gemma slices in DCP sandboxes inside the iframe. **All compute happens here**, isolated from the host site's DOM and CSP.

This separation matters because:
- Host sites have unpredictable CSP — putting `dcp-client.js` in the parent could be blocked
- DCP sandboxes are Web Workers; they need `self.crossOriginIsolated`-style guarantees that we can give in our own iframe origin
- The host site never directly executes our code beyond the loader

## What Distributors paste

```html
<script src="https://embed.strata.dev/strata.js" data-slot="SLOT_ID" async></script>
```

`SLOT_ID` is the ComputeSlot id, displayed in the Distributor dashboard.

## strata.js (loader IIFE)

```js
// embed/strata.js — served from Cloudflare Pages, immutable + hashed
(() => {
  const tag = document.currentScript;
  const slotId = tag?.getAttribute('data-slot');
  if (!slotId) { console.warn('[strata] missing data-slot'); return; }
  if (window.__STRATA_LOADED__) return;
  window.__STRATA_LOADED__ = true;

  // 1. Inject runtime iframe (hidden)
  const iframe = document.createElement('iframe');
  iframe.src = `https://embed.strata.dev/runtime.html?slot=${encodeURIComponent(slotId)}`;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
  iframe.title = 'Strata compute runtime';
  document.body.appendChild(iframe);

  // 2. Inject footer chip
  const chip = document.createElement('div');
  chip.id = 'strata-chip';
  chip.innerHTML = `
    <span class="strata-chip-text">This site is supported by your idle compute.</span>
    <button class="strata-chip-pause" data-action="pause">Pause</button>
    <a class="strata-chip-info" href="https://strata.dev/what-is-this" target="_blank" rel="noopener">What's this?</a>
  `;
  document.body.appendChild(chip);

  // 3. Inject minimal styles (inline, no external CSS request)
  const style = document.createElement('style');
  style.textContent = `
    #strata-chip { position:fixed; bottom:12px; right:12px; z-index:2147483647;
      background:#0a0a0a; color:#fff; font:13px system-ui,sans-serif; padding:8px 12px;
      border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.2); display:flex; gap:10px; align-items:center; }
    #strata-chip a, #strata-chip button { color:#9ca3af; background:none; border:none; cursor:pointer;
      font:inherit; padding:0; text-decoration:underline; }
    #strata-chip a:hover, #strata-chip button:hover { color:#fff; }
  `;
  document.head.appendChild(style);

  // 4. Wire pause button → postMessage to iframe
  chip.querySelector('[data-action="pause"]').addEventListener('click', (e) => {
    const btn = e.target;
    const paused = btn.dataset.paused === '1';
    btn.dataset.paused = paused ? '0' : '1';
    btn.textContent = paused ? 'Pause' : 'Resume';
    iframe.contentWindow?.postMessage({ type: paused ? 'resume' : 'pause' }, 'https://embed.strata.dev');
  });
})();
```

## runtime.html (the actual worker)

Served by Cloudflare Pages at `https://embed.strata.dev/runtime.html`. Receives `slot=<slotId>` query param, fetches its config (including the bake-in joinSecret) from the Strata API, then starts a DCP worker.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Strata runtime</title>
  <script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
</head>
<body>
<script type="module">
  const params = new URLSearchParams(location.search);
  const slotId = params.get('slot');
  if (!slotId) throw new Error('missing slot');

  // Fetch slot config — this returns paymentAddress + signed joinSecret token
  const cfg = await fetch(`https://strata.dev/api/embed/${encodeURIComponent(slotId)}/config`).then(r => r.json());
  if (!cfg.active) { console.log('[strata] slot inactive'); return; }

  const worker = new dcp.worker.Worker({
    paymentAddress:      cfg.paymentAddress,
    maxWorkingSandboxes: 1,
    computeGroups: [{ joinKey: cfg.joinKey, joinSecret: cfg.joinSecret }],
  });

  worker.on('payment', (ev) => {
    if (ev.accepted) parent.postMessage({ type: 'strata:tick', amount: ev.payment }, '*');
  });
  worker.on('error', (e) => console.error('[strata] worker err', e));

  // Pause/resume from parent
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.ancestorOrigins[0]) return; // host site only
    if (ev.data?.type === 'pause')  worker.stop();
    if (ev.data?.type === 'resume') worker.start();
  });

  await worker.start();
})();
</script>
</body>
</html>
```

## Compute Group secret bake-in

The `joinSecret` cannot live in the static `runtime.html`. It's served per-slot by the Strata API, scoped to that Distributor's slot:

[app/api/embed/[slotId]/config/route.ts]:
```ts
export async function GET(req: Request, { params }: { params: { slotId: string } }) {
  const slot = await prisma.computeSlot.findUnique({
    where: { id: params.slotId },
    include: { distributor: true },
  });
  if (!slot || !slot.active) {
    return Response.json({ active: false }, { headers: corsHeaders() });
  }
  return Response.json({
    active:         true,
    paymentAddress: slot.distributor.dcpPaymentAddress, // store on Distributor
    joinKey:        process.env.STRATA_GROUP_KEY,
    joinSecret:     process.env.STRATA_GROUP_SECRET,    // intentionally exposed to runtime origin only
  }, { headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://embed.strata.dev',
    'Cache-Control': 'no-store',
  };
}
```

CORS locks the config endpoint to the runtime origin. Anyone CAN still fetch via curl and see the secret — for hackathon this is acceptable. For production: use signed short-lived JWTs from Strata API, exchanged by the runtime iframe via a server-side join helper.

## Footer chip states

| State | Text | Color |
|---|---|---|
| Idle (no slice) | "This site is supported by your idle compute." | grey |
| Running slice | "Computing… (slice 3/?)" | green dot |
| Paused | "Compute paused — site relies on this revenue." | amber |
| Error | "Compute unavailable." | red |

State updates come from `runtime` iframe via postMessage to parent.

## Explainer modal ("What's this?")

Opens a Strata-hosted modal at `https://strata.dev/what-is-this` with:
- One-paragraph explainer
- "Pause on this site" / "Pause on all sites" buttons (sets a `__strata_paused` cookie on `.strata.dev`; runtime iframe checks it on load)
- Link to docs

## Cold-start performance (from [tessera-test/index.html](../tessera-test/index.html))

| Scenario | Time |
|---|---|
| First load, no cache | 2–3 min (downloads ~2GB of Gemma weights) |
| Warm load (model cached in browser IndexedDB) | 2–10s |
| Subsequent slices in same session | near-instant (model in memory) |

**For demo:** pre-warm 6 team laptops at least 30 min before judging. Keep tabs open. See [01-preflight.md](01-preflight.md) and [07-demo-script.md](07-demo-script.md).

## Files

```
embed/                        # Cloudflare Pages
  strata.js                   # IIFE loader, ~2KB minified
  runtime.html                # iframe content with dcp-client + worker
  what-is-this.html           # explainer modal page
```

## Test page

For dev, a static HTML page in `demo-site/` includes the script tag. See [05-frontend.md](05-frontend.md#demo-site).
