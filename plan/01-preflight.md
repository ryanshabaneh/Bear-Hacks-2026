# Preflight (T-1 hour → T+0)

Do these BEFORE the hackathon clock starts. Each blocks something downstream.

## 1. DCP keystore + funding (BE3)

DCP keystores can only be created via the Portal (no CLI). Source: [docs/dcp-docs/Wallet API — DCP documentation.md](../docs/dcp-docs/Wallet%20API%20—%20DCP%20%20documentation.md).

Steps:
1. Create an account at https://dcp.cloud
2. In the Portal → Wallet, create two keystores:
   - **`default`** — bank account keystore (will hold DCC, pays for jobs)
   - **`id`** — identity keystore (signs requests)
3. Download both as JSON files; place in `~/.dcp/default.keystore` and `~/.dcp/id.keystore` on the BE3 dev machine AND on the Vultr VM where the DCP submit worker will run
4. Pre-fund the `default` keystore with DCC. Hackathon contact (Distributive sponsor table) can grant a promo balance — ask for at least 5,000 DCC (≈ enough for ~10 full demo runs at 480 slices each)
5. Verify balance: in the Portal Bank tab, OR programmatically:
   ```js
   const wallet = require('dcp/wallet');
   const acct = await wallet.get('default');
   console.log(await acct.getBalance());  // should be > 0
   ```

**Test it works:** run the squaring tutorial from [docs/dcp-docs/Getting started](../docs/dcp-docs/Getting%20started%20—%20DCP%20%20documentation.md) end-to-end. If `await job.exec()` returns `[1, 2809, 4, 144]`, your keystore is funded and DCP works.

## 2. Compute Group provisioning (BE3)

Strata needs a private Compute Group so only embed.js workers pick up Strata jobs.

Steps:
1. In the Portal → Compute Groups, create a group named `strata-2026`
2. Copy the `joinKey` and `joinSecret`
3. Save to `.env` files (NOT committed):
   ```
   STRATA_GROUP_KEY=strata-2026
   STRATA_GROUP_SECRET=<value from portal>
   ```
4. The `joinSecret` will be baked into served embed.js per-Distributor at request time — see [04-embed.md](04-embed.md). Never commit it.

**Fallback if portal can't issue a group in time:** set `job.computeGroups = []` and accept that random DCP workers may pick up slices. Demo still works; the "private fleet" story degrades to "public network."

## 3. AIME 2024 fixture (BE2)

The demo workload is best-of-N reasoning eval on AIME 2024. We need the problems and ground-truth answers in repo so accuracy is computable.

Create [fixtures/aime-2024.json](../fixtures/aime-2024.json):
```json
{
  "problems": [
    { "id": "AIME-2024-I-1", "text": "Find the number of ...", "answer": "204" },
    { "id": "AIME-2024-I-2", "text": "Real numbers x and y ...", "answer": "025" },
    ...30 total
  ]
}
```

Source: AIME 2024 problems are publicly available from AoPS Wiki (https://artofproblemsolving.com/wiki/index.php/2024_AIME_I). 15 problems × 2 papers (I + II) = 30. Answers are 3-digit integers per AIME rules.

**Time-box:** 20 minutes manual transcription, or pull from a HuggingFace dataset like `Maxwell-Jia/AIME_2024` if one matches.

## 4. Single-shot baseline (BE2, parallel with #3)

For the "23% vs 58%" comparison to be honest, run Gemma single-shot on each AIME problem ONCE before the hackathon and cache results.

Create [fixtures/single-shot-baseline.json](../fixtures/single-shot-baseline.json):
```json
{
  "model": "onnx-community/gemma-3-1b-it-ONNX",
  "generated_at": "2026-04-24T18:00:00Z",
  "results": [
    { "id": "AIME-2024-I-1", "answer": "401", "correct": false },
    { "id": "AIME-2024-I-2", "answer": "025", "correct": true },
    ...
  ]
}
```

Run by extending [tessera-test/index.html](../tessera-test/index.html) to loop the 30 problems and dump JSON to clipboard or a file.

Single-shot accuracy is `correct.length / 30`. Expected ~20-30% based on Gemma 3 1B on AIME from public benchmarks. **The actual number that ships in the demo IS the number computed here** — do not hardcode "23%".

## 5. Gemma-in-sandbox spike (BE3 — HIGHEST RISK ITEM)

This is the central technical unknown. Resolve at T+2, not later.

**The question:** can a DCP work function (which is `Function.prototype.toString()`-stringified, then eval'd inside a sandboxed Web Worker) load and run Gemma via `@huggingface/transformers`?

**Three paths to test, in order:**

**Path A — Dynamic import inside the sandbox (BEST if it works):**
```js
async function rolloutWorkFn(input) {
  progress(0);
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest');
  const generator = await pipeline('text-generation', 'onnx-community/gemma-3-1b-it-ONNX', { dtype: 'q4', device: 'webgpu' });
  progress(0.5);
  const result = await generator([{ role: 'user', content: input.problem }], { max_new_tokens: 512 });
  progress(1);
  return { answer: extractAnswer(result), reasoning: result[0].generated_text };
}
```
If the DCP sandbox allows dynamic imports of HTTPS modules and exposes `navigator.gpu`, this works. **Test:** publish a one-slice job in BE3's dev environment and watch for ENOPROGRESS / module-load errors.

**Path B — Pre-load model in the runtime iframe, signal to sandbox via postMessage:**
The runtime iframe (one per page, see [04-embed.md](04-embed.md)) loads Gemma once. The DCP sandbox inside it queries the parent for inference. Requires the work function to use a DCP-exposed messaging primitive — check if `require('dcp/work').postMessage()` exists. Falls back to:

**Path C — Sandbox calls a localhost inference endpoint (FALLBACK):**
The work function does `fetch('http://localhost:8080/infer', { body: JSON.stringify(input) })` to a small HTTP server we run on the demo laptop. Real DCP scheduling, fake distribution. Acceptable for demo if A and B fail. The HTTP server is 30 lines of Express wrapping transformers.js.

**Spike deliverable:** a one-page note in `dcp-submit-worker/SPIKE.md` saying "Path X works because ___" or "all three failed because ___". Locks the architecture for everyone else.

## 6. Auth0 tenant + Vercel project provisioning (BE2)

- Create Auth0 tenant `strata-bearhacks-2026`
- Create SPA application "Strata"
- Create API: audience = `https://strata-api`
- Create Vercel project, link to repo, set environment variables (placeholders fine)
- Note the Vercel preview URL pattern — Auth0 callback URLs need to allow `*.vercel.app` for previews

Detail in [06-auth0.md](06-auth0.md). Just provision now so DNS and tenant exist when BE2 starts wiring.

## 7. Vultr VM + ngrok fallback (BE3)

The DCP submit worker needs a public callback URL so DCP can deliver results back. Two options:
- **Vultr VM**: spin up a $5 instance, install Node.js, expose port 3000 with a domain. Stable. Slow to provision (15 min).
- **ngrok**: run submit worker on dev laptop, `ngrok http 3000` for a public URL. Fast. URL changes on restart.

**Recommendation:** ngrok for the hackathon. Vultr is over-engineering for 36 hours.

## Preflight checklist (sign off before T+0)

- [ ] `~/.dcp/default.keystore` exists and has DCC balance > 1000
- [ ] `~/.dcp/id.keystore` exists
- [ ] Compute Group `strata-2026` created, joinSecret in `.env`
- [ ] [fixtures/aime-2024.json](../fixtures/aime-2024.json) committed (30 problems + answers)
- [ ] [fixtures/single-shot-baseline.json](../fixtures/single-shot-baseline.json) committed (30 single-shot results)
- [ ] `dcp-submit-worker/SPIKE.md` documents which Gemma-in-sandbox path works
- [ ] Auth0 tenant + SPA application created, Vercel project created
- [ ] ngrok account created, authtoken saved
