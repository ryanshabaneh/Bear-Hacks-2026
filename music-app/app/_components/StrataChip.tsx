"use client";

// Strata embed chip — the visible artifact judges see when compute mode is on.
// Mirrors the real embed.js footer chip (see embed/strata.js) but rendered
// in-process so we don't need an iframe + remote runtime for the demo.

import { useEffect, useState } from "react";
import {
  ComputeProgress,
  onComputeProgress,
} from "@/lib/compute";
import { BreakMode, getBreakMode } from "@/lib/settings";

export function StrataChip() {
  const [mode, setMode] = useState<BreakMode>("ad");
  const [progress, setProgress] = useState<ComputeProgress>({
    state: "idle",
    computed: 0,
    total: 8,
  });
  const [paused, setPaused] = useState(false);

  // Read break mode on mount + when window regains focus or storage changes.
  useEffect(() => {
    setMode(getBreakMode());
    const refresh = () => setMode(getBreakMode());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    // Same-tab updates: re-poll every 500ms (cheap, runs forever).
    // (Settings page calls setBreakMode via localStorage; no event fires for same-tab.)
    const id = window.setInterval(refresh, 500);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(id);
    };
  }, []);

  // Subscribe to compute progress events.
  useEffect(() => onComputeProgress(setProgress), []);

  // Only show when compute mode is on (just like a real embed: only loads
  // if the distributor opted in).
  if (mode !== "compute") return null;

  const running = progress.state === "running" && !paused;
  const stateAttr = paused ? "paused" : running ? "running" : "idle";

  let text: string;
  if (paused) {
    text = "Compute paused — site relies on this revenue.";
  } else if (running) {
    text = `Computing… slice ${progress.computed}/${progress.total}`;
  } else {
    text = "This site is supported by your idle compute.";
  }

  return (
    <div className="strata-chip" data-state={stateAttr} role="status" aria-live="polite">
      <span className="strata-chip-brand">★ STRATA</span>
      <span className="strata-chip-text">{text}</span>
      <button
        type="button"
        className="strata-chip-pause"
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <a
        className="strata-chip-info"
        href="https://strata.app/what-is-this"
        target="_blank"
        rel="noopener noreferrer"
      >
        What&apos;s this?
      </a>
    </div>
  );
}
