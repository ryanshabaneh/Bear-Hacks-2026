"use client";

import { useEffect, useState } from "react";

type Node = {
  nodeKey: string;
  origin: string;
  label: string | null;
  slicesComputed: number;
  lastHeartbeatAt: string;
};

type Snapshot = { count: number; nodes: Node[] };

const POLL_MS = 2_500;

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

export function NodesIndicator() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ count: 0, nodes: [] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/worker/active", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Snapshot;
        if (!cancelled) setSnapshot(data);
      } catch {
        return;
      }
    }
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1_000);
    return () => window.clearInterval(id);
  }, []);

  void tick;

  const live = snapshot.count > 0;
  const totalSlices = snapshot.nodes.reduce((sum, node) => sum + node.slicesComputed, 0);

  return (
    <div className="nodes-indicator" data-live={live ? "1" : "0"}>
      <div className="nodes-indicator-row">
        <span className="nodes-indicator-dot" aria-hidden="true" />
        <span className="cirrus-text-unit" style={{ fontSize: 11 }}>
          live network
        </span>
        <span className="nodes-indicator-count">
          {snapshot.count} {snapshot.count === 1 ? "node" : "nodes"} connected
        </span>
        {totalSlices > 0 ? (
          <span className="nodes-indicator-meta">· {totalSlices} slices computed</span>
        ) : null}
      </div>

      {snapshot.nodes.length > 0 ? (
        <ul className="nodes-indicator-list">
          {snapshot.nodes.map((node) => (
            <li key={node.nodeKey} className="nodes-indicator-item">
              <span className="nodes-indicator-origin">{node.label ?? node.origin}</span>
              <span className="nodes-indicator-key">{node.nodeKey.slice(-6).toUpperCase()}</span>
              <span className="nodes-indicator-when">{relative(node.lastHeartbeatAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nodes-indicator-empty">
          waiting for a distributor tab to come online.
        </p>
      )}

      <style>{`
        .nodes-indicator {
          border: 1.5px solid var(--y2k-border);
          background: var(--y2k-window);
          padding: 10px 12px;
          box-shadow: 4px 4px 0 0 var(--y2k-shadow);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nodes-indicator-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .nodes-indicator-dot {
          display: inline-block;
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #6c6c6c;
          box-shadow: 0 0 0 2px rgba(108, 108, 108, 0.18);
        }
        .nodes-indicator[data-live="1"] .nodes-indicator-dot {
          background: #2ec27e;
          box-shadow: 0 0 0 2px rgba(46, 194, 126, 0.3);
          animation: nodes-indicator-pulse 1.4s ease-in-out infinite;
        }
        .nodes-indicator-count {
          font-family: var(--font-mono);
          font-size: 12.5px;
          font-weight: 700;
          color: var(--y2k-border);
        }
        .nodes-indicator-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          opacity: 0.7;
        }
        .nodes-indicator-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 0;
          margin: 0;
          list-style: none;
        }
        .nodes-indicator-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid var(--y2k-border);
          background: var(--y2k-titlebar-pink, #ffd6e5);
          padding: 3px 8px;
          font-family: var(--font-mono);
          font-size: 11px;
          box-shadow: 1px 1px 0 0 var(--y2k-shadow);
        }
        .nodes-indicator-origin {
          font-weight: 700;
        }
        .nodes-indicator-key {
          opacity: 0.7;
          letter-spacing: 0.08em;
        }
        .nodes-indicator-when {
          opacity: 0.7;
        }
        .nodes-indicator-empty {
          font-family: var(--font-mono);
          font-size: 11px;
          opacity: 0.65;
          margin: 0;
        }
        @keyframes nodes-indicator-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nodes-indicator[data-live="1"] .nodes-indicator-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
