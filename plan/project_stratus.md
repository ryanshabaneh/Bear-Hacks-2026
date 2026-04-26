---
name: Strata Platform
description: BearHacks 2026 hackathon project — AdSense-replacement compute marketplace on DCP with Client, Distributor, and Node (no-account) actors
type: project
originSessionId: d21dd613-6125-4f4a-b3f7-787014708139
---
Strata (formerly "Stratus") is the team's BearHacks 2026 hackathon project (April 24-26, 2026). It's an AdSense-replacement compute marketplace built on DCP where website visitors contribute idle compute instead of seeing ads.

**Three actors (locked terminology):**
- **Client** (compute-request-client) — orgs that submit compute jobs, pay per compute-second
- **Distributor** (distribute-client) — website owners who embed Strata (like AdSense publishers), earn 68% rev share
- **Node** (compute-execute-client) — end-user browser, **NO signup, NO account, NO visible trust score**. Only surfaces: footer chip + "What is this?" modal. Zero PII.

**Economic model:** Client pays USD → Strata escrows DCC → Distributor gets 68%, Strata takes 32%. Nodes get nothing — ad-free experience is the value exchange.

**Tech stack:** TypeScript, React, Next.js, Node.js, DCP (dcp-client), Auth0, Stripe Connect (mocked), Gemma 4

**Prize targets:** Best Use of DCP (primary), Gemma 4 (secondary)

**Architecture:** 7-phase end-to-end workflow documented in plan/stratus-architecture.md:
1. Distributor Onboarding — Auth0 signup, site verification via /.well-known/strata.json, embed snippet, Stripe Connect
2. Client Onboarding — Auth0 signup, Stripe fund balance, Strata escrows DCC on DCP ledger
3. Job Submission — Client types intent in plain English, Gemma 4 translates to JSON, validate & confirm, compute.for() → DCP
4. Node Execution — embed.js on Distributor site, DCP Worker loads Gemma, runs rollout slices, results return
5. Verifier Pass — second compute.for() call, different Nodes grade rollouts, weighted vote picks winning answer
6. Results Delivery — Client gets answers + single-shot vs swarm comparison numbers
7. Payout — Distributor accumulates DCC → Stripe Connect → bank (mocked for hackathon)

**Demo workload:** Best-of-N reasoning eval — Gemma 4 on AIME 2024 with N=8 rollouts per problem (240 rollout slices + ~240 verifier slices)

**Demo path (5 min live):** Phases 3-6 live. Phases 1-2 and 7 as screenshots. Pre-stage accounts + 6 team laptops as Nodes.

**Team:** 4 people (3 backend, 1 frontend). Client targeting still TBD.

**Why:** DCP's browser Worker infrastructure powers an "ads replacement" model. Two-phase compute (rollout + verify) makes Strata smarter than single-shot. Anti-Coinhive via footer chip + consent.

**How to apply:** Two portals (Distributor + Client) + silent Node embed. Live demo: Sarah types intent → Gemma translates → slices dispatch → results stream → swarm beats single-shot → read the number out loud.
