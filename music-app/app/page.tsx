"use client";

import { useEffect, useRef, useState } from "react";
import { AD_DURATION_MS, SONGS_PER_BREAK, getBreakMode } from "@/lib/settings";
import { runCompute } from "@/lib/compute";
import { PixelCharacter } from "./_components/PixelCharacter";

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
  const [breakProgress, setBreakProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [breakActive, setBreakActive] = useState<null | "ad" | "compute">(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ads, setAds] = useState<string[]>([]);
  const [adIndex, setAdIndex] = useState(0);
  const [adVideo, setAdVideo] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const adResolveRef = useRef<(() => void) | null>(null);

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

  useEffect(() => {
    fetch("/api/ads", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ads: string[] }) => setAds(d.ads))
      .catch(() => setAds([]));
  }, []);

  const current = songs[index];

  async function triggerBreak() {
    const mode = getBreakMode();
    setBreakActive(mode);
    if (mode === "ad") {
      if (ads.length) {
        const src = ads[adIndex % ads.length];
        setAdIndex((i) => i + 1);
        await new Promise<void>((resolve) => {
          adResolveRef.current = resolve;
          setAdVideo(src);
        });
      } else {
        await new Promise((res) => setTimeout(res, AD_DURATION_MS));
      }
    } else {
      await runCompute();
    }
    setBreakActive(null);
  }

  function endAd() {
    setAdVideo(null);
    const r = adResolveRef.current;
    adResolveRef.current = null;
    r?.();
  }

  async function handleEnded() {
    const np = breakProgress + 1;
    if (np >= SONGS_PER_BREAK) {
      setBreakProgress(0);
      await triggerBreak();
    } else {
      setBreakProgress(np);
    }
    setIndex((i) => (songs.length ? (i + 1) % songs.length : 0));
    setIsPlaying(true);
  }

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && !breakActive && !adVideo) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, index, breakActive, adVideo]);

  function toggle() { if (current) setIsPlaying((p) => !p); }
  async function next() {
    const np = breakProgress + 1;
    if (np >= SONGS_PER_BREAK) {
      setBreakProgress(0);
      await triggerBreak();
    } else {
      setBreakProgress(np);
    }
    setIndex((i) => (songs.length ? (i + 1) % songs.length : 0));
  }
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
  const breakIn = SONGS_PER_BREAK - breakProgress;

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
      {dragActive && <div className="drop-overlay">▼ Drop .mp3 files anywhere ▼</div>}

      {adVideo && (
        <div className="ad-modal" role="dialog" aria-label="Advertisement">
          <div className="ad-modal-inner">
            <div className="ad-label">Ad</div>
            <video
              src={adVideo}
              autoPlay
              playsInline
              onEnded={endAd}
              onError={endAd}
              className="ad-video"
              controls={false}
            />
          </div>
        </div>
      )}

      {breakActive === "ad" && <div className="banner">■ AD BREAK</div>}
      {breakActive === "compute" && <div className="banner compute">■ COMPUTING</div>}

      <section className={`hero ${isPlaying ? "is-playing" : ""}`}>
        <div className="character-mount" aria-hidden="true">
          <PixelCharacter className="pixel-char" />
        </div>

        {isPlaying && current && (
          <div className="notes" aria-hidden="true">
            <span>♪</span>
            <span>♫</span>
            <span>♪</span>
            <span>♬</span>
          </div>
        )}

        {/* Stereo cabinet: speaker · CRT screen · speaker */}
        <div className="stereo">
          <span className="speaker speaker-left" aria-hidden="true">
            <span className="cone" />
          </span>
          <div className="art" style={{ background: artGradient(current?.name) }}>
            <div className="art-glyph">{(current?.name?.[0] ?? "♪").toUpperCase()}</div>
          </div>
          <span className="speaker speaker-right" aria-hidden="true">
            <span className="cone" />
          </span>
        </div>

        <div className="hero-info">
          <div className="eyebrow">
            ▶ TRACK {songs.length ? String(index + 1).padStart(2, "0") : "—"} / {String(songs.length).padStart(2, "0")}
          </div>
          <div className="title">{current?.name ?? "—— INSERT TAPE ——"}</div>
          <div className="meta">
            <span className="chip">{songs.length} TAPES</span>
            <span className="chip dim">BREAK IN {breakIn}</span>
          </div>

          <div className="scrub" onClick={seek}>
            <div className="scrub-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="time-row">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>

          <div className="controls">
            <button className="icon" onClick={prev} disabled={!songs.length} aria-label="Previous">|◀</button>
            <button className="play" onClick={toggle} disabled={!current} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? "II" : "▶"}
            </button>
            <button className="icon" onClick={next} disabled={!songs.length} aria-label="Next">▶|</button>
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
            <div className="lib-title">★ LIBRARY</div>
            <div className="muted">{songs.length} songs · drag mp3s anywhere</div>
          </div>
          <button className="ghost sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "UPLOADING…" : uploadMsg ?? "+ ADD FILES"}
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
          <div className="empty crate">
            <div className="crate-glyph">♫</div>
            <div className="muted">▼ DROP TAPES HERE ▼</div>
            <div className="crate-sub">.mp3 only · drag &amp; drop or use the orange crate button</div>
          </div>
        ) : (
          <ul className="track-list">
            {songs.map((s, i) => {
              const playing = i === index && isPlaying;
              const side = i % 2 === 0 ? "SIDE A" : "SIDE B";
              return (
                <li
                  key={s.src}
                  className={i === index ? "track active" : "track"}
                  onClick={() => { setIndex(i); setIsPlaying(true); }}
                >
                  <span className="track-num">{playing ? "♪" : String(i + 1).padStart(2, "0")}</span>
                  <span className="track-name">{s.name}</span>
                  <span className="track-side">{side}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

// Sweetie 16 palette — flat pixel-art fills, no gradients.
function artGradient(seed?: string): string {
  const palette = [
    "#41a6f6", // cyan
    "#a7f070", // green
    "#ffcd75", // yellow
    "#ef7d57", // orange
    "#b13e53", // red
    "#73eff7", // cyan-bright
    "#3b5dc9", // blue
    "#5d275d", // purple
  ];
  let h = 0;
  for (const c of seed ?? "") h = (h * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(h) % palette.length];
}
