"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { MonoNumber } from "@/components/cirrus/primitives/MonoNumber";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { Button } from "@/components/ui/Button";
import { AudioFilePicker, type AudioMeta } from "@/components/ui/AudioFilePicker";

type Props = {
  dcpMode: "live" | "cached" | "hardcode";
  fixtureName: string;
};

const COST_PER_KC_CENTS = 2.9;
const CYCLES_PER_CHUNK = 14;

export function TranscribeFlow({ dcpMode, fixtureName }: Props) {
  const router = useRouter();
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preview = useMemo(() => {
    if (!meta) return null;
    const seconds = meta.estimatedSeconds || 0;
    const chunks = Math.max(1, Math.ceil(seconds / 30));
    const cycles = chunks * CYCLES_PER_CHUNK;
    const cents = Math.max(50, Math.ceil((cycles / 1000) * COST_PER_KC_CENTS * 100));
    return {
      chunks,
      cycles,
      costUsd: cents / 100,
      durationLabel: formatDuration(seconds),
    };
  }, [meta]);

  function submit() {
    if (!meta) {
      setError("Drop an audio file first.");
      return;
    }
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.append("audio", meta.file);
      fd.append("estimatedSeconds", String(meta.estimatedSeconds || 0));
      if (dcpMode === "cached") fd.append("fixtureName", fixtureName);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Submission failed");
        return;
      }
      router.push(`/client/forecasts/${body.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-8 pt-4 max-w-[820px]">
      <header className="flex flex-col gap-2">
        <UnitLabel>Cast a Forecast</UnitLabel>
        <h1 className="cirrus-text-h1">Transcribe an audio file.</h1>
        <p className="cirrus-text-body opacity-75 max-w-[640px]">
          Drop a podcast, lecture, or interview. Strata splits it into
          thirty-second slices and dispatches each one to the Sky. You'll watch
          slices return in real time and read the finished transcript when the
          last one lands.
        </p>
      </header>

      <ModeBanner mode={dcpMode} />

      <section className="flex flex-col gap-3">
        <UnitLabel>Step 1 · Upload</UnitLabel>
        <AudioFilePicker onFile={setMeta} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="cirrus-card p-5 flex flex-col gap-3">
          <UnitLabel>What gets sent</UnitLabel>
          <div className="flex flex-col gap-2">
            <Row label="File">
              <span className="cirrus-text-body truncate" title={meta?.name}>
                {meta?.name ?? "—"}
              </span>
            </Row>
            <Row label="Audio length">
              <span className="cirrus-text-body">
                {preview?.durationLabel ?? "—"}
              </span>
            </Row>
            <Row label="Slices">
              <span className="cirrus-text-body">
                {preview ? `${preview.chunks} × 30s windows` : "—"}
              </span>
            </Row>
            <Row label="Language">
              <span className="cirrus-text-body">English (Whisper-tiny)</span>
            </Row>
            <Row label="Output">
              <span className="cirrus-text-body">SRT transcript</span>
            </Row>
          </div>
          <p className="cirrus-text-body-sm opacity-60 mt-1">
            Each slice runs in a sandboxed browser tab on the Sky. The Node
            sees only its slice, never the full file.
          </p>
        </div>

        <div className="cirrus-card p-5 flex flex-col gap-3">
          <UnitLabel>What you'll get back</UnitLabel>
          <div className="flex flex-col gap-2">
            <Row label="Transcript">
              <span className="cirrus-text-body">
                {preview ? `~${preview.chunks} captioned segments` : "—"}
              </span>
            </Row>
            <Row label="Attestations">
              <span className="cirrus-text-body">
                {preview ? `${preview.chunks} signed receipts` : "—"}
              </span>
            </Row>
            <Row label="Cycles used">
              <span className="cirrus-text-body">
                {preview ? `~${preview.cycles}` : "—"}
              </span>
            </Row>
            <Row label="Estimated cost">
              <MonoNumber className="cirrus-text-h2">
                {preview ? `$${preview.costUsd.toFixed(2)}` : "$—"}
              </MonoNumber>
            </Row>
          </div>
          <p className="cirrus-text-body-sm opacity-60 mt-1">
            You're charged once on seal. The Catchment includes the SRT bundle,
            per-slice attestations, and the scheduler signature.
          </p>
        </div>
      </section>

      {error ? (
        <p
          className="cirrus-text-body-sm"
          style={{ color: "var(--color-coral-700)" }}
        >
          {error}
        </p>
      ) : null}

      <section className="flex items-center justify-between cirrus-card p-5">
        <div className="flex flex-col gap-1">
          <UnitLabel>Step 2 · Cast</UnitLabel>
          <span className="cirrus-text-body-sm opacity-70">
            Once you cast, the Front opens and slices begin to arrive.
          </span>
        </div>
        <Button onClick={submit} disabled={!meta || pending} size="lg">
          {pending ? "Casting…" : "Cast Forecast →"}
        </Button>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="cirrus-text-mono-id opacity-60">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ModeBanner({ mode }: { mode: "live" | "cached" | "hardcode" }) {
  const info: Record<typeof mode, { tone: "coral" | "sage" | "butter"; label: string; body: string }> = {
    live: {
      tone: "coral",
      label: "Live DCP",
      body: "Slices dispatch to real DCP browser-tab workers running whisper-tiny on WASM. Each slice takes 20-30s once a worker picks it up.",
    },
    cached: {
      tone: "sage",
      label: "Cached replay",
      body: "Replaying a real DCP capture with original timing. The transcript and per-slice attestations are real outputs from a previous live run.",
    },
    hardcode: {
      tone: "butter",
      label: "Hardcoded replay",
      body: "Synthetic in-process replay with hardcoded transcript lines. Smoke fallback only.",
    },
  };
  const info_ = info[mode];
  return (
    <div className="cirrus-card p-4 flex items-center gap-3">
      <Pill tone={info_.tone}>{info_.label}</Pill>
      <span className="cirrus-text-body-sm opacity-75">{info_.body}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
