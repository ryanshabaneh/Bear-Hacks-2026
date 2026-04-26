"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Window } from "@/components/ui/Window";

type ModalSize = "sm" | "md" | "lg";
type TitleBarTone = "lavender" | "pink" | "cream";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  ariaLabel: string;
  title?: string;
  titleBarTone?: TitleBarTone;
  size?: ModalSize;
  sparkles?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-[380px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
};

export function Modal({
  open,
  onClose,
  closeOnBackdrop = false,
  ariaLabel,
  title,
  titleBarTone = "lavender",
  size = "md",
  sparkles = true,
  className,
  bodyClassName,
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
        className="absolute inset-0"
        style={{ background: "rgba(170, 194, 235, 0.78)" }}
      />
      <div ref={dialogRef} className={cn("relative w-full", SIZE_CLASS[size], className)}>
        <Window
          title={title}
          titleBarTone={titleBarTone}
          sparkles={sparkles}
          bodyClassName={bodyClassName}
        >
          {children}
        </Window>
      </div>
    </div>
  );
}
