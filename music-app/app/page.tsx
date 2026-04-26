"use client";

import { useEffect, useRef, useState } from "react";
import { AD_DURATION_MS, SONGS_PER_BREAK, getBreakMode } from "@/lib/settings";
import { runCompute } from "@/lib/compute";

type Song = { name: string; src: string };

function fmt(t: number): string {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PlayerPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [breakActive, setBreakActive] = useState<null | "ad" | "compute">(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
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

  useEffect(() => { loadSongs(); }, []);

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
    if (next % SONGS_PER_BREAK === 0) await triggerBreak();
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

  function toggle() { if (current) setIsPlaying((p) => !p); }
  function next() { setIndex((i) => (songs.length ? (i + 1) % songs.length : 0)); }
  function prev() { setIndex((i) => (songs.length ? (i - 1 + songs.length) % songs.length : 0)); }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".mp3"));
    if (!files.length) { setUploadMsg("Only .mp3 files."); return; }
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      const r = await fetch("/api/songs", { method: "POST", body: fd });
      const d: { saved: string[] } = await r.json();
      setUploadMsg(`+${d.saved.length}`);
      await loadSongs();
    } catch {
      setUploadMsg("Failed");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadMsg(null), 2500);
    }
  }

  const progress = duration ? (time / duration) * 100 : 0;
  const breakIn = SONGS_PER_BREAK - (playCount % SONGS_PER_BREAK);

  return (
    <main
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={(e) => {
        e.preventDefault();
        if ((e.currentTarget as Node).contains(e.relatedTarget as Node)) return;
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      {dragActive && <div className="drop-overlay">Drop .mp3 files anywhere</div>}

      {breakActive === "ad" && <div className="banner">● Ad break</div>}
      {breakActive === "compute" && <div className="banner compute">● Computing</div>}

      <section className="hero">
        <div className="art" style={{ background: artGradient(current?.name) }}>
          <div className="art-glyph">{(current?.name?.[0] ?? "♪").toUpperCase()}</div>
        </div>
        <div className="hero-info">
          <div className="eyebrow">Now Playing</div>
          <div className="title">{current?.name ?? "Nothing queued"}</div>
          <div className="meta">
            <span className="chip">{songs.length} tracks</span>
            <span className="chip dim">break in {breakIn}</span>
          </div>

          <div className="scrub" onClick={seek}>
            <div className="scrub-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="time-row">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>

          <div className="controls">
            <button className="icon" onClick={prev} disabled={!songs.length} aria-label="Previous">‹‹</button>
            <button className="play" onClick={toggle} disabled={!current} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button className="icon" onClick={next} disabled={!songs.length} aria-label="Next">››</button>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={current?.src}
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      </section>

      <section className="library">
        <div className="library-head">
          <div>
            <div className="lib-title">Library</div>
            <div className="muted">{songs.length} songs · drag mp3s anywhere</div>
          </div>
          <button className="ghost sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : uploadMsg ?? "+ Add files"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            multiple
            hidden
            onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {songs.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 32, opacity: 0.5 }}>♫</div>
            <div className="muted" style={{ marginTop: 8 }}>Drop .mp3 files here to begin</div>
          </div>
        ) : (
          <ul className="track-list">
            {songs.map((s, i) => {
              const playing = i === index && isPlaying;
              return (
                <li
                  key={s.src}
                  className={i === index ? "track active" : "track"}
                  onClick={() => { setIndex(i); setIsPlaying(true); }}
                >
                  <span className="track-num">{playing ? "♪" : String(i + 1).padStart(2, "0")}</span>
                  <span className="track-name">{s.name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function artGradient(seed?: string): string {
  const palette = [
    ["#8b7cff", "#6ea8ff"],
    ["#ff7eb6", "#a16bff"],
    ["#5eead4", "#3b82f6"],
    ["#fb923c", "#f43f5e"],
    ["#facc15", "#f97316"],
    ["#34d399", "#06b6d4"],
  ];
  let h = 0;
  for (const c of seed ?? "") h = (h * 31 + c.charCodeAt(0)) | 0;
  const [a, b] = palette[Math.abs(h) % palette.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
