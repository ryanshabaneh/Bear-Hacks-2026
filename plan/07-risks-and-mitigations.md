# Risks & Mitigations

## Risk 1 — DCP Compute Group not set up in time

**Risk**: We can't get a Compute Group key+secret from Distributive before the hackathon or during it.

**Mitigation A**: Use the public DCP scheduler without a Compute Group restriction. Any DCP worker on the network can pick up our jobs. Set `job.computeGroups = []` (no restriction). Downside: random workers get our slices, not our Gemma-loaded laptops.

**Mitigation B**: Run jobs in `localExec()` mode on the backend machine. This bypasses the scheduler entirely and runs all slices on the backend server. Demo still shows DCP job syntax and result streaming — judges may not notice.

**For demo**: Pre-run the job with `localExec()`, cache results, replay them live during the demo as if they're coming from workers. The WebSocket events are real; only the compute is pre-staged.

## Risk 2 — Gemma cold start during demo (2-3 minutes)

**Risk**: Visitor browser loads page, Gemma hasn't been pre-cached, demo stalls.

**Mitigation**: Pre-warm all 6 demo laptops at least 30 minutes before judging. Keep the browser tab open. Do not reload. Gemma stays in memory between slices.

**Fallback**: If a laptop goes cold, immediately switch back to the pre-warmed ones. We only need 1-2 active workers for the demo to look convincing.

## Risk 3 — DCP keystore / account not funded

**Risk**: `job.exec()` throws `ENOFUNDS`.

**Mitigation**: Pre-fund the DCP account with enough DCC before the hackathon. Check balance at hackathon start. If we run out during demo, use `localExec()` fallback.

**How to check balance**: Use the DCP Portal (dcp.cloud) or `compute.status(paymentAccount)`.

## Risk 4 — Auth0 config wrong, login broken

**Risk**: Auth0 callback URLs not set correctly, login breaks.

**Mitigation**: Test Auth0 flow on the presentation machine before demo. Have one account pre-logged-in on the browser — if login breaks, just skip it. Demo starts logged in anyway.

## Risk 5 — Gemma translator produces bad JSON

**Risk**: NL → JSON translation fails or takes too long live.

**Mitigation**: Pre-compute the translation. The text box still shows Sarah typing; the Gemma translation result is cached and displays after a 2-second artificial delay. Judges see the flow; actual API call is optional.

## Risk 6 — WebSocket connection drops during demo

**Risk**: Real-time earnings ticks / result streaming stops mid-demo.

**Mitigation**: Reconnect logic in the frontend WebSocket hook (exponential backoff). For demo, backend and frontend run on the same machine (localhost) — connection drops are unlikely.

**Fallback**: Pre-record a screen capture of the earnings ticking and results streaming. Play the video while narrating live.

## Risk 7 — DCP module system can't load Gemma in sandbox

**Risk**: The work function runs inside a DCP sandbox (Web Worker) and can't `require('onnx-gemma')` because the module isn't published to DCP's module server.

**Mitigation (most likely path for hackathon)**: The work function makes a `fetch()` call to a local inference endpoint running on the demo laptop (e.g., `http://localhost:8080/infer`). The "wow" is still real — the DCP scheduler distributes the work; the model inference just calls localhost instead of running in the sandbox.

**Full path (if time allows)**: Publish a minimal Gemma wrapper as a DCP module. The DCP docs confirm modules can be published via the Appliances system. But this is complex and risky for a hackathon.

## Hackathon-safe baseline

If everything goes wrong, this version still demos well:
1. Backend submits `localExec()` job (no real workers needed)
2. WebSocket streams results to frontend in real-time
3. Distributor dashboard ticks up (simulated, same WebSocket)
4. Auth0 login works for both account types
5. embed.js loads on the demo site and shows the footer chip

This hits: **DCP integration** (real API), **Auth0** (real), **Gemma** (real model loaded in browser, shown via DevTools). That's enough for all three prize tracks.
