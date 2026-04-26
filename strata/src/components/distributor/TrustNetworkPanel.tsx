"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Node = {
  nodeKey: string;
  origin: string;
  label: string | null;
  slicesComputed: number;
  lastHeartbeatAt: string;
};

type Snapshot = { count: number; nodes: Node[] };

const POLL_MS = 2_500;

function deterministicScore(nodeKey: string): number {
  let hash = 0;
  for (const ch of nodeKey) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const normalized = (Math.abs(hash) % 200) / 1000;
  return 0.78 + normalized;
}

function shortKey(nodeKey: string): string {
  const tail = nodeKey.replace(/-/g, "").slice(-8).toLowerCase();
  return `node_${tail}`;
}

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function TrustNetworkPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ count: 0, nodes: [] });
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [tickFlash, setTickFlash] = useState(false);
  const lastSeenRef = useRef<Map<string, string>>(new Map());
  const pendingRef = useRef<Set<number>>(new Set());
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/worker/active", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Snapshot;
        if (cancelled) return;
        setSnapshot(data);

        for (const node of data.nodes) {
          const prior = lastSeenRef.current.get(node.nodeKey);
          if (prior !== node.lastHeartbeatAt) {
            lastSeenRef.current.set(node.nodeKey, node.lastHeartbeatAt);
            if (prior !== undefined) {
              setPulseKey(node.nodeKey);
              setTickFlash(true);
              const pending = pendingRef.current;
              const pulseId = window.setTimeout(() => {
                pending.delete(pulseId);
                setPulseKey((current) => (current === node.nodeKey ? null : current));
              }, 380);
              const flashId = window.setTimeout(() => {
                pending.delete(flashId);
                setTickFlash(false);
              }, 180);
              pending.add(pulseId);
              pending.add(flashId);
            }
          }
        }
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
    const pending = pendingRef.current;
    const id = window.setInterval(() => force((n) => n + 1), 1_000);
    return () => {
      window.clearInterval(id);
      for (const t of pending) window.clearTimeout(t);
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
          {snapshot.count} live
        </span>
      </div>

      <div className="flex flex-col" style={{ borderTop: "1px solid var(--y2k-border)" }}>
        <div
          className="grid gap-2 py-1 cirrus-text-unit"
          style={{ gridTemplateColumns: "1fr 90px 60px 60px", opacity: 0.6 }}
        >
          <span>Node</span>
          <span>Origin</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "right" }}>Slices</span>
        </div>

        {snapshot.nodes.length === 0 ? (
          <div
            className="py-3 cirrus-text-unit"
            style={{ borderTop: "1px solid var(--y2k-border)", opacity: 0.6 }}
          >
            no nodes online yet. waiting for slopify tabs to come up.
          </div>
        ) : (
          snapshot.nodes.map((node) => {
            const isPulsing = pulseKey === node.nodeKey;
            return (
              <div
                key={node.nodeKey}
                className={cn(
                  "grid gap-2 py-1.5 trust-row",
                  isPulsing && "trust-row-pulse",
                )}
                style={{
                  gridTemplateColumns: "1fr 90px 60px 60px",
                  borderTop: "1px solid var(--y2k-border)",
                }}
              >
                <span className="cirrus-text-mono-id" style={{ fontSize: 12 }}>
                  {shortKey(node.nodeKey)}
                </span>
                <span className="cirrus-text-mono-id" style={{ fontSize: 12 }}>
                  {node.label ?? node.origin}
                </span>
                <span
                  className="cirrus-num"
                  style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}
                >
                  {deterministicScore(node.nodeKey).toFixed(2)}
                </span>
                <span
                  className="cirrus-num"
                  style={{ fontSize: 13, fontWeight: 700, textAlign: "right" }}
                  title={`last heartbeat ${relative(node.lastHeartbeatAt)} ago`}
                >
                  {node.slicesComputed}
                </span>
              </div>
            );
          })
        )}
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
