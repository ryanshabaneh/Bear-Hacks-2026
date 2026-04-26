# Demo Script (5 minutes)

## Pre-stage checklist (before judges arrive)

- [ ] 6 team laptops opened to `demo-site/` with embed.js loaded — Gemma model warm (cached)
- [ ] Backend running: `node backend/src/index.js`
- [ ] Frontend running: `vite --port 5173`
- [ ] Client account pre-logged-in as "Sarah" on presenter laptop
- [ ] Distributor account pre-logged-in on second tab/window
- [ ] AIME 2024 problem set pre-loaded in the Client dashboard's template
- [ ] Fake single-shot answers pre-computed (to show the contrast)
- [ ] WebSocket connection verified green

## Live demo order

### Step 1 — Sarah submits a job (60s)

Open Client dashboard (already logged in).

Say: *"Sarah is an ML PhD student. She wants to evaluate Gemma on 30 AIME math problems with 8 rollouts each — that's 240 inference calls. On AWS that's $1,200."*

Type in the plain-English box:
> "Evaluate Gemma on AIME 2024 with N=8 rollouts per problem"

Click **Translate →**. Gemma emits JSON on screen. Pause on it briefly.

Click **Submit Job**. Show the confirmation: *"240 slices · Est. $90"*.

Say: *"240 slices just dispatched to DCP."*

### Step 2 — Switch to Distributor dashboard (45s)

Open second tab: Distributor dashboard for "ML Blog".

Say: *"Meanwhile, someone is reading an ML blog. They loaded the page — one script tag, that's it."*

Watch earnings ticks appear: *+$0.12, +$0.12, +$0.09...*

Say: *"Every time a visitor's browser completes a slice, the blog owner earns DCC. No ads. No tracking. Just compute."*

### Step 3 — Switch back to Client, watch results stream (90s)

Return to Client dashboard. Results table is populating row by row.

Say: *"Results are streaming back as slices complete. Each row is one AIME problem."*

Let it run for 30–45 seconds. Point out a few rows where single-shot was wrong but swarm got it right.

### Step 4 — Completion panel (45s)

Job finishes. Completion panel animates in.

Read aloud:
- *"Single-shot accuracy: 23%"*
- *"Swarm accuracy: 58%"*
- *"+35 percentage points improvement"*
- *"Total cost: $87.40. That's 14x cheaper than AWS."*

Pause for effect.

### Step 5 — Optional: show the embed (45s)

Open `http://localhost:5174` (demo-site, fake ML blog).

Show the footer chip: *"This site is supported by your idle compute."*

Click **What's this?** — show the explainer modal.

Open DevTools → Network tab. Show Gemma model chunks that were downloaded.

Say: *"The visitor's GPU is doing real AI inference. They don't see it, they don't feel it, and the site owner gets paid."*

## What to cut if running long

- Skip Step 5 (embed demo)
- Skip verbose JSON explanation in Step 1 — just say "Gemma translates plain English to a job spec"
- Pre-fill the text box so you don't have to type live

## Talking points for Q&A

- *Why DCP?* — DCP is the only production distributed compute network that runs in browsers natively. We don't run any compute servers.
- *Is Gemma actually running in the browser?* — Yes. WebGPU + ONNX. The tessera-test in our repo proves it.
- *How does Gemma get into the DCP sandbox?* — DCP sandboxes are Web Workers. We pre-warm the model in IndexedDB.
- *What happens if a visitor leaves mid-slice?* — DCP scheduler reassigns the slice to another worker. Fault-tolerant by design.
- *Isn't this mining?* — No. It's compute-for-hire. The user sees a clear disclosure chip and can pause at any time.
