# Strata

> Distributed transcription powered by idle browser compute

Strata is a creator-economy transcription marketplace built on the [Distributive Compute Protocol (DCP)](https://distributed.computer). Clients submit audio, and it gets transcribed across a distributed network of visitor browsers -- no GPU servers required. Distributors embed a single script tag on their site and earn revenue share from the compute their visitors contribute.

---

## The Problem

- Transcription is expensive for independent creators (podcasters, YouTubers, course creators).
- Existing solutions charge per audio-hour: Rev AI at $1.20, OpenAI Whisper API at $0.36, AssemblyAI at $0.12.
- All of them require server-side GPU time that someone has to pay for.

## The Solution

- Strata uses visitor browsers as distributed compute nodes via DCP.
- Site owners embed a `<script>` tag; visitors silently run Whisper inference in a sandboxed environment.
- Creators submit audio; it gets split into 30-second chunks and transcribed across the network with k=2 redundancy.
- Distributors earn 68% revenue share. Strata keeps 32%. No GPU servers needed.
- Target cost: **$0.04 per audio-hour** -- 3x cheaper than the cheapest API competitor, 2,000x cheaper than human transcription.

## Features

- **Distributed Whisper transcription** via DCP with WebGPU acceleration (WASM-SIMD fallback)
- **Real-time progress** via Server-Sent Events (SSE) -- watch transcription arrive chunk by chunk
- **Site verification system** for Distributors to prove domain ownership
- **Embed system** with invisible iframe and footer chip ("This page is contributing compute")
- **Consent-first design** -- named workload, explainer modal, sticky pause toggle, zero PII
- **Proof-of-concept music app** demonstrating compute-instead-of-ads model

---

## Quick Start

### Prerequisites

- Node.js >= 18
- npm

### Running the Platform (Strata)

```bash
cd strata
npm install
npx prisma migrate dev --name init
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### Running the Music App (Demo)

```bash
cd music-app
npm install
npm run dev
```

### Running the DCP Library

```bash
cd dcp
npm install
node run-podcast.mjs path/to/audio.mp3
```

Requires ffmpeg on PATH, DCP keystores at `~/.dcp/`, and a funded DCC balance. See [dcp/README.txt](dcp/README.txt) for full prerequisites.

---

## Architecture

Strata is composed of four main components. See the [plan/](plan/) directory for the full architecture deep dive.

- **Strata Platform** (`strata/`) -- Next.js app with role-gated dashboards for Clients and Distributors. Handles job submission, progress tracking, and settlement.
- **Embed System** (`embed/`) -- IIFE loader script + iframe runtime deployed to Cloudflare Pages. Runs DCP browser workers on Distributor sites.
- **DCP Library** (`dcp/`) -- Node.js library for distributed Whisper transcription. Handles audio decoding, chunking, DCP dispatch, and result assembly.
- **Music App** (`music-app/`) -- Proof-of-concept Next.js app demonstrating the compute-instead-of-ads model.

### How Transcription Works

1. Audio is decoded to 16 kHz mono float32 via ffmpeg.
2. Samples are split into 30-second chunks.
3. `compute.for()` dispatches one DCP slice per chunk with k=2 redundancy.
4. Each worker runs Whisper-tiny ONNX inference (encoder + greedy autoregressive decoder with KV caching).
5. Semantic-hash quorum validates agreeing transcript pairs; 1-3% get oracle spot-checks.
6. Results assemble in timestamp order into the final transcript (SRT + VTT + JSON + plain text).

---

## Tech Stack

| Layer | Technology |
|---|---|
| App Framework | Next.js 14.2, React 18 (App Router) |
| ORM / Database | Prisma + SQLite (dev) / Postgres (prod) |
| Auth | Auth0 Universal Login via `@auth0/nextjs-auth0` |
| Live Updates | Server-Sent Events (SSE) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Distributed Compute | DCP (`dcp-client`) |
| AI Model | Whisper-tiny ONNX via `@xenova/transformers` |
| Embed Hosting | Cloudflare Pages |

---

## Environment Variables

Create a `.env` file in `strata/` with the following:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth0
AUTH0_SECRET=<random-string>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<your-tenant>.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
AUTH_MODE=stub          # "stub" for local dev, "auth0" for real login

# DCP
DCP_SCHEDULER_URL=https://scheduler.distributed.computer
```

---

## Project Structure

```
Bear-Hacks-2026/
  strata/                 # Next.js platform (Client + Distributor dashboards)
    app/                  # App Router (role-gated layouts)
    prisma/               # Schema + migrations (SQLite dev, Postgres prod)
  dcp/                    # DCP Whisper transcription library
  embed/                  # Cloudflare Pages embed (strata.js + runtime iframe)
  music-app/              # Proof-of-concept music player demo
  plan/                   # Architecture docs and build plan
  docs/                   # DCP documentation and Devpost info
```

---

## Demo

The live demo is a 5-minute walkthrough covering the full transcription pipeline:

1. **Client submits a Forecast** -- drop audio into the Composer, review the structured job spec, open the Front.
2. **Distributor dashboard** -- watch the SliceTicker as visitor browsers process chunks and earn revenue.
3. **Catchment assembles** -- SRT segments fill in timestamp order with a live cost comparison against competitors.
4. **Bundle downloads** -- final transcript delivered as SRT + VTT + JSON + plain text.
5. **Embed demo** -- footer chip, explainer modal, and pause toggle on a sample site.

See [plan/07-demo-script.md](plan/07-demo-script.md) for the full narrated script.

---

## Built With

- [Distributive Compute Protocol (DCP)](https://distributed.computer) -- browser-native distributed compute
- [Whisper-tiny ONNX](https://huggingface.co/Xenova/whisper-tiny) via `@xenova/transformers` -- speech-to-text inference
- [Next.js 14](https://nextjs.org/) (App Router) -- full-stack React framework
- [Prisma](https://www.prisma.io/) + SQLite / Postgres -- ORM and database
- [Auth0](https://auth0.com/) -- authentication and role management
- [Tailwind CSS](https://tailwindcss.com/) -- utility-first styling
- [Cloudflare Pages](https://pages.cloudflare.com/) -- embed runtime hosting
- [Zod](https://zod.dev/) -- schema validation

## Team

BearHacks 2026

## License

License TBD. Built during BearHacks 2026 (April 24-26, 2026).
