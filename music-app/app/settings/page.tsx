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
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Break behavior</div>
        <div className="muted" style={{ marginBottom: 12 }}>
          Choose what happens every 5 songs.
        </div>
        <div className="toggle">
          <button
            className={mode === "ad" ? "active" : "ghost"}
            onClick={() => choose("ad")}
          >
            Ad
          </button>
          <button
            className={mode === "compute" ? "active" : "ghost"}
            onClick={() => choose("compute")}
          >
            No ad (compute)
          </button>
        </div>
      </div>
    </main>
  );
}
