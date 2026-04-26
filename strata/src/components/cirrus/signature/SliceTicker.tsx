"use client";

import { useEffect, useReducer, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export type SliceTickerEvent = {
  id: string;
  outcome: "landed" | "in-flight" | "settled";
  region?: "NA-east" | "NA-west" | "EU" | "APAC" | "other";
  ts: number;
};

type Props = {
  streamUrl?: string;
  maxVisible?: number;
  showRegions?: boolean;
  liveDemoFallback?: boolean;
  initialEvents?: SliceTickerEvent[];
  className?: string;
};

type State = {
  ticks: SliceTickerEvent[];
  perMinute: number;
  byRegion: Record<string, number>;
};

type Action =
  | { kind: "tick"; event: SliceTickerEvent }
  | { kind: "rate"; value: number };

function reducer(state: State, action: Action): State {
  if (action.kind === "rate") return { ...state, perMinute: action.value };

  const next = [...state.ticks, action.event].slice(-60);
  const region = action.event.region ?? "other";
  const byRegion = { ...state.byRegion, [region]: (state.byRegion[region] ?? 0) + 1 };
  return { ticks: next, perMinute: state.perMinute, byRegion };
}

export function SliceTicker({
  streamUrl,
  maxVisible = 60,
  showRegions = true,
  liveDemoFallback = false,
  initialEvents = [],
  className,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    ticks: initialEvents.slice(-maxVisible),
    perMinute: initialEvents.length,
    byRegion: {},
  });

  const announcerLastRef = useRef(0);

  useEffect(() => {
    if (!streamUrl) return;

    const source = new EventSource(streamUrl);
    source.addEventListener("slice", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as SliceTickerEvent;
        dispatch({ kind: "tick", event });

        const now = Date.now();
        if (now - announcerLastRef.current > 3000) {
          announcerLastRef.current = now;
        }
      } catch {
        // ignore malformed events
      }
    });
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [streamUrl]);

  useEffect(() => {
    if (!liveDemoFallback || streamUrl) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const outcomes: SliceTickerEvent["outcome"][] = ["landed", "landed", "in-flight", "settled"];
      const regions: SliceTickerEvent["region"][] = ["NA-east", "NA-west", "EU", "APAC"];
      dispatch({
        kind: "tick",
        event: {
          id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
          region: regions[Math.floor(Math.random() * regions.length)],
          ts: Date.now(),
        },
      });
      window.setTimeout(tick, 600 + Math.random() * 600);
    };
    const handle = window.setTimeout(tick, 800);
    return () => {
      stopped = true;
      window.clearTimeout(handle);
    };
  }, [liveDemoFallback, streamUrl]);

  const visible = state.ticks.slice(-maxVisible);
  const newest = visible[visible.length - 1];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "cirrus-card inline-flex items-center gap-3 px-3 py-1.5",
        className,
      )}
    >
      <span className="cirrus-text-mono-id opacity-60" style={{ fontSize: 9, letterSpacing: "0.10em" }}>
        SLICES · LIVE
      </span>

      <div
        className="flex items-end gap-[3px]"
        style={{ height: 14 }}
        aria-hidden="true"
      >
        {visible.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <span
                key={`idle-${i}`}
                className="block"
                style={{
                  width: 4,
                  height: 12,
                  borderRadius: 1,
                  background: "rgba(13,24,40,0.12)",
                }}
              />
            ))
          : visible.map((event, i) => {
              const isNewest = event.id === newest?.id;
              const color = colorFor(event.outcome);
              return (
                <span
                  key={event.id}
                  className="block tick-cell"
                  style={{
                    width: isNewest ? 5 : 4,
                    height: isNewest ? 14 : 12,
                    borderRadius: 1,
                    background: color,
                    boxShadow: isNewest ? `0 0 6px ${color}` : "none",
                    opacity: isNewest ? 1 : 0.85,
                    transition: "opacity 1500ms var(--ease-out), box-shadow 1500ms var(--ease-out)",
                    animation: isNewest && i === visible.length - 1 ? "tick-in 200ms var(--ease-out)" : "none",
                  }}
                />
              );
            })}
      </div>

      {showRegions ? (
        <span className="cirrus-text-mono-id opacity-70" style={{ fontSize: 9 }}>
          +{visible.length} / 60s
          {Object.entries(state.byRegion)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([region, count]) => ` · ${region.toUpperCase()} ${count}`)
            .join("")}
        </span>
      ) : null}

      <style>{`
        @keyframes tick-in {
          from { opacity: 0; transform: translateX(4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tick-cell { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

function colorFor(outcome: SliceTickerEvent["outcome"]): string {
  if (outcome === "landed") return "var(--color-coral-500)";
  if (outcome === "settled") return "var(--color-sage-500)";
  return "var(--color-ink-700)";
}
