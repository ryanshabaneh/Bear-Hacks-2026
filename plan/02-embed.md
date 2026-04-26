# embed.js — Distributor Worker Node

The script Distributors paste into their `<head>`. Visitors who land on the site silently become DCP workers.

## What Distributors paste

```html
<script src="https://strata.com/embed.js" data-id="DISTRIBUTOR_ID"></script>
```

## embed.js responsibilities

1. Read `data-id` from the script tag → this is the Distributor's payment address
2. Show footer chip UI
3. Load the DCP client from the DCP CDN
4. Register as a DCP Worker in Strata's Compute Group
5. Load the Gemma model (warm-up)

## embed.js skeleton

```js
// embed.js — served from strata backend
(async () => {
  const scriptTag = document.currentScript;
  const distributorId = scriptTag.getAttribute('data-id');
  if (!distributorId) return;

  // 1. Inject footer chip
  injectFooterChip();

  // 2. Load DCP client
  await loadScript('https://scheduler.distributed.computer/dcp-client/dcp-client.js');

  // 3. Init DCP (browser mode — no init() call needed, just use global dcp)
  const { Worker } = dcp;

  // 4. Start worker in Strata's Compute Group
  const worker = new Worker({
    paymentAddress: distributorId,   // Distributor earns DCC here
    computeGroups: [{
      joinKey:    'strata-2026',
      joinSecret: '__STRATA_GROUP_SECRET__',  // baked in at build time
    }],
    maxWorkingSandboxes: 1,
  });

  // 5. Wire up worker events for footer chip updates
  worker.on('payment', (ev) => {
    if (ev.accepted) updateChipEarnings(ev.payment);
  });

  // 6. Start worker
  await worker.start();

  // 7. Pre-warm Gemma in a separate Web Worker / Service Worker
  warmGemma();
})();
```

## Footer chip UI

Injected into the page as a fixed bottom-right element:

```html
<div id="strata-chip">
  This site is supported by your idle compute.
  <button id="strata-pause">Pause</button>
  <a id="strata-info" href="https://strata.com/what-is-this" target="_blank">What's this?</a>
</div>
```

Minimal CSS, z-index above page content. Pause button calls `worker.stop()`.

## Gemma warm-up (worker.js)

The actual Gemma inference runs inside a DCP sandbox (which is a Web Worker). The DCP sandbox will need the model available — the warm-up pre-fetches it so the first slice doesn't have a cold-start penalty.

**Strategy for hackathon demo**: Pre-warm by loading Gemma via transformers.js in a dedicated Web Worker thread before DCP assigns slices. Cache in IndexedDB via the ONNX runtime's built-in cache.

```js
// worker-warmup.js (separate Web Worker)
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

const generator = await pipeline(
  'text-generation',
  'onnx-community/gemma-3-1b-it-ONNX',
  { dtype: 'q4', device: 'webgpu' }
);

// Model is now cached. Signal embed.js that warm-up is done.
self.postMessage({ type: 'ready' });
```

## Cold start times (from tessera-test)

- First load (no cache): 2–3 minutes (downloads ~2GB)
- Warm load (model cached in browser): 2–10 seconds
- Subsequent slices (model in memory): near-instant

**For the demo**: Pre-warm ~6 team laptops before starting. Tell audience the "2 min" number as a one-time cost that drops to seconds for returning visitors.

## Compute Group membership for workers

Embed.js workers must join the same Compute Group that backend job submissions target. The `joinSecret` is baked into embed.js at serve time (not exposed to clients in a way that matters for a hackathon).

## What the DCP sandbox work function receives

When DCP assigns a slice to this worker, it runs the `rolloutWorkFunction` (from backend submission). Inside the sandbox, Gemma must be accessible via `require()`.

**Hackathon simplification**: Since wiring a custom DCP module for Gemma is complex, the work function can use `fetch()` to call a Strata-hosted inference endpoint (simulated), and the "wow" for the demo is that it's running distributed across visitor browsers — with the model *actually loaded* in the browser (show Network tab, show GPU usage).

Or, if DCP module system allows it, publish a Gemma wrapper as a DCP module and `require('strata-gemma')` inside the work function.

## Files

```
embed/
  embed.js          # Entry point, injected by <script> tag
  worker-warmup.js  # Web Worker for model warm-up
  chip.css          # Footer chip styles (inlined in embed.js)
```
