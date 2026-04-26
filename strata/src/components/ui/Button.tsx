import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "y2k" | "y2k-primary";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-[var(--color-cream)] bg-[var(--color-ink-900)] hover:bg-[var(--color-ink-700)]",
  secondary:
    "cirrus-card hover:bg-[rgba(255,255,255,0.75)] text-[var(--color-ink-900)]",
  ghost:
    "bg-transparent text-[var(--color-ink-700)] hover:text-[var(--color-ink-900)] hover:bg-[rgba(13,24,40,0.04)]",
  danger:
    "text-[var(--color-cream)] bg-[var(--color-coral-700)] hover:bg-[var(--color-coral-500)]",
  y2k: "y2k-button",
  "y2k-primary": "y2k-button y2k-button-primary",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[14px]",
  lg: "px-5 py-3 text-[15px]",
};

const Y2K_VARIANTS = new Set<Variant>(["y2k", "y2k-primary"]);

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  const isY2K = Y2K_VARIANTS.has(variant);
  return (
    <button
      {...rest}
      className={cn(
        !isY2K &&
          "inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cirrus-text-body",
        !isY2K && SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
