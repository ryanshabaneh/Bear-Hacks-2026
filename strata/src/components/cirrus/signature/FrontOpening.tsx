"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { Pill } from "@/components/cirrus/primitives/Pill";

type Status = "queued" | "active" | "sealing" | "sealed";

type Props = {
  forecastId: string;
  title: string;
  status: Status;
  cyclesDispatching?: number;
  nodes?: number;
  etaMinMin?: number;
  etaMaxMin?: number;
  className?: string;
};

const STATUS_LABEL: Record<Status, { label: string; tone: "sage" | "coral" | "butter" | "neutral" }> = {
  queued: { label: "Queued", tone: "neutral" },
  active: { label: "Front open", tone: "coral" },
  sealing: { label: "Catchment sealing", tone: "butter" },
  sealed: { label: "Catchment sealed", tone: "sage" },
};

export function FrontOpening({
  forecastId,
  title,
  status,
  cyclesDispatching,
  nodes,
  etaMinMin = 18,
  etaMaxMin = 24,
  className,
}: Props) {
  const [previousStatus, setPreviousStatus] = useState<Status>(status);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (previousStatus === "queued" && status === "active") {
      setAnimating(true);
      const id = window.setTimeout(() => setAnimating(false), 1500);
      setPreviousStatus(status);
      return () => window.clearTimeout(id);
    }
    setPreviousStatus(status);
  }, [status, previousStatus]);

  const showStaticActiveBackdrop = status === "active" || status === "sealing" || status === "sealed";
  const meta = STATUS_LABEL[status];

  return (
    <div
      className={cn(
        "forecast-tile relative overflow-hidden p-4 cirrus-card",
        showStaticActiveBackdrop ? "front-tile-active" : "",
        animating ? "front-tile-animating" : "",
        className,
      )}
      style={{
        background: showStaticActiveBackdrop ? "var(--surface-inverse)" : undefined,
        color: showStaticActiveBackdrop ? "var(--color-cream)" : undefined,
        borderRadius: "var(--radius-lg)",
      }}
      data-forecast-id={forecastId}
    >
      {showStaticActiveBackdrop ? (
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line
            x1="-2"
            y1="50"
            x2="102"
            y2="50"
            stroke="#f4885a"
            strokeWidth="1.5"
            opacity="0.5"
            className={animating ? "front-sweep-line" : undefined}
          />
          <line
            x1="-2"
            y1="50"
            x2="102"
            y2="50"
            stroke="#f4885a"
            strokeWidth="4"
            opacity="0.15"
            className={animating ? "front-sweep-halo" : undefined}
          />
          <circle cx="22" cy="22" r="0.6" fill="#f4885a" />
          <circle cx="44" cy="78" r="0.6" fill="#f4885a" />
          <circle cx="66" cy="34" r="0.6" fill="#f4885a" />
          <circle cx="88" cy="68" r="0.6" fill="#f4885a" />
        </svg>
      ) : null}

      <div className="relative z-[2] flex flex-col gap-2">
        <header className="flex items-center justify-between">
          <UnitLabel className={showStaticActiveBackdrop ? "text-cream" : ""}>
            Forecast · {forecastId.toUpperCase()}
          </UnitLabel>
          <Pill tone={meta.tone}>{meta.label}</Pill>
        </header>

        <h3 className="cirrus-text-h2">{title}</h3>

        {status !== "queued" ? (
          <p className="cirrus-text-body-sm opacity-80">
            {cyclesDispatching ? `${cyclesDispatching} cycles dispatching` : "dispatch underway"}
            {nodes ? ` across ${nodes} nodes` : ""}
            {status !== "sealed" ? ` · ETA ${etaMinMin}–${etaMaxMin} min` : ""}
          </p>
        ) : (
          <p className="cirrus-text-body-sm opacity-60">queued · waiting for next Front</p>
        )}
      </div>

      <style>{`
        .front-sweep-line {
          stroke-dasharray: 110;
          stroke-dashoffset: 110;
          animation: front-sweep 800ms var(--ease-out) 400ms forwards;
        }
        .front-sweep-halo {
          stroke-dasharray: 110;
          stroke-dashoffset: 110;
          animation: front-sweep 800ms var(--ease-out) 400ms forwards;
        }
        @keyframes front-sweep {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .front-sweep-line, .front-sweep-halo {
            animation: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
