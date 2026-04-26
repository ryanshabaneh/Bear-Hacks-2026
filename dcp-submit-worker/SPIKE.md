# Whisper-WebGPU sandbox spike — outcome

**Status:** pending live test on actual DCP scheduler.

## What this worker assumes

Path A (Strata-hosted version-pinned bundle) per `plan/01-preflight.md §5`:

- Work function `whisperWorkFn` does `await import(input.bundleUrl)` where
  `input.bundleUrl` resolves to `https://cdn.strata.app/runtime/whisper-work-v1.js`
  (env `WHISPER_WORK_BUNDLE_URL`).
- Bundle is expected to inline transformers.js v3, audio decode helpers, and a
  `transcribe()` export with `progress` schedule that receives `{audioUrl, modelUrl,
  timestampStart, timestampEnd, onProgress}` and returns `{srtText, semanticHash,
  cyclesConsumed, modelUsed, deviceUsed}`.
- Whisper-base ONNX model weights at `https://cdn.strata.app/models/whisper-base/model.onnx`
  (env `WHISPER_MODEL_URL`), fetched as a separate RemoteDataPattern URL.
- Bundle and model URLs must be RemoteDataPattern-registered with the scheduler
  before live submission. Until that registration is verified, slices that
  attempt to fetch will fail with sandbox errors.

## Open verifications (block live demo if any fails)

1. `await import(<https url>)` works inside the V8 sandbox.
2. `OfflineAudioContext` available for chunk decode (or fall back to WASM-decode in
   the bundle).
3. `navigator.gpu` present — or WASM-SIMD fallback path produces results in
   under the 30s `progress()` budget.
4. RemoteDataPattern registration accepted both bundle URL and model URL.
5. Cold-start (model fetch + warm + first decode) completes within 30s with
   `progress()` heartbeats every <10s.

## Demo fallback

`dispatch.ts` in Strata defaults `DCP_MODE=demo` which runs an in-process replay
on the Strata API server, bypassing this worker. Switch to `DCP_MODE=live` and
ensure `DCP_SUBMIT_WORKER_URL` points at this worker's host to use real DCP.
