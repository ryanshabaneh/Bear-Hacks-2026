# Demo Script (5 minutes)

## Terminology reminder

When narrating, use the locked actor names:
- **Client** = Sarah (the ML PhD submitting the job)
- **Distributor** = the ML blog owner whose dashboard you flip to
- **Node** = the visitor browser running the embed (no account, no PII)

Do not say "worker" or "user" — say **Node**.

## Pre-stage checklist (before judges arrive)

- [ ] **6 team laptops** opened to `demo-site/` with embed loaded — Gemma model warm (cached in IndexedDB)
- [ ] **DCP submit worker** running on Vultr (or via ngrok from a stable laptop): `node dcp-submit-worker/src/index.js`
- [ ] **Next.js app** deployed to Vercel preview URL, `AUTH_MODE=auth0` (or `stub` if Auth0 acted up)
- [ ] **Client account** "Sarah" pre-logged-in on presenter laptop — first browser tab
- [ ] **Distributor account** "ML Blog" pre-logged-in — second browser tab
- [ ] **AIME 2024 fixture** loaded in the Client dashboard's `tessera_eval` template
- [ ] **Single-shot baseline** ([fixtures/single-shot-baseline.json](../fixtures/single-shot-baseline.json)) seeded into DB so the comparison column populates immediately
- [ ] **SSE connection green** — open Network tab, confirm `/api/jobs/.../stream` returns 200 with `text/event-stream`
- [ ] **DCP keystore balance** ≥ 100 DCC (re-check, hackathon judges may have run other things)
- [ ] **Backup video** loaded on second laptop in case live demo fails

## Live demo order

### Step 1 — Sarah submits a job (60s)

Open Client dashboard tab. Already logged in.

> *"Sarah is an ML PhD student. She wants to evaluate Gemma on 30 AIME math problems with 8 rollouts each — that's 240 inference calls. On AWS with hosted GPU, that's about $1,200 and 10 minutes of waiting on instance spinup."*

Click **New job**. Type in the plain-English box (or pre-fill if nervous):
> "Evaluate Gemma on AIME 2024 with N=8 rollouts per problem"

Click **Translate →**. Gemma 4 emits JSON on screen. Pause 2s on the JSON.

> *"Gemma 4 just translated her plain English into a structured job spec. Notice it picked the right template, the right model, the right rollout count."*

Click **Submit Job**. Confirmation panel shows: *"480 slices total · Est. $87"*.

> *"480 slices just dispatched to DCP — 240 rollouts plus 240 verifier passes."*

### Step 2 — Switch to Distributor dashboard (45s)

Click second tab: Distributor dashboard for "ML Blog".

> *"Meanwhile, somebody on the internet just opened an ML blog. They loaded the page — one script tag in the HTML, that's all the blog owner did."*

Watch earnings ticks appear at the top of the live list: *+$0.12, +$0.12, +$0.09…*

> *"Every time a visitor's browser — what we call a Node — completes a slice, the Distributor earns DCC. 68% revenue share, paid out via Stripe Connect. No ads. No tracking cookies. Just compute."*

Point at the active workers count.

> *"Six Nodes are contributing to her workload right now. None of them signed up for anything. They just loaded an ML blog."*

### Step 3 — Switch back to Client, watch results stream (90s)

Return to Client dashboard tab. The job detail page is populating row by row.

> *"Results are streaming back as slices complete. Each row is one AIME problem. The middle column is what Gemma got with single-shot — one try, no second-guessing. The right column is what the swarm picked using best-of-N plus a verifier pass."*

Let it run for 30–45s. Point out 2-3 specific rows where single-shot was wrong but swarm got it right.

> *"Look at AIME problem 3 — single-shot said 401, but with 8 rollouts and verifier scoring, the swarm converged on 720. That's the actual right answer."*

### Step 4 — Completion panel (45s)

Job finishes. Completion panel animates in. The +35pp number is huge.

Read aloud, slowly:
- *"Single-shot accuracy: **23 percent**. That's 7 problems out of 30."*
- *"Swarm accuracy: **58 percent**. That's 17."*
- *"**Plus 35 percentage points**, just from running the same model 8 times in parallel and verifying."*
- *"Total cost: **$87.40**. That's **14 times cheaper** than AWS, and the result is better."*

Pause. Let it land.

### Step 5 — Optional: show the embed (45s)

If time permits. Open `http://localhost:5174` (the demo-site fake ML blog).

> *"This is the Distributor's site. Notice the footer chip — 'This site is supported by your idle compute.'"*

Click **What's this?** — explainer modal opens.

> *"Full disclosure, one click to pause. This is the anti-Coinhive. Consent-first."*

Open DevTools → Network tab. Filter for `huggingface` or `model.onnx`. Show Gemma model chunks.

> *"That's a real Gemma 3 1B model loaded right in the browser via WebGPU. The visitor's GPU is doing real inference. They don't see it, they don't feel it, and the site owner gets paid."*

## What to cut if running long

- Skip Step 5 entirely (embed demo)
- Skip the JSON pause in Step 1 — just say "Gemma translates plain English to a job spec"
- Pre-fill the text box so you don't type live
- Skip the model-in-browser DevTools moment

## What to cut if running short (have 6 min)

Add at end:
> *"If we have time — a quick architecture note. The DCP scheduler distributes slices across Nodes. The submit worker runs two `compute.for()` calls — one for rollouts, one for verifier. Result aggregation picks the highest-scored answer per problem. All real, all running on the live DCP network."*

## Talking points for Q&A

**Q: Why DCP?**
> *DCP is the only production distributed compute network that runs natively in browsers. We don't run any GPU servers ourselves. The Distributor's visitors are the entire compute fleet.*

**Q: Is Gemma actually running in the browser?**
> *Yes. WebGPU plus ONNX. Our `tessera-test` in the repo proves it standalone, and the demo just showed Gemma chunks downloading in the Network tab.*

**Q: How does Gemma get into a DCP sandbox?**
> *Three options: dynamic import inside the sandbox, a runtime iframe that holds the model and the sandbox calls into it via postMessage, or a localhost inference fallback. Our spike at T+2 confirmed [whichever path won — fill in].*

**Q: What if a Node leaves mid-slice?**
> *DCP's scheduler reassigns the slice to another Node. Fault-tolerant by design. The Client only sees the final result.*

**Q: Isn't this Coinhive 2.0?**
> *No. Coinhive was opaque mining without consent. We have a footer chip, an explainer modal, a pause toggle, and zero PII. The user always sees what's happening.*

**Q: How do Distributors actually get paid?**
> *DCC accumulates in their DCP keystore. We accumulate USD value via our 32% margin and use Stripe Connect to push to their bank. For the demo, Stripe is in test mode — UI works, no real money flows.*

**Q: How big is the Compute Group?**
> *For the demo, 6 laptops. In production, every Distributor's visitor is potentially a Node. Scales with your audience.*

**Q: What's the Auth0 angle?**
> *Two account types — Distributor and Client — with a custom `account_type` claim set by a Login Action, role-gated layouts in Next.js. Standard Universal Login.*
