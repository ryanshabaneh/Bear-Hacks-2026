import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

export function MonoNumber({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cn("cirrus-num", className)} {...rest}>
      {children}
    </span>
  );
}
