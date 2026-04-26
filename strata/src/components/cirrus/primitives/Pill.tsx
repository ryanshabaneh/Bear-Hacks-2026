import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type PillTone = "coral" | "sage" | "butter" | "neutral";

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span className={cn("cirrus-pill", `cirrus-pill-${tone}`, className)}>
      {children}
    </span>
  );
}
