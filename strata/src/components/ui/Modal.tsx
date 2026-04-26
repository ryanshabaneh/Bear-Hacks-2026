"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
};

export function Modal({
  open,
  onClose,
  closeOnBackdrop = false,
  ariaLabel,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 backdrop-blur-md"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(255, 200, 170, 0.30), transparent 60%), rgba(13, 24, 40, 0.45)",
        }}
      />
      <div
        ref={dialogRef}
        className={cn(
          "relative cirrus-card w-full max-w-[560px] p-7 flex flex-col gap-5",
          "shadow-[0_24px_80px_-12px_rgba(13,24,40,0.45)]",
          className,
        )}
        style={{ borderRadius: "var(--radius-xl)" }}
      >
        {children}
      </div>
    </div>
  );
}
