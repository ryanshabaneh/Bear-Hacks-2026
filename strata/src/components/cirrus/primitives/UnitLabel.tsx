import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

type Props = ComponentPropsWithoutRef<"span"> & { muted?: boolean };

export function UnitLabel({ className, muted = false, children, ...rest }: Props) {
  return (
    <span
      className={cn("cirrus-text-unit", muted ? "opacity-60" : null, className)}
      {...rest}
    >
      {children}
    </span>
  );
}
