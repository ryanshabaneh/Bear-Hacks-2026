"use client";

import { useEffect, useRef, useState } from "react";

type Segment = {
  chunkIndex: number;
  timestampStart: number;
  text?: string;
  arrivedAt: number;
};

type Props = {
  forecastId: string;
  segments: Segment[];
};

export function TranscriptStream({ forecastId, segments }: Props) {
  const [typed, setTyped] = useState<{ idx: number; text: string } | null>(null);
  const lastIndexRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (segments.length === 0) return;
    const latest = segments[segments.length - 1];
    if (latest.chunkIndex === lastIndexRef.current) return;
    lastIndexRef.current = latest.chunkIndex;

    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);

    const text = latest.text ?? "";
    if (text.length === 0) {
      setTyped(null);
      return;
    }

    setTyped({ idx: latest.chunkIndex, text: "" });

    let pointer = 0;
    intervalRef.current = window.setInterval(() => {
      pointer += 2;
      const slice = text.slice(0, pointer);
      setTyped({ idx: latest.chunkIndex, text: slice });
      if (pointer >= text.length) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTyped(null);
      }
    }, 14);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [segments]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [segments.length]);

  const [shareToast, setShareToast] = useState<string | null>(null);
  const showShareToast = (message: string) => {
    setShareToast(message);
    window.setTimeout(() => setShareToast(null), 2400);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/forecasts/${forecastId}/transcript`);
      if (!response.ok) {
        console.error(
          `[transcript-export] http ${response.status} ${response.statusText}`,
        );
        return;
      }
      const data = (await response.json()) as { fullText?: string };
      const text = data.fullText ?? "";
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `strata-transcript-${forecastId.slice(-6)}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[transcript-export]", error);
    }
  };

  const handleShareTwitter = async () => {
    try {
      const response = await fetch(`/api/forecasts/${forecastId}/transcript`);
      if (!response.ok) return;
      const data = (await response.json()) as { fullText?: string };
      const preview = (data.fullText ?? "").slice(0, 240);
      const text = preview.length > 0 ? `"${preview}..."  via Strata` : "Strata transcript";
      const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(intent, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("[transcript-share]", error);
    }
  };

  const sorted = [...segments].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const completedCount = sorted.filter((s) => (s.text ?? "").length > 0).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="cirrus-text-unit">
          Transcript &middot; {completedCount} segments
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareTwitter}
            disabled={completedCount === 0}
            title="Share preview to Twitter"
            className="transcript-icon-button"
            aria-label="share to twitter"
          >
            <span aria-hidden="true">x</span>
          </button>
          <button
            type="button"
            onClick={() => showShareToast("YouTube caption upload coming soon")}
            disabled={completedCount === 0}
            title="Upload as YouTube captions"
            className="transcript-icon-button"
            aria-label="upload to youtube captions"
          >
            <span aria-hidden="true">yt</span>
          </button>
          <button
            type="button"
            onClick={() => showShareToast("Embed widget coming soon")}
            disabled={completedCount === 0}
            title="Embed widget"
            className="transcript-icon-button"
            aria-label="embed widget"
          >
            <span aria-hidden="true">&lt;/&gt;</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={completedCount === 0}
            className="y2k-button-primary"
            style={{
              padding: "4px 12px",
              fontSize: 11,
              opacity: completedCount === 0 ? 0.5 : 1,
              cursor: completedCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            export .txt
          </button>
        </div>
      </div>

      {shareToast ? (
        <div
          className="transcript-toast"
          role="status"
          aria-live="polite"
        >
          {shareToast}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="flex flex-col gap-2 transcript-stream"
        style={{
          maxHeight: 280,
          minHeight: 120,
          overflowY: "auto",
          padding: "12px 14px",
          background: "var(--y2k-window)",
          border: "1px solid var(--y2k-border)",
        }}
      >
        {sorted.length === 0 ? (
          <span
            className="cirrus-text-mono-id"
            style={{ fontSize: 12, opacity: 0.55 }}
          >
            waiting for first slice
            <span className="transcript-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        ) : (
          sorted.map((segment) => {
            const isTyping = typed !== null && typed.idx === segment.chunkIndex;
            const renderText = isTyping ? typed.text : segment.text ?? "";
            return (
              <div
                key={segment.chunkIndex}
                className="flex gap-3"
                style={{ alignItems: "baseline" }}
              >
                <span
                  className="cirrus-text-mono-id"
                  style={{
                    fontSize: 11,
                    color: "#1f1840",
                    fontWeight: 700,
                    minWidth: 48,
                    flexShrink: 0,
                  }}
                >
                  {formatTs(segment.timestampStart)}
                </span>
                <span
                  className="cirrus-text-mono-id"
                  style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}
                >
                  {renderText}
                  {isTyping ? <span className="transcript-cursor">|</span> : null}
                </span>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .transcript-cursor {
          display: inline-block;
          margin-left: 1px;
          color: #1f1840;
          font-weight: 700;
          animation: caret-blink 700ms infinite;
        }
        @keyframes caret-blink {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .transcript-stream::-webkit-scrollbar { width: 8px; }
        .transcript-stream::-webkit-scrollbar-track { background: var(--y2k-window); }
        .transcript-stream::-webkit-scrollbar-thumb {
          background: var(--y2k-border);
          border-radius: 1px;
        }
        .transcript-dots span {
          display: inline-block;
          opacity: 0;
          animation: dot-blink 1.4s infinite;
        }
        .transcript-dots span:nth-child(2) { animation-delay: 0.2s; }
        .transcript-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-blink {
          0%, 80%, 100% { opacity: 0; }
          40%           { opacity: 1; }
        }
        .transcript-icon-button {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--y2k-window);
          border: 1px solid var(--y2k-border);
          color: #1f1840;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: background 140ms ease-out, transform 140ms ease-out;
        }
        .transcript-icon-button:hover:not(:disabled) {
          background: var(--y2k-titlebar-pink);
          transform: translateY(-1px);
        }
        .transcript-icon-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .transcript-toast {
          margin-top: 4px;
          padding: 6px 10px;
          background: #1f1840;
          color: var(--y2k-titlebar-cream, #f4ecd8);
          font-family: inherit;
          font-size: 11px;
          border: 1px solid var(--y2k-border);
          align-self: flex-end;
          animation: toast-in 220ms ease-out;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .transcript-cursor, .transcript-dots span,
          .transcript-icon-button, .transcript-toast {
            animation: none !important;
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function formatTs(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
