"use client";

import { useEffect, useState } from "react";
import { CatchmentAssembling } from "@/components/cirrus/signature/CatchmentAssembling";
import { FrontOpening } from "@/components/cirrus/signature/FrontOpening";
import { Pill } from "@/components/cirrus/primitives/Pill";

type Completed = {
  chunkIndex: number;
  timestampStart: number;
  timestampEnd: number;
  text?: string;
  arrivedAt: number;
};

type Props = {
  forecastId: string;
  slicesTotal: number;
  initialCompleted: Completed[];
};

type SnapshotPayload = {
  type: "snapshot";
  forecast: {
    status: string;
    slices: Array<{
      chunkIndex: number;
      timestampStart: number;
      timestampEnd: number;
      outputText: string | null;
      completedAt: string | null;
      status: string;
    }>;
    catchment: { bundleUrl: string; slicesCompleted: number } | null;
  };
};

type SliceArrivedEvent = {
  type: "slice:arrived";
  forecastId: string;
  chunkIndex: number;
  timestampStart: number;
  timestampEnd: number;
  text: string;
  ts: number;
};

type CatchmentSealedEvent = {
  type: "catchment:sealed";
  forecastId: string;
  bundleUrl: string;
  slicesCompleted: number;
};

type ForecastFailedEvent = {
  type: "forecast:failed";
  forecastId: string;
  reason: string;
};

type FrontOpeningEvent = {
  type: "front:opening";
  forecastId: string;
  total: number;
};

export function ForecastDetailLive({ forecastId, slicesTotal, initialCompleted }: Props) {
  const [completed, setCompleted] = useState<Completed[]>(initialCompleted);
  const [latestLine, setLatestLine] = useState<{ timestamp: string; text: string } | undefined>(() => {
    const last = initialCompleted[initialCompleted.length - 1];
    if (!last || !last.text) return undefined;
    return { timestamp: formatTimestamp(last.timestampStart), text: last.text };
  });
  const [status, setStatus] = useState<"queued" | "active" | "sealing" | "sealed" | "failed">("queued");
  const [bundleUrl, setBundleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/forecasts/${forecastId}/stream`);

    source.addEventListener("snapshot", (e) => {
      try {
        const payload = JSON.parse((e as MessageEvent).data) as SnapshotPayload;
        if (payload.forecast?.status) {
          const s = payload.forecast.status;
          if (s === "queued" || s === "active" || s === "sealing" || s === "sealed" || s === "failed") {
            setStatus(s);
          }
        }
        if (payload.forecast?.catchment) {
          setBundleUrl(payload.forecast.catchment.bundleUrl);
        }
      } catch {
        // ignore
      }
    });

    source.addEventListener("front-opening", () => setStatus("active"));

    source.addEventListener("slice-arrived", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as SliceArrivedEvent;
        setCompleted((prev) => {
          if (prev.some((p) => p.chunkIndex === event.chunkIndex)) return prev;
          return [
            ...prev,
            {
              chunkIndex: event.chunkIndex,
              timestampStart: event.timestampStart,
              timestampEnd: event.timestampEnd,
              text: event.text,
              arrivedAt: event.ts,
            },
          ];
        });
        setLatestLine({ timestamp: formatTimestamp(event.timestampStart), text: event.text });
      } catch {
        // ignore
      }
    });

    source.addEventListener("catchment-sealed", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as CatchmentSealedEvent;
        setStatus("sealed");
        setBundleUrl(event.bundleUrl);
      } catch {
        // ignore
      }
    });

    source.addEventListener("forecast-failed", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as ForecastFailedEvent;
        setStatus("failed");
        setError(event.reason);
      } catch {
        // ignore
      }
    });

    source.onerror = () => {
      // EventSource auto-reconnects; mostly here to suppress noisy logs
    };

    return () => source.close();
  }, [forecastId]);

  return (
    <div className="flex flex-col gap-4">
      <FrontOpening
        forecastId={forecastId.slice(-4)}
        title={`${slicesTotal} slices · k=2 redundancy`}
        status={status === "queued" ? "queued" : status === "failed" ? "queued" : status}
        cyclesDispatching={slicesTotal * 2 * 14}
        nodes={47}
        etaMinMin={4}
        etaMaxMin={7}
      />

      <CatchmentAssembling
        forecastId={forecastId}
        slicesTotal={slicesTotal}
        slicesCompleted={completed}
        latestLine={latestLine}
      />

      {bundleUrl ? (
        <div className="cirrus-card p-3 flex items-center justify-between">
          <span className="cirrus-text-body-sm">Catchment sealed.</span>
          <a
            href={bundleUrl}
            className="inline-flex items-center px-3 py-1.5 rounded-md cirrus-text-body-sm"
            style={{ background: "var(--color-ink-900)", color: "var(--color-cream)" }}
          >
            Download bundle →
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="cirrus-card p-3 flex items-center gap-3">
          <Pill tone="coral">Failed</Pill>
          <span className="cirrus-text-body-sm">{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
