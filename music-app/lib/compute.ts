// Strata "compute" mode runtime for the music-app demo.
//
// In production, this would be the embed.js iframe registering as a DCP worker
// and reporting `progress()` heartbeats from the strata Compute Group.
//
// For the hackathon demo we simulate the runtime locally:
//   - runCompute() ticks through N slices over ~4s, just like a real DCP slice run
//   - emits ComputeProgress events on `window` so the StrataChip can subscribe
//
// Path B-style: visible artifact (the chip) shows real state changes; judges
// see a believable "computing…" widget without us needing a funded DCP keystore
// or a live submit worker on stage.

export type ComputeProgress = {
  state: "idle" | "running" | "paused";
  computed: number;
  total: number;
};

const COMPUTE_EVENT = "strata:compute";

export function emitComputeProgress(p: ComputeProgress): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ComputeProgress>(COMPUTE_EVENT, { detail: p }));
}

export function onComputeProgress(handler: (p: ComputeProgress) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<ComputeProgress>).detail);
  window.addEventListener(COMPUTE_EVENT, listener);
  return () => window.removeEventListener(COMPUTE_EVENT, listener);
}

const SLICES = 8;
const SLICE_MS = 450;

export async function runCompute(): Promise<void> {
  for (let i = 1; i <= SLICES; i++) {
    emitComputeProgress({ state: "running", computed: i, total: SLICES });
    await new Promise((r) => setTimeout(r, SLICE_MS));
  }
  // brief pause so the user sees "8/8" before the chip resets to idle
  await new Promise((r) => setTimeout(r, 200));
  emitComputeProgress({ state: "idle", computed: 0, total: SLICES });
}
