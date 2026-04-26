import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "y2k" | "y2k-primary";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary: "y2k-button y2k-button-primary",
  secondary: "y2k-button",
  ghost: "y2k-button",
  danger: "y2k-button y2k-button-primary",
  y2k: "y2k-button",
  "y2k-primary": "y2k-button y2k-button-primary",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} className={cn(VARIANTS[variant], className)}>
      {children}
    </button>
  );
}
