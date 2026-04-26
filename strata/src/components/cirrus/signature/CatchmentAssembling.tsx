"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";

type CompletedSlice = {
  chunkIndex: number;
  timestampStart: number;
  timestampEnd: number;
  text?: string;
  arrivedAt: number;
};

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

  const cells = Array.from({ length: slicesTotal }, (_, idx) => {
    const slice = completedIndexes.get(idx);
    if (!slice) return { state: "empty" as const, idx };
    if (now === null) return { state: "settled" as const, idx };
    const sinceArrival = now - slice.arrivedAt;
    if (sinceArrival < 700) return { state: "arrived" as const, idx };
    return { state: "settled" as const, idx };
  });

  const settledCount = cells.filter((c) => c.state !== "empty").length;

  return (
    <div className={cn("cirrus-card p-3.5 flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between">
        <UnitLabel>Catchment · assembling in timestamp order</UnitLabel>
        <span className="cirrus-num cirrus-text-unit">
          {settledCount}/{slicesTotal}
        </span>
      </header>

      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
        aria-label={`Catchment progress for forecast ${forecastId}: ${settledCount} of ${slicesTotal} slices`}
      >
        {cells.map((cell) => (
          <span
            key={cell.idx}
            className={`catchment-cell catchment-cell-${cell.state}`}
            style={{ aspectRatio: "1 / 1", borderRadius: 2 }}
          />
        ))}
      </div>

      {latestLine ? (
        <p className="cirrus-text-mono-id" style={{ fontSize: 10.5 }}>
          <span style={{ color: "var(--color-coral-500)", fontWeight: 500 }}>
            → {latestLine.timestamp}
          </span>{" "}
          <span className="opacity-80">"{latestLine.text}"</span>
        </p>
      ) : (
        <p className="cirrus-text-mono-id opacity-60" style={{ fontSize: 10.5 }}>
          waiting for first slice…
        </p>
      )}

      <style>{`
        .catchment-cell {
          transition: background var(--dur-event) var(--ease-out);
        }
        .catchment-cell-empty {
          background: rgba(255,255,255,0.25);
          border: 0.5px solid rgba(255,255,255,0.40);
        }
        .catchment-cell-arrived {
          background: var(--color-coral-500);
        }
        .catchment-cell-settled {
          background: rgba(13,24,40,0.40);
        }
        @media (prefers-reduced-motion: reduce) {
          .catchment-cell { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
