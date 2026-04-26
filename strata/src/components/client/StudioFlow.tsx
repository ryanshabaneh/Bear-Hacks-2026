"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Window } from "@/components/ui/Window";
import { MultiFileDropzone, type DroppedFile } from "./MultiFileDropzone";

type ForecastItem = {
  id: string;
  status: "queued" | "active" | "sealing" | "sealed" | "failed" | string;
  fileName: string;
  audioHoursTotal: number;
  budgetCents: number;
  budgetCyclesUsed: number;
  slicesTotal: number;
  slicesCompleted: number;
  bundleUrl: string | null;
  createdAt: string;
  sealedAt: string | null;
};

type PendingFile = DroppedFile & { localId: string };

type UploadInFlight = {
  localId: string;
  name: string;
  sizeBytes: number;
  estimatedSeconds: number;
  isVideo: boolean;
};

type Props = {
  initialForecasts: ForecastItem[];
};

const POLL_MS = 2000;
const COST_PER_KC_CENTS = 2.9;
const ESTIMATED_CYCLES_PER_CHUNK = 14;

export function StudioFlow({ initialForecasts }: Props) {
  const [forecasts, setForecasts] = useState<ForecastItem[]>(initialForecasts);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploads, setUploads] = useState<UploadInFlight[]>([]);
  const [autoQueue, setAutoQueue] = useState(false);
  const [autoCast, setAutoCast] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [busy, startTransition] = useTransition();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const autoCastFired = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const aq = window.localStorage.getItem("strata.autoQueue");
      const ac = window.localStorage.getItem("strata.autoCast");
      if (aq !== null) setAutoQueue(aq === "1");
      if (ac !== null) setAutoCast(ac === "1");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("strata.autoQueue", autoQueue ? "1" : "0");
    } catch {
      // ignore
    }
  }, [autoQueue, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("strata.autoCast", autoCast ? "1" : "0");
    } catch {
      // ignore
    }
  }, [autoCast, hydrated]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const response = await fetch("/api/forecasts", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { forecasts: ForecastItem[] };
        if (!cancelled) setForecasts(body.forecasts);
      } catch {
        // ignore
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    }
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!autoCast) return;
    const queued = forecasts.filter((forecast) => forecast.status === "queued");
    for (const forecast of queued) {
      if (autoCastFired.current.has(forecast.id)) continue;
      autoCastFired.current.add(forecast.id);
      void cast(forecast.id);
    }
  }, [forecasts, autoCast]);

  function onFiles(files: DroppedFile[]) {
    setErrorBanner(null);
    if (files.length === 0) return;
    if (autoQueue) {
      for (const file of files) void queue(file);
    } else {
      const stamped = files.map((file) => ({
        ...file,
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }));
      setPending((prev) => [...prev, ...stamped]);
    }
  }

  async function queue(file: DroppedFile) {
    const localId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setUploads((prev) => [
      ...prev,
      {
        localId,
        name: file.name,
        sizeBytes: file.sizeBytes,
        estimatedSeconds: file.estimatedSeconds,
        isVideo: file.isVideo,
      },
    ]);

    const form = new FormData();
    form.append("audio", file.file);
    form.append("estimatedSeconds", String(file.estimatedSeconds || 0));
    try {
      const response = await fetch("/api/transcribe/queue", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorBanner(`Queue rejected ${file.name}: ${body.error ?? response.status}`);
        setUploads((prev) => prev.filter((upload) => upload.localId !== localId));
        return;
      }
      const body = (await response.json()) as {
        id: string;
        status: string;
        fileName?: string;
        audioHoursTotal?: number;
        budgetCents?: number;
        estimatedChunks?: number;
      };
      setPending((prev) =>
        prev.filter(
          (item) =>
            item.name !== file.name || item.sizeBytes !== file.sizeBytes,
        ),
      );
      setUploads((prev) => prev.filter((upload) => upload.localId !== localId));
      setForecasts((prev) => {
        if (prev.some((forecast) => forecast.id === body.id)) return prev;
        const audioHoursTotal = body.audioHoursTotal ?? file.estimatedSeconds / 3600;
        const estimatedChunks =
          body.estimatedChunks ?? Math.max(1, Math.ceil(file.estimatedSeconds / 30));
        const estimatedCycles = estimatedChunks * ESTIMATED_CYCLES_PER_CHUNK;
        const budgetCents =
          body.budgetCents ??
          Math.max(50, Math.ceil((estimatedCycles / 1000) * COST_PER_KC_CENTS * 100));
        const optimistic: ForecastItem = {
          id: body.id,
          status: "queued",
          fileName: body.fileName ?? file.name,
          audioHoursTotal,
          budgetCents,
          budgetCyclesUsed: 0,
          slicesTotal: estimatedChunks,
          slicesCompleted: 0,
          bundleUrl: null,
          createdAt: new Date().toISOString(),
          sealedAt: null,
        };
        return [optimistic, ...prev];
      });
      if (autoCast && body.id) {
        autoCastFired.current.add(body.id);
        void cast(body.id);
      }
    } catch (error) {
      setUploads((prev) => prev.filter((upload) => upload.localId !== localId));
      setErrorBanner(`Queue failed ${file.name}: ${(error as Error).message}`);
    }
  }

  async function cast(forecastId: string) {
    try {
      const response = await fetch(`/api/forecasts/${forecastId}/cast`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorBanner(`Cast rejected: ${body.error ?? response.status}`);
      }
    } catch (error) {
      setErrorBanner(`Cast failed: ${(error as Error).message}`);
    }
  }

  function castAllQueued() {
    startTransition(async () => {
      const queued = forecasts.filter((forecast) => forecast.status === "queued");
      for (const forecast of queued) {
        await cast(forecast.id);
      }
    });
  }

  function queueAllPending() {
    startTransition(async () => {
      const items = [...pending];
      for (const item of items) {
        await queue(item);
      }
    });
  }

  function dropPending(localId: string) {
    setPending((prev) => prev.filter((item) => item.localId !== localId));
  }

  const queued = forecasts.filter((forecast) => forecast.status === "queued");
  const active = forecasts.filter((forecast) =>
    ["active", "sealing"].includes(forecast.status),
  );
  const recent = forecasts.filter((forecast) => forecast.status === "sealed");

  return (
    <div className="flex flex-col gap-7">
      <Window title="controls.exe" titleBarTone="lavender" sparkles={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ToggleRow
            label="Auto-queue"
            description="Dropped files go straight to the line."
            checked={autoQueue}
            onChange={setAutoQueue}
          />
          <ToggleRow
            label="Auto-cast"
            description="Queued Forecasts fire without waiting."
            checked={autoCast}
            onChange={setAutoCast}
          />
        </div>
      </Window>

      <Window title="dropzone.exe" titleBarTone="pink" sparkles={false}>
        <MultiFileDropzone onFiles={onFiles} />
      </Window>

      {errorBanner ? (
        <div
          className="y2k-tile"
          style={{ background: "var(--y2k-window-pink)", color: "var(--y2k-border)" }}
        >
          <span className="y2k-mono" style={{ fontSize: 12 }}>
            {errorBanner}
          </span>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <Window title={`pending.exe · ${pending.length}`} titleBarTone="cream" sparkles={false}>
          <div className="flex items-center justify-between mb-3">
            <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.75 }}>
              Review before sending to the queue.
            </span>
            <Button onClick={queueAllPending} disabled={busy}>
              Add all to queue
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pending.map((item) => (
              <PendingTile
                key={item.localId}
                item={item}
                onAdd={() => void queue(item)}
                onDrop={() => dropPending(item.localId)}
              />
            ))}
          </div>
        </Window>
      ) : null}

      <Window
        title={`queue.exe · ${uploads.length} uploading · ${queued.length} waiting · ${active.length} casting`}
        titleBarTone="lavender"
        sparkles={false}
      >
        <div className="flex items-center justify-end mb-3">
          {queued.length > 0 ? (
            <Button onClick={castAllQueued} disabled={busy}>
              Cast all
            </Button>
          ) : null}
        </div>
        {uploads.length === 0 && queued.length === 0 && active.length === 0 ? (
          <div
            className="y2k-tile y2k-tile-cream text-center"
            style={{ padding: "20px" }}
          >
            <span className="y2k-mono" style={{ fontSize: 12 }}>
              Nothing in the queue. Drop a file above and Strata will pick it up.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uploads.map((upload) => (
              <UploadingTile key={upload.localId} upload={upload} />
            ))}
            {queued.map((forecast) => (
              <QueueTile
                key={forecast.id}
                forecast={forecast}
                onCast={() => void cast(forecast.id)}
              />
            ))}
            {active.map((forecast) => (
              <ActiveTile key={forecast.id} forecast={forecast} />
            ))}
          </div>
        )}
      </Window>

      {recent.length > 0 ? (
        <Window
          title={`history.exe · ${recent.length}`}
          titleBarTone="cream"
          sparkles={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.slice(0, 9).map((forecast) => (
              <SealedTile key={forecast.id} forecast={forecast} />
            ))}
          </div>
        </Window>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 px-3 py-3 text-left transition-colors"
      style={{
        border: "1.5px solid var(--y2k-border)",
        background: checked ? "var(--y2k-window-pink)" : "var(--y2k-window)",
        boxShadow: "2px 2px 0 0 var(--y2k-shadow)",
      }}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className="y2k-mono"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--y2k-border)" }}
        >
          {label}
        </span>
        <span
          className="y2k-mono"
          style={{ fontSize: 11, color: "var(--y2k-border)", opacity: 0.7 }}
        >
          {description}
        </span>
      </div>
      <span className="y2k-toggle" data-on={checked} aria-hidden="true">
        <span className="y2k-toggle-knob" />
      </span>
    </button>
  );
}

function PendingTile({
  item,
  onAdd,
  onDrop,
}: {
  item: PendingFile;
  onAdd: () => void;
  onDrop: () => void;
}) {
  return (
    <div className="y2k-tile flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="cirrus-text-unit">Pending</span>
        <span className="cirrus-pill cirrus-pill-butter">
          {item.isVideo ? "video" : "audio"}
        </span>
      </div>
      <span
        className="y2k-mono truncate"
        style={{ fontSize: 13, fontWeight: 600 }}
        title={item.name}
      >
        {item.name}
      </span>
      <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB · {formatDuration(item.estimatedSeconds)}
      </span>
      <div className="flex items-center gap-2 mt-1">
        <Button onClick={onAdd}>Add to queue</Button>
        <button type="button" onClick={onDrop} className="y2k-link" style={{ fontSize: 11 }}>
          Drop
        </button>
      </div>
    </div>
  );
}

function UploadingTile({ upload }: { upload: UploadInFlight }) {
  return (
    <div className="y2k-tile flex flex-col gap-2 relative">
      <div className="flex items-center justify-between">
        <span className="cirrus-text-unit">Uploading</span>
        <span className="cirrus-pill cirrus-pill-butter">in flight</span>
      </div>
      <span
        className="y2k-mono truncate"
        style={{ fontSize: 13, fontWeight: 600 }}
        title={upload.name}
      >
        {upload.name}
      </span>
      <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {(upload.sizeBytes / (1024 * 1024)).toFixed(1)} MB · {formatDuration(upload.estimatedSeconds)}
      </span>
      <div className="y2k-progress" style={{ marginTop: 4 }}>
        <div
          className="y2k-progress-fill"
          style={{
            width: "40%",
            animation: "studio-pulse 900ms ease-in-out infinite alternate",
          }}
        />
      </div>
      <style>{`
        @keyframes studio-pulse {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function QueueTile({
  forecast,
  onCast,
}: {
  forecast: ForecastItem;
  onCast: () => void;
}) {
  return (
    <div className="y2k-tile y2k-tile-cream flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="cirrus-text-unit">
          Forecast · {forecast.id.slice(-4).toUpperCase()}
        </span>
        <span className="cirrus-pill cirrus-pill-butter">queued</span>
      </div>
      <span
        className="y2k-mono truncate"
        style={{ fontSize: 13, fontWeight: 600 }}
        title={forecast.fileName}
      >
        {forecast.fileName}
      </span>
      <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {(forecast.audioHoursTotal * 60).toFixed(1)} min · est ${(
          forecast.budgetCents / 100
        ).toFixed(2)}
      </span>
      <div className="flex items-center gap-2 mt-1">
        <Button onClick={onCast}>Cast now</Button>
        <Link href={`/client/forecasts/${forecast.id}`} className="y2k-link" style={{ fontSize: 11 }}>
          Open
        </Link>
      </div>
    </div>
  );
}

function ActiveTile({ forecast }: { forecast: ForecastItem }) {
  const total = Math.max(forecast.slicesTotal, 1);
  const completed = forecast.slicesCompleted;
  const percent = Math.min(100, Math.round((completed / total) * 100));
  return (
    <Link
      href={`/client/forecasts/${forecast.id}`}
      className="y2k-tile y2k-tile-pink flex flex-col gap-2 transition-transform"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-center justify-between">
        <span className="cirrus-text-unit">
          Forecast · {forecast.id.slice(-4).toUpperCase()}
        </span>
        <span className="cirrus-pill cirrus-pill-coral">
          {forecast.status === "sealing" ? "sealing" : "casting"}
        </span>
      </div>
      <span
        className="y2k-mono truncate"
        style={{ fontSize: 13, fontWeight: 600 }}
        title={forecast.fileName}
      >
        {forecast.fileName}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="cirrus-num" style={{ fontSize: 22, fontWeight: 700 }}>
          {completed}/{forecast.slicesTotal}
        </span>
        <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
          slices in
        </span>
      </div>
      <div className="y2k-progress">
        <div className="y2k-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

function SealedTile({ forecast }: { forecast: ForecastItem }) {
  return (
    <Link
      href={`/client/forecasts/${forecast.id}`}
      className="y2k-tile flex flex-col gap-2"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-center justify-between">
        <span className="cirrus-text-unit">
          Forecast · {forecast.id.slice(-4).toUpperCase()}
        </span>
        <span className="cirrus-pill cirrus-pill-sage">sealed</span>
      </div>
      <span
        className="y2k-mono truncate"
        style={{ fontSize: 13, fontWeight: 600 }}
        title={forecast.fileName}
      >
        {forecast.fileName}
      </span>
      <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {(forecast.audioHoursTotal * 60).toFixed(1)} min · cycles {forecast.budgetCyclesUsed}
      </span>
    </Link>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "duration unknown";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds - minutes * 60);
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}
