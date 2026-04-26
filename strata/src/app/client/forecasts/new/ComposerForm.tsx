"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Fixture = "short" | "demo";

const FIXTURE_META: Record<Fixture, { label: string; durationLabel: string; chunks: number }> = {
  short: { label: "Short test (90s)", durationLabel: "1.5 min", chunks: 3 },
  demo: { label: "Demo fixture (30 min)", durationLabel: "30:00", chunks: 60 },
};

export function ComposerForm() {
  const router = useRouter();
  const [fixture, setFixture] = useState<Fixture>("short");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const meta = FIXTURE_META[fixture];
  const estimatedCycles = meta.chunks * 2 * 14;
  const estimatedDollars = (estimatedCycles * 0.029).toFixed(2);

  function submit() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/forecasts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixture,
          languageScope: "English",
          outputFormats: ["srt"],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Submission failed");
        return;
      }
      const body = (await res.json()) as { id: string };
      router.push(`/client/forecasts/${body.id}`);
      router.refresh();
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-5 cirrus-card p-6"
      aria-label="Forecast composer"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="cirrus-text-unit pb-1">Fixture</legend>
        {(Object.keys(FIXTURE_META) as Fixture[]).map((key) => (
          <label
            key={key}
            className={`cursor-pointer flex items-center justify-between gap-3 px-3 py-2 rounded-md border transition-colors ${
              fixture === key
                ? "border-coral-500/60"
                : "border-transparent hover:border-ice-400/50"
            }`}
            style={{
              background:
                fixture === key
                  ? "rgba(244,136,90,0.08)"
                  : "rgba(255,255,255,0.30)",
            }}
          >
            <span className="flex flex-col gap-0.5">
              <span className="cirrus-text-body">{FIXTURE_META[key].label}</span>
              <span className="cirrus-text-mono-id opacity-60">
                {FIXTURE_META[key].chunks} chunks · k=2 redundancy
              </span>
            </span>
            <input
              type="radio"
              name="fixture"
              value={key}
              checked={fixture === key}
              onChange={() => setFixture(key)}
              className="sr-only"
            />
            <span aria-hidden className="cirrus-num cirrus-text-unit">
              {FIXTURE_META[key].durationLabel}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 cirrus-text-mono-id">
        <legend className="cirrus-text-unit pb-1">Estimate</legend>
        <div className="flex items-center justify-between">
          <span className="opacity-60">Cycles</span>
          <span className="cirrus-num">{estimatedCycles} kc</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-60">Cost @ $0.029/kc</span>
          <span className="cirrus-num" style={{ color: "var(--color-coral-700)" }}>
            ${estimatedDollars}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="opacity-60">Settles in</span>
          <span className="cirrus-num">~{Math.max(2, Math.round(meta.chunks / 12))} min</span>
        </div>
      </fieldset>

      {error ? (
        <p className="cirrus-text-body-sm" style={{ color: "var(--color-coral-700)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2.5 rounded-md cirrus-text-body transition-colors disabled:opacity-60 self-start"
        style={{ background: "var(--color-ink-900)", color: "var(--color-cream)" }}
      >
        {pending ? "Releasing…" : "Release →"}
      </button>
    </form>
  );
}
