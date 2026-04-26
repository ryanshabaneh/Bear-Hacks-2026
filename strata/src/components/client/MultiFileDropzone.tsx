"use client";

import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils/cn";

export type DroppedFile = {
  file: File;
  name: string;
  sizeBytes: number;
  estimatedSeconds: number;
  isVideo: boolean;
};

type Props = {
  onFiles: (files: DroppedFile[]) => void;
  className?: string;
  hint?: string;
};

const ACCEPT = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
  "audio/aac",
  "audio/*",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/*",
].join(",");

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const element: HTMLAudioElement | HTMLVideoElement = isVideo
      ? document.createElement("video")
      : new Audio();
    let settled = false;
    function done(value: number) {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    }
    element.preload = "metadata";
    element.addEventListener("loadedmetadata", () => {
      done(Number.isFinite(element.duration) ? element.duration : 0);
    });
    element.addEventListener("error", () => done(0));
    element.src = url;
    setTimeout(() => done(0), 4500);
  });
}

export function MultiFileDropzone({ onFiles, className, hint }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingest(fileList: FileList | File[]) {
    if (!fileList || (fileList as FileList).length === 0) return;
    setReading(true);
    const arr = Array.from(fileList);
    const probed = await Promise.all(
      arr.map(async (file) => {
        const seconds = await probeDuration(file);
        return {
          file,
          name: file.name,
          sizeBytes: file.size,
          estimatedSeconds: seconds,
          isVideo: file.type.startsWith("video/"),
        } satisfies DroppedFile;
      }),
    );
    setReading(false);
    onFiles(probed);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) void ingest(files);
  }

  return (
    <div
      className={cn("relative text-center", className)}
      style={{
        background: dragOver ? "var(--y2k-window-pink)" : "var(--y2k-window-cream)",
        border: "1.5px dashed var(--y2k-border)",
        padding: "32px 24px",
        transition: "background 120ms ease-out",
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void ingest(event.target.files);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={reading}
        className="w-full flex flex-col items-center gap-3 py-2 transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        <span
          className="y2k-mono"
          style={{ fontSize: 18, fontWeight: 700, color: "var(--y2k-border)" }}
        >
          {reading ? "reading metadata..." : "drop audio or video files."}
        </span>
        <span
          className="y2k-mono"
          style={{ fontSize: 11.5, opacity: 0.75, color: "var(--y2k-border)", maxWidth: 440 }}
        >
          {hint ?? "mp3, wav, ogg, flac, m4a, mp4, mov, webm. multiple files at once. each becomes a Forecast."}
        </span>
        <span className="y2k-button mt-2" style={{ pointerEvents: "none" }}>
          or click to browse
        </span>
      </button>
    </div>
  );
}
