"use client";

import { useEffect, useRef, useState } from "react";
import { AD_DURATION_MS, SONGS_PER_BREAK, getBreakMode } from "@/lib/settings";
import { runCompute } from "@/lib/compute";

type Song = { name: string; src: string };

export default function PlayerPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [breakActive, setBreakActive] = useState<null | "ad" | "compute">(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadSongs() {
    try {
      const r = await fetch("/api/songs", { cache: "no-store" });
      const d: { songs: Song[] } = await r.json();
      setSongs(d.songs);
    } catch {
      setSongs([]);
    }
  }

  useEffect(() => {
    loadSongs();
  }, []);

  const current = songs[index];

  async function triggerBreak() {
    const mode = getBreakMode();
    setBreakActive(mode);
    if (mode === "ad") {
      const ad = new Audio("/ad/ad.mp3");
      ad.play().catch(() => {});
      await new Promise((res) => setTimeout(res, AD_DURATION_MS));
      ad.pause();
    } else {
      await runCompute();
    }
    setBreakActive(null);
  }

  async function handleEnded() {
    const next = playCount + 1;
    setPlayCount(next);
    if (next % SONGS_PER_BREAK === 0) {
      await triggerBreak();
    }
    setIndex((i) => (songs.length ? (i + 1) % songs.length : 0));
    setIsPlaying(true);
  }

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && !breakActive) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, index, breakActive]);

  function play() {
    if (!current) return;
    setIsPlaying(true);
  }

  function pause() {
    setIsPlaying(false);
  }

  function next() {
    setIndex((i) => (songs.length ? (i + 1) % songs.length : 0));
  }

  function prev() {
    setIndex((i) => (songs.length ? (i - 1 + songs.length) % songs.length : 0));
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".mp3"));
    if (!files.length) {
      setUploadMsg("Only .mp3 files are accepted.");
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      const r = await fetch("/api/songs", { method: "POST", body: fd });
      const d: { saved: string[] } = await r.json();
      setUploadMsg(`Added ${d.saved.length} file${d.saved.length === 1 ? "" : "s"}.`);
      await loadSongs();
    } catch {
      setUploadMsg("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  return (
    <main>
      <h1>Music Player</h1>

      {breakActive === "ad" && <div className="banner">Ad playing...</div>}
      {breakActive === "compute" && <div className="banner">Running compute...</div>}

      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600 }}>{current?.name ?? "No song loaded"}</div>
            <div className="muted">
              Songs played: {playCount} / next break in {SONGS_PER_BREAK - (playCount % SONGS_PER_BREAK)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost" onClick={prev} disabled={!songs.length}>Prev</button>
            {isPlaying ? (
              <button onClick={pause} disabled={!current}>Pause</button>
            ) : (
              <button onClick={play} disabled={!current}>Play</button>
            )}
            <button className="ghost" onClick={next} disabled={!songs.length}>Next</button>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={current?.src}
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          controls
          style={{ width: "100%", marginTop: 12 }}
        />
      </div>

      <div
        className={`dropzone${dragActive ? " active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragActive(false);
        }}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <div style={{ fontWeight: 600 }}>
          {uploading ? "Uploading..." : dragActive ? "Drop to upload" : "Drag & drop .mp3 files here"}
        </div>
        <div className="muted">or click to browse</div>
        {uploadMsg && <div className="muted" style={{ marginTop: 8 }}>{uploadMsg}</div>}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,.mp3"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Library</div>
        {songs.length === 0 && (
          <div className="muted">No songs yet. Drop some above.</div>
        )}
        {songs.map((s, i) => (
          <div key={s.src} className="row">
            <div style={{ color: i === index ? "#6ea8ff" : undefined }}>{s.name}</div>
            <button className="ghost" onClick={() => { setIndex(i); setIsPlaying(true); }}>
              Play
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
