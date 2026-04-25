# Stratus: Ad-Replacement Compute Marketplace on DCP

## Context

BearHacks 2026 hackathon project (April 24-26, 36 hours). Stratus is a three-party compute marketplace built on DCP (Distributed Compute Platform) that replaces ads with distributed compute. Instead of watching ads, end users contribute CPU/GPU cycles to compute jobs submitted by businesses, distributed through platforms like Spotify.

**Prize targets**: Best Use of DCP (primary), Gemma 4 (secondary)
**Tech stack**: TypeScript, React, Next.js, Node.js, DCP, Gemma 4

---

## Architecture Overview

### Three Actors

| Actor | Code | Role |
|-------|------|------|
| **Compute Request Client** | DCPCRC | Business that submits compute jobs, pays DCC |
| **Distribute Client** | DCPDCC | Platform (like Spotify) that distributes slices to users |
| **Execute Client** | DCPEC | End user who computes instead of watching ads |

### Data Flow

```
DCPCRC (Business)              Stratus Backend                DCP Infrastructure
+-----------------+           +------------------+           +------------------+
| Submit job via  |--POST-->  | /api/jobs        |--DCP-->   | Scheduler        |
| work function + |           | Wraps compute.for|           | (slice mgmt)     |
| input set       |           | Stores metadata  |           |                  |
+-----------------+           +------------------+           | Bank             |
                                     |                       | (DCC payments)   |
                                     v                       +------------------+
DCPDCC (Platform)             +------------------+                  |
+-----------------+           | /api/distribute  |                  |
| Receives slice  |<--WS---  | Allocation engine|<--DCP Events-----+
| assignments     |           +------------------+
| Shows to users  |                  |
+-----------------+                  v
       |                      +------------------+
       v                      | /api/compute     |
DCPEC (End User)              | Worker mgmt      |
+-----------------+           | Gemma explain     |
| Browser sandbox |<--embed-- | Trust scoring     |
| Runs DCP Worker |           +------------------+
| Sees Gemma      |
| explanation     |
+-----------------+
```

### Key Design Decisions

1. **Stratus wraps DCP, does NOT replace it.** The DCP Scheduler and Bank still handle slice distribution and payment natively. Stratus adds the marketplace layer, trust scoring, and Gemma explainability on top.

2. **DCPDCC = DCP Compute Group.** Each platform registers as a Compute Group. Their users' browsers join that group. Jobs target specific groups via `job.computeGroups`.

3. **Single Next.js app, three portals.** Routes: `/crc/*`, `/dcc/*`, `/ec/*`. Shared auth, shared API layer, single database.

4. **End users do NOT need DCP wallets.** The DCP Worker's `paymentAddress` is set to the DCPDCC's bank account. Stratus does the internal credit split.

---

## DCP Integration Layer

### `src/lib/dcp/client.ts` -- DCP Initialization
- Server: `require('dcp-client').init()` singleton at startup
- Browser: Load `dcp-client.js` from `https://scheduler.distributed.computer/dcp-client/dcp-client.js`

### `src/lib/dcp/jobManager.ts` -- Job Lifecycle (Server-side)
- Wraps `compute.for(inputSet, workFunction, args)` with Stratus metadata
- Sets `job.public` (name, description) for Gemma explanation context
- Sets `job.computeGroups` to target specific DCPDCCs
- Listens to DCP events (`status`, `result`, `error`, `complete`) and mirrors to database + WebSocket

### `src/lib/dcp/workerManager.ts` -- Worker Lifecycle (Browser-side)
- Instantiates `new Worker({ paymentAddress: dcpdccAddress, maxWorkingSandboxes: 1 })`
- Start/stop based on user's compute toggle
- Captures `sandbox.sliceStart`, `sandbox.sliceFinish`, `payment` events for trust scoring + Gemma

### `src/lib/dcp/walletManager.ts` -- Keystore Management
- DCPCRC: Payment keystore (funds jobs)
- DCPDCC: Earnings keystore (receives Worker payments)
- DCPEC: No DCP keystore needed (payment goes to DCPDCC)

---

## Payment Flow

```
DCPCRC pays DCC per slice via job.exec(paymentOffer, keystore)
    |
    v
DCP Bank pays Worker's paymentAddress (= DCPDCC's account)
    |
    v
DCPDCC keeps X% (configurable, e.g., 70%)
DCPEC earns Y% as "Stratus Credits" (internal ledger)
```

End users never touch DCP wallets -- they see "Stratus Credits" in their dashboard.

---

## Trust Score System

Entirely within Stratus (DCP has no native reputation system).

| Factor | Weight | Source |
|--------|--------|--------|
| Completion Rate | 35% | slicesCompleted / slicesAssigned |
| Uptime Consistency | 20% | Session duration, frequency |
| Progress Heartbeat | 20% | Regular `progress()` calls |
| Error Rate | 15% | slicesErrored / slicesAttempted (inverse) |
| Compute Contribution | 10% | Total CPU-seconds contributed |

**Score** = weighted sum, normalized 0-100. Updated after each slice. Used for:
- DCPDCC dashboard (see reliable users)
- Slice allocation priority
- DCPEC profile gamification

---

## Gemma 4 Integration -- "See What You're Computing"

When DCPEC users compute, Gemma 4 explains what their CPU is doing in plain language.

### Flow
1. `sandbox.sliceStart` fires with `job.public` (name, description) + slice input
2. Pass metadata to Gemma with prompt template:
   > "Explain in 1-2 simple sentences what computation is happening on the user's device. The job is called '{name}'. Description: '{description}'. Input data: {truncated input}."
3. Render explanation in the compute widget alongside a progress bar

### Implementation
- **Primary**: Browser-side Gemma ONNX via `@huggingface/transformers` + WebGPU (reuse pattern from `tessera-test/index.html`)
- **Fallback**: Server-side via Google Gemini API
- **Optimization**: Cache explanations per `jobId` -- many slices per job have the same explanation

---

## Next.js App Structure

```
stratus/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── auth/login/page.tsx         # Login
│   │   ├── auth/register/page.tsx      # Register (pick role)
│   │   ├── crc/                        # DCPCRC Portal
│   │   │   ├── dashboard/page.tsx      # Active jobs, spend, results
│   │   │   ├── jobs/page.tsx           # Job list
│   │   │   ├── jobs/new/page.tsx       # Create job (code editor + input set)
│   │   │   ├── jobs/[jobId]/page.tsx   # Live job progress + results
│   │   │   └── billing/page.tsx        # DCC balance
│   │   ├── dcc/                        # DCPDCC Portal
│   │   │   ├── dashboard/page.tsx      # Workers, earnings, stats
│   │   │   ├── workers/page.tsx        # Connected users + trust scores
│   │   │   ├── earnings/page.tsx       # Revenue + share config
│   │   │   └── integration/page.tsx    # Embed code snippet
│   │   ├── ec/                         # DCPEC Portal
│   │   │   ├── dashboard/page.tsx      # Trust score, credits, history
│   │   │   └── settings/page.tsx       # Compute vs ads toggle
│   │   └── api/
│   │       ├── jobs/route.ts           # Job CRUD
│   │       ├── jobs/[id]/stream/route.ts # SSE for live job events
│   │       ├── distribute/route.ts     # Slice allocation for DCPDCC
│   │       ├── compute/worker/route.ts # Worker config for DCPEC
│   │       ├── compute/report/route.ts # Slice completion reports
│   │       ├── trust/[userId]/route.ts # Trust score
│   │       ├── explain/route.ts        # Gemma explanation
│   │       └── wallet/route.ts         # Keystore management
│   ├── components/
│   │   ├── crc/  (JobForm, JobCard, JobProgress, ResultsViewer)
│   │   ├── dcc/  (WorkerGrid, EarningsChart, IntegrationSnippet)
│   │   ├── ec/   (ComputeWidget, TrustScoreBadge, ExplainPanel, ComputeToggle)
│   │   └── shared/ (LiveStatus, DccBalance)
│   ├── lib/
│   │   ├── dcp/  (client.ts, jobManager.ts, workerManager.ts, walletManager.ts)
│   │   ├── gemma/ (explainer.ts, prompts.ts)
│   │   ├── trust/ (scoring.ts)
│   │   └── db/   (schema.ts, client.ts)
│   ├── hooks/  (useWorker, useJobStatus, useTrustScore, useExplain)
│   └── types/  (dcp.d.ts, stratus.ts, api.ts)
├── prisma/schema.prisma
├── package.json
└── next.config.ts
```

---

## Database Schema (Prisma/SQLite for hackathon)

### Core Tables
- **users** -- id, email, name, role (crc/dcc/ec), auth
- **crc_profiles** -- organization, dcp_keystore (encrypted), dcp_address, total_spent
- **dcc_profiles** -- platform_name, platform_url, dcp_keystore, compute_group_key, revenue_share_pct, total_earned
- **ec_profiles** -- dcc_platform_id (FK), compute_enabled (toggle), trust_score, total_credits, total_slices
- **jobs** -- dcp_job_id, crc_id (FK), title, description, work_function, input_set_config, status, target_groups, gemma_explanation (cached)
- **slice_records** -- job_id, dcp_slice_index, ec_id, status, timing, payment, errors
- **trust_history** -- ec_id, score, factors (JSON), timestamp
- **credit_transactions** -- ec_id, dcc_platform_id, job_id, amount, type (earn/spend)

---

## API Endpoints

| Endpoint | Method | Actor | Purpose |
|----------|--------|-------|---------|
| `/api/jobs` | GET | CRC | List own jobs |
| `/api/jobs` | POST | CRC | Create + deploy job to DCP |
| `/api/jobs/[id]` | GET | CRC | Job status + results |
| `/api/jobs/[id]` | DELETE | CRC | Cancel job |
| `/api/jobs/[id]/stream` | GET (SSE) | CRC | Live job events |
| `/api/distribute` | GET | DCC | Get assigned job slices |
| `/api/distribute/allocate` | POST | DCC | Allocate slices to EC workers |
| `/api/compute/worker` | GET | EC | Get worker config |
| `/api/compute/report` | POST | EC | Report slice completion |
| `/api/trust/[userId]` | GET | DCC/EC | Get trust score |
| `/api/explain` | POST | EC | Gemma 4 explanation |
| `/api/wallet` | GET/POST | CRC/DCC | Keystore management |

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| DCP Worker in embedded context | Prototype first -- load `dcp-client.js`, create `new Worker()`, verify slice pickup |
| Compute Group targeting | Docs are sparse; test `job.computeGroups`; fallback: single group + logical assignment |
| Gemma model 2GB download | Use q4-quantized; cache in IndexedDB; show progress; server-side fallback |
| `dcp-client` is untyped | Write minimal `dcp.d.ts` covering only used APIs |
| Real-time updates | SSE via Next.js route handlers; pipe DCP `job.on('status')` events to clients |

---

## Prototyping Order (36-hour timeline)

| Hours | Focus | Deliverable |
|-------|-------|-------------|
| 0-4 | DCP proof-of-concept | Node.js submits job, browser Worker computes it |
| 4-8 | Next.js scaffold + DB | App skeleton with three portal routes, Prisma + SQLite, basic auth |
| 8-16 | Portal dashboards | CRC job creation, DCC worker monitoring, EC compute widget |
| 16-22 | Gemma + trust score | Browser-side Gemma explanation, trust score calculation + display |
| 22-30 | End-to-end integration | Full flow: CRC -> DCC -> EC -> results, payment display |
| 30-36 | Demo prep | Video, Devpost submission, polish, edge cases |

---

## Verification Plan

1. **DCP Integration**: Submit a test job via `compute.for()` from the CRC portal, verify a browser Worker picks it up and returns results
2. **Compute Toggle**: Toggle compute on/off in EC settings, verify Worker starts/stops and slices are accepted/rejected
3. **Trust Score**: Complete 10+ slices, verify trust score updates in EC dashboard
4. **Gemma Explanation**: While computing, verify Gemma generates a plain-language explanation of the active job
5. **Payment Flow**: After job completion, verify DCC balance changes in CRC (decreased) and DCC (increased) dashboards, and Stratus Credits appear for EC
6. **End-to-End Demo**: Walk through the full flow as three different users (business, platform, end user) in the same browser session
