"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";

type CompletedSlice = {
  chunkIndex: number;
  timestampStart: number;
  timestampEnd: number;
  text?: string;
  arrivedAt: number;
};

const PUZZLE_PIECES = [
  "/assets/puzzle-pieces/piece.svg",
  "/assets/puzzle-pieces/piece2.svg",
  "/assets/puzzle-pieces/piece3.svg",
  "/assets/puzzle-pieces/piece4.svg",
  "/assets/puzzle-pieces/piece5.svg",
  "/assets/puzzle-pieces/piece6.svg",
  "/assets/puzzle-pieces/piece7.svg",
  "/assets/puzzle-pieces/piece9.svg",
  "/assets/puzzle-pieces/pice10.svg",
  "/assets/puzzle-pieces/piece788svg.svg",
  "/assets/puzzle-pieces/Vector.svg",
];

function seedFromForecastId(forecastId: string): number {
  let total = 0;
  for (let i = 0; i < forecastId.length; i++) {
    total = (total + forecastId.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return total;
}

function pickPuzzle(idx: number, seed: number): string {
  return PUZZLE_PIECES[(idx * 7 + seed * 3) % PUZZLE_PIECES.length];
}

type Props = {
  forecastId: string;
  slicesTotal: number;
  slicesCompleted: CompletedSlice[];
  latestLine?: { timestamp: string; text: string };
  columns?: number;
  className?: string;
};

export function CatchmentAssembling({
  forecastId,
  slicesTotal,
  slicesCompleted,
  latestLine,
  columns = 10,
  className,
}: Props) {
  const orderedByTimestamp = useMemo(
    () => [...slicesCompleted].sort((a, b) => a.timestampStart - b.timestampStart),
    [slicesCompleted],
  );

  const completedIndexes = useMemo(() => {
    const map = new Map<number, CompletedSlice>();
    for (const slice of orderedByTimestamp) {
      map.set(slice.chunkIndex, slice);
    }
    return map;
  }, [orderedByTimestamp]);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const stateRef = useRef({ slicesTotal, completedIndexes });
  stateRef.current = { slicesTotal, completedIndexes };
  const [flickerIdx, setFlickerIdx] = useState<number | null>(null);
  const [shimmerIdx, setShimmerIdx] = useState<number | null>(null);

  useEffect(() => {
    const pending = new Set<number>();
    const trackTimeout = (cb: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        pending.delete(id);
        cb();
      }, ms);
      pending.add(id);
    };

    const flickerTimer = window.setInterval(() => {
      const { slicesTotal: total, completedIndexes: completed } = stateRef.current;
      const empties: number[] = [];
      for (let i = 0; i < total; i++) {
        if (!completed.has(i)) empties.push(i);
      }
      if (empties.length === 0) {
        setFlickerIdx(null);
        return;
      }
      const pick = empties[Math.floor(Math.random() * empties.length)];
      setFlickerIdx(pick);
      trackTimeout(() => setFlickerIdx(null), 220);
    }, 1700);

    const shimmerTimer = window.setInterval(() => {
      const { completedIndexes: completed } = stateRef.current;
      const filled = Array.from(completed.keys());
      if (filled.length === 0) {
        setShimmerIdx(null);
        return;
      }
      const pick = filled[Math.floor(Math.random() * filled.length)];
      setShimmerIdx(pick);
      trackTimeout(() => setShimmerIdx(null), 380);
    }, 2300);

    return () => {
      window.clearInterval(flickerTimer);
      window.clearInterval(shimmerTimer);
      for (const id of pending) window.clearTimeout(id);
      pending.clear();
    };
  }, []);

  const seed = useMemo(() => seedFromForecastId(forecastId), [forecastId]);
  const cellPieces = useMemo(
    () => Array.from({ length: slicesTotal }, (_, idx) => pickPuzzle(idx, seed)),
    [slicesTotal, seed],
  );

  const cells = Array.from({ length: slicesTotal }, (_, idx) => {
    const slice = completedIndexes.get(idx);
    if (!slice) return { state: "empty" as const, idx };
    if (now === null) return { state: "settled" as const, idx };
    const sinceArrival = now - slice.arrivedAt;
    if (sinceArrival < 700) return { state: "arrived" as const, idx };
    return { state: "settled" as const, idx };
  });

  const settledCount = cells.filter((c) => c.state !== "empty").length;

  const firstArrivalTs = orderedByTimestamp[0]?.arrivedAt;
  const phase: "warming" | "running" | "sealed" =
    settledCount === 0
      ? "warming"
      : settledCount < slicesTotal
        ? "running"
        : "sealed";
  const etaSeconds = (() => {
    if (phase !== "running") return null;
    if (!firstArrivalTs || now === null) return null;
    const elapsedMs = now - firstArrivalTs;
    if (elapsedMs <= 0 || settledCount === 0) return null;
    const perSliceMs = elapsedMs / settledCount;
    const remaining = slicesTotal - settledCount;
    return Math.max(1, Math.round((perSliceMs * remaining) / 1000));
  })();
  const fillPercent =
    slicesTotal === 0 ? 0 : Math.min(100, (settledCount / slicesTotal) * 100);

  return (
    <div className={cn("y2k-tile flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between">
        <UnitLabel>Catchment · assembling in timestamp order</UnitLabel>
        <span className="cirrus-num cirrus-text-unit">
          {settledCount}/{slicesTotal}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <div className="catchment-phase-track">
          {phase === "warming" ? (
            <div className="catchment-phase-shimmer" />
          ) : (
            <div
              className="catchment-phase-fill"
              style={{ width: `${fillPercent}%` }}
            />
          )}
        </div>
        <span
          className="cirrus-text-mono-id"
          style={{ fontSize: 11, opacity: 0.75 }}
        >
          {phase === "warming"
            ? "workers warming up · first slice in ~25s"
            : phase === "running"
              ? etaSeconds !== null
                ? `${settledCount} of ${slicesTotal} · ~${etaSeconds}s remaining`
                : `${settledCount} of ${slicesTotal} · estimating`
              : `sealed · ${slicesTotal}/${slicesTotal} slices`}
        </span>
      </div>

      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
        aria-label={`Catchment progress for forecast ${forecastId}: ${settledCount} of ${slicesTotal} slices`}
      >
        {cells.map((cell) => {
          const flicker = cell.state === "empty" && flickerIdx === cell.idx;
          const shimmer = cell.state === "settled" && shimmerIdx === cell.idx;
          const pieceUrl = `url("${cellPieces[cell.idx]}")`;
          return (
            <span
              key={cell.idx}
              className={cn(
                "catchment-cell",
                `catchment-cell-${cell.state}`,
                flicker && "catchment-cell-flicker",
                shimmer && "catchment-cell-shimmer",
              )}
              style={{
                aspectRatio: "1 / 1",
                maskImage: pieceUrl,
                WebkitMaskImage: pieceUrl,
              }}
            />
          );
        })}
      </div>

      {latestLine ? (
        <p className="cirrus-text-mono-id" style={{ fontSize: 11 }}>
          <span style={{ color: "#1f1840", fontWeight: 600 }}>
            &raquo; {latestLine.timestamp}
          </span>{" "}
          <span style={{ opacity: 0.85 }}>&quot;{latestLine.text}&quot;</span>
        </p>
      ) : (
        <p className="cirrus-text-mono-id catchment-waiting" style={{ fontSize: 11 }}>
          waiting for first slice
          <span className="catchment-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      )}

      <style>{`
        .catchment-cell {
          position: relative;
          overflow: hidden;
          background: rgba(31, 24, 64, 0.16);
          mask-repeat: no-repeat;
          mask-size: 100% 100%;
          mask-position: center;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-size: 100% 100%;
          -webkit-mask-position: center;
          transition: background 700ms var(--ease-settle);
        }
        .catchment-cell-empty {
          background: rgba(31, 24, 64, 0.16);
        }
        .catchment-cell-flicker {
          animation: cell-flicker 220ms ease-out;
        }
        .catchment-cell-arrived::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--y2k-titlebar-pink);
          animation: cell-fill 320ms cubic-bezier(0.18, 0.75, 0.25, 1) forwards;
        }
        .catchment-cell-arrived::after {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--y2k-accent-lavender);
          transform: translateY(100%);
          animation: cell-fill 320ms cubic-bezier(0.18, 0.75, 0.25, 1) 320ms forwards;
        }
        .catchment-cell-settled {
          background: var(--y2k-accent-lavender);
        }
        .catchment-cell-shimmer {
          animation: cell-shimmer 380ms ease-in-out;
        }
        @keyframes cell-flicker {
          0%   { background: rgba(31, 24, 64, 0.16); }
          45%  { background: var(--y2k-titlebar-lavender); }
          100% { background: rgba(31, 24, 64, 0.16); }
        }
        @keyframes cell-fill {
          to { transform: translateY(0); }
        }
        @keyframes cell-shimmer {
          0%, 100% { background: var(--y2k-accent-lavender); }
          50%      { background: var(--y2k-titlebar-pink); }
        }
        .catchment-waiting {
          opacity: 0.6;
        }
        .catchment-dots span {
          display: inline-block;
          opacity: 0;
          animation: dot-blink 1.4s infinite;
        }
        .catchment-dots span:nth-child(2) { animation-delay: 0.2s; }
        .catchment-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-blink {
          0%, 80%, 100% { opacity: 0; }
          40%           { opacity: 1; }
        }
        .catchment-phase-track {
          height: 8px;
          background: var(--y2k-window);
          border: 1px solid var(--y2k-border);
          position: relative;
          overflow: hidden;
        }
        .catchment-phase-fill {
          height: 100%;
          background: var(--y2k-titlebar-pink);
          transition: width 320ms cubic-bezier(0.18, 0.75, 0.25, 1);
        }
        .catchment-phase-shimmer {
          position: absolute;
          top: 0;
          height: 100%;
          width: 30%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--y2k-titlebar-lavender, #cdb6ff) 50%,
            transparent 100%
          );
          animation: phase-shimmer-slide 1.4s linear infinite;
        }
        @keyframes phase-shimmer-slide {
          0%   { left: -30%; }
          100% { left: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .catchment-cell, .catchment-cell-arrived::before, .catchment-cell-arrived::after,
          .catchment-cell-flicker, .catchment-cell-shimmer, .catchment-dots span,
          .catchment-phase-shimmer, .catchment-phase-fill {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
          .catchment-phase-shimmer {
            left: 0 !important;
            width: 100% !important;
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}
