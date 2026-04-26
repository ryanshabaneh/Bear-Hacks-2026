"use client";

import { useEffect, useState } from "react";
import { BreakMode, getBreakMode, setBreakMode } from "@/lib/settings";

export default function SettingsPage() {
  const [mode, setMode] = useState<BreakMode>("ad");

  useEffect(() => {
    setMode(getBreakMode());
  }, []);

  function choose(next: BreakMode) {
    setMode(next);
    setBreakMode(next);
  }

  return (
    <main>
      <h1>Settings</h1>
      <div className="card">
        <div
          className="lib-title"
          style={{ marginBottom: 8 }}
        >
          ★ HOUSE RULES
        </div>
        <div className="muted" style={{ marginBottom: 18 }}>
          Pick what happens every 5 songs.
        </div>
        <div className="toggle">
          <button
            className={mode === "ad" ? "active" : ""}
            onClick={() => choose("ad")}
          >
            <div style={{ fontSize: 14, marginBottom: 6 }}>► PLAY AD</div>
            <div
              className="muted"
              style={{ fontSize: 14, textTransform: "none" }}
            >
              Standard. Watch a 30s spot.
            </div>
          </button>
          <button
            className={mode === "compute" ? "active" : ""}
            onClick={() => choose("compute")}
          >
            <div style={{ fontSize: 14, marginBottom: 6 }}>■ SKIP AD (COMPUTE)</div>
            <div
              className="muted"
              style={{ fontSize: 14, textTransform: "none" }}
            >
              Donate idle CPU. No ads, ever.
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
