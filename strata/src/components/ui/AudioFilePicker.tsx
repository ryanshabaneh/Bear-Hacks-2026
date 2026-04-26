"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils/cn";

export type AudioMeta = {
  file: File;
  name: string;
  sizeBytes: number;
  estimatedSeconds: number;
};

type Props = {
  onFile: (meta: AudioMeta | null) => void;
  className?: string;
};

const ACCEPT = "audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/x-m4a,audio/*";

function estimateDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    function resolveOnce(value: number) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    }
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => {
      resolveOnce(Number.isFinite(audio.duration) ? audio.duration : 0);
    });
    audio.addEventListener("error", () => resolveOnce(0));
    audio.src = url;
    setTimeout(() => resolveOnce(0), 4000);
  });
}

export function AudioFilePicker({ onFile, className }: Props) {
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(file: File) {
    setReading(true);
    const seconds = await estimateDurationSeconds(file);
    const next: AudioMeta = {
      file,
      name: file.name,
      sizeBytes: file.size,
      estimatedSeconds: seconds,
    };
    setMeta(next);
    onFile(next);
    setReading(false);
  }

  function clear() {
    setMeta(null);
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void accept(file);
  }

  return (
    <div
      className={cn(
        "cirrus-card p-6 transition-colors",
        dragOver && "ring-2 ring-coral-500/40",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void accept(file);
        }}
      />

      {!meta ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 text-center py-6 transition-opacity hover:opacity-80"
        >
          <span className="cirrus-text-h2">Drop an audio file here.</span>
          <span className="cirrus-text-body-sm opacity-60">
            mp3, wav, ogg, flac, m4a, up to about 60 minutes.
          </span>
          <span className="mt-1 inline-flex items-center y2k-button">
            or click to browse
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="cirrus-text-unit opacity-70">Loaded</span>
            <span className="cirrus-text-h2 truncate" title={meta.name}>
              {meta.name}
            </span>
            <span className="cirrus-text-body-sm opacity-60">
              {(meta.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              {meta.estimatedSeconds > 0
                ? ` · ${formatDuration(meta.estimatedSeconds)}`
                : reading
                  ? " · reading…"
                  : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            className="cirrus-text-body-sm opacity-60 hover:opacity-100 underline"
          >
            Replace
          </button>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
