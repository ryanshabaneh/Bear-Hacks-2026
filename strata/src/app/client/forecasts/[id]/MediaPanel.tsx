"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  src: string;
  kind: "video" | "audio";
};

type Size = "compact" | "expanded";

export function MediaPanel({ src, kind }: Props) {
  const [size, setSize] = useState<Size>("expanded");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
    } catch (error) {
      console.error("[media-panel] fullscreen request failed", error);
    }
  };

  const exitFullscreen = async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.error("[media-panel] fullscreen exit failed", error);
    }
  };

  if (kind === "audio") {
    return (
      <div className="flex flex-col gap-2">
        <audio src={src} controls className="w-full" />
      </div>
    );
  }

  const containerHeight = isFullscreen ? "100vh" : size === "compact" ? "180px" : "min(70vh, 560px)";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="cirrus-text-unit">Source · live preview</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSize("compact")}
            disabled={size === "compact"}
            title="Compact view"
            className={cn(
              "media-icon-button",
              size === "compact" && "media-icon-button-active",
            )}
            aria-label="compact view"
          >
            <span aria-hidden="true">_</span>
          </button>
          <button
            type="button"
            onClick={() => setSize("expanded")}
            disabled={size === "expanded"}
            title="Expanded view"
            className={cn(
              "media-icon-button",
              size === "expanded" && "media-icon-button-active",
            )}
            aria-label="expanded view"
          >
            <span aria-hidden="true">□</span>
          </button>
          <button
            type="button"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="media-icon-button"
            aria-label={isFullscreen ? "exit fullscreen" : "enter fullscreen"}
          >
            <span aria-hidden="true">{isFullscreen ? "⤓" : "⛶"}</span>
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="media-wrapper"
        style={{
          width: "100%",
          height: containerHeight,
          background: "#000",
          border: "1px solid var(--y2k-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          controls={isFullscreen}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

      <style>{`
        .media-icon-button {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--y2k-window);
          border: 1px solid var(--y2k-border);
          color: #1f1840;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 140ms ease-out, transform 140ms ease-out;
        }
        .media-icon-button:hover:not(:disabled) {
          background: var(--y2k-titlebar-pink);
          transform: translateY(-1px);
        }
        .media-icon-button-active {
          background: var(--y2k-titlebar-lavender, #b9a7d6);
          cursor: default;
        }
        .media-icon-button:disabled:not(.media-icon-button-active) {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .media-wrapper:fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          border: 0 !important;
        }
        .media-wrapper:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          border: 0 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .media-icon-button {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
