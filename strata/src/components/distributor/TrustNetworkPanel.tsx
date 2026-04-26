"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Node = {
  pubkey: string;
  region: string;
  score: number;
  tasksCompleted: number;
};

const NODES: Node[] = [
  { pubkey: "node_a3f8b1ce", region: "NA-east", score: 0.94, tasksCompleted: 1247 },
  { pubkey: "node_4d8c91ee", region: "EU", score: 0.91, tasksCompleted: 832 },
  { pubkey: "node_7e2a5b14", region: "APAC", score: 0.89, tasksCompleted: 671 },
  { pubkey: "node_9c1f08d7", region: "NA-west", score: 0.86, tasksCompleted: 588 },
  { pubkey: "node_b6e34a92", region: "EU", score: 0.82, tasksCompleted: 412 },
  { pubkey: "node_2a7d6e8f", region: "NA-east", score: 0.78, tasksCompleted: 304 },
];

export function TrustNetworkPanel() {
  const [pulseIdx, setPulseIdx] = useState<number | null>(null);
  const [tickFlash, setTickFlash] = useState(false);
  const pendingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const pending = pendingRef.current;
    const trackTimeout = (cb: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        pending.delete(id);
        cb();
      }, ms);
      pending.add(id);
    };

    const pulseTimer = window.setInterval(() => {
      const pick = Math.floor(Math.random() * NODES.length);
      setPulseIdx(pick);
      trackTimeout(() => setPulseIdx(null), 380);
    }, 1900);

    const heartbeatTimer = window.setInterval(() => {
      setTickFlash(true);
      trackTimeout(() => setTickFlash(false), 180);
    }, 1500);

    return () => {
      window.clearInterval(pulseTimer);
      window.clearInterval(heartbeatTimer);
      for (const id of pending) window.clearTimeout(id);
      pending.clear();
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="cirrus-text-unit">Verified compute nodes</span>
        <span className="flex items-center gap-1.5 cirrus-text-unit" style={{ opacity: 0.75 }}>
          <span
            aria-hidden="true"
            className={cn("trust-tick", tickFlash && "trust-tick-on")}
          />
          {NODES.length} live
        </span>
      </div>

      <div className="flex flex-col" style={{ borderTop: "1px solid var(--y2k-border)" }}>
        <div
          className="grid gap-2 py-1 cirrus-text-unit"
          style={{ gridTemplateColumns: "1fr 70px 60px 60px", opacity: 0.6 }}
        >
          <span>Node</span>
          <span>Region</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "right" }}>Tasks</span>
        </div>
        {NODES.map((node, idx) => {
          const isPulsing = pulseIdx === idx;
          return (
            <div
              key={node.pubkey}
              className={cn(
                "grid gap-2 py-1.5 trust-row",
                isPulsing && "trust-row-pulse",
              )}
              style={{
                gridTemplateColumns: "1fr 70px 60px 60px",
                borderTop: "1px solid var(--y2k-border)",
              }}
            >
              <span className="cirrus-text-mono-id" style={{ fontSize: 12 }}>
                {node.pubkey}
              </span>
              <span className="cirrus-text-mono-id" style={{ fontSize: 12 }}>
                {node.region}
              </span>
              <span
                className="cirrus-num"
                style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}
              >
                {node.score.toFixed(2)}
              </span>
              <span
                className="cirrus-num"
                style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}
              >
                {node.tasksCompleted}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        .trust-row {
          background: transparent;
          transition: background 320ms ease-out;
        }
        .trust-row-pulse {
          background: var(--y2k-titlebar-lavender);
          animation: trust-row-fade 380ms ease-out;
        }
        .trust-tick {
          width: 6px;
          height: 6px;
          background: var(--y2k-border);
          border-radius: 1px;
          transition: background 120ms ease-out;
        }
        .trust-tick-on {
          background: var(--y2k-titlebar-pink);
        }
        @keyframes trust-row-fade {
          0%   { background: var(--y2k-titlebar-lavender); }
          100% { background: transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          .trust-row-pulse { animation: none !important; background: transparent !important; }
          .trust-tick { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
