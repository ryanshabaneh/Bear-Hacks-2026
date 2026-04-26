# Strata

A marketplace for browser-tab compute. Distributors lend the idle GPU sitting on their visitors' tabs. Creators upload audio or video and get a clean transcript back. Strata routes the work through DCP, signs every slice, and settles the payout 80/20 on every sealed forecast.

## Problem

The cheapest hyperscaler transcription tier prices a minute of audio at thirty-six cents. The marginal cost of running the same Whisper-tiny inference in an idle Chrome tab is zero. There is no marketplace between people who have idle compute and people who need transcripts.

## Solution

Three actors meet at Strata:

- **Clients** drop audio or video, get back a transcript bundle.
- **Distributors** embed a worker chip on their site. Opted-in visitor tabs process slices in the background while they're on the page.
- **Strata** orchestrates the route through DCP (Distributed Compute Protocol), records an attestation per slice, and settles 80% to the distributor and 20% to the platform on each sealed forecast.

## How a forecast moves through the system

Five lifecycle routes carry the whole flow.

| Route | Purpose |
| --- | --- |
| `POST /api/transcribe/queue` | Ingests the upload, writes the source to disk, inserts a `Forecast` row with `status=queued`. |
| `POST /api/forecasts/[id]/cast` | Atomically charges the client wallet via an `updateMany` guard, stamps `castedAt`. |
| `GET  /api/forecasts/[id]/stream` | Per-forecast Server-Sent Events channel feeding the live client view. |
| `GET  /api/forecasts/[id]/transcript` | Joins completed slices into a single transcript bundle. |
| `GET  /api/uploads/[id]/raw` | Streams the source media back over HTTP Range for inline playback. |

A one-second polling scheduler claims any forecast with a non-null `castedAt` and a null `scheduledAt`. The claim is an atomic `updateMany` so the same row can never be picked up twice. Once claimed, the dispatcher dynamically imports `dcp/lib.mjs`, decodes the audio with ffmpeg, chunks into 30-second windows, and submits one DCP job per cast. Each completed slice fires an `onResult` callback that writes the slice row, an attestation row, increments the budget cycle counter, and publishes an SSE event to the live frontend.

## Trust and settlement

Every slice writes an `Attestation` row carrying the worker pubkey, region glyph, output hash, and scheduler signature. Every sealed forecast writes a `Settlement` row with the gross, distributor, and platform splits. Trust scoring is downstream of that history.

## Worker visibility

Active workers heartbeat into a `WorkerNode` table via `POST /api/worker/heartbeat`. The client dashboard polls `/api/worker/active` and renders a live "nodes connected" indicator above the studio flow. The distributor dashboard reads the same source and pulses each row in the trust panel as its heartbeat advances.

## Stack

- Next.js 16 (App Router) + Turbopack
- Prisma 6 on SQLite for dev, schema portable to Postgres
- `dcp-client` v5 submitting whisper-tiny ONNX modules to the public DCP marketplace
- Auth0 v4 SDK in production; stub-cookie auth locally via `AUTH_MODE=stub`
- Stripe test mode for the client wallet (Connect not enabled)
- Server-Sent Events bus on `globalThis` for per-forecast event fan-out
- Cloudflared tunnels for cross-machine demos

## Run it locally

```bash
git clone git@github.com:ryanshabaneh/Bear-Hacks-2026.git
cd Bear-Hacks-2026/strata
pnpm install
./scripts/start-local.sh
```

`start-local.sh` wipes `.next`, `/tmp/strata-uploads`, the SQLite database, then re-pushes the schema, reseeds the demo client and distributor accounts, and boots the dev server on port 3000.

For the music-app distributor surface:

```bash
cd ../music-app
pnpm install
pnpm dev    # boots on 3001
```

Open `http://localhost:3000`, sign in via the stub form (client: `kellygao@live.ca`, distributor: `northbeacon@strata.demo`), drop a file on the dropzone, hit Cast.

## Dispatch modes

`DCP_MODE` in `strata/.env.local` selects how the dispatcher routes work.

| Mode | Behavior |
| --- | --- |
| `live` | Submits to the public DCP marketplace via `dcp-client`. Requires a funded keystore at `~/.dcp/{id,default}.keystore` and at least one tab open at https://dcp.work/. |
| `cached` | Replays a previously captured DCP run from `dcp/cache/<DCP_CACHED_FIXTURE>.json`. Deterministic timing, real transcripts, no live-routing dependency. |
| `hardcode` | In-process replay against a fixed worker pool. No external dependency. |

## Current scope

Strata is a hackathon build. A few surfaces are deliberately scoped down with on-screen labels rather than hidden:

- Trust scoring weights are fixed; the scoring engine and attestation rows are real.
- The client wallet auto-seeds at a low-water mark so the demo flow stays continuous.
- Stripe Connect is not enabled on the test account.

The five lifecycle routes, the dispatch path, the attestation chain, and the 80/20 settlement split are all real.

## License

MIT. Built for BearHacks 2026.
