import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
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
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[14px]",
  lg: "px-5 py-3 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        "cirrus-text-body",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
