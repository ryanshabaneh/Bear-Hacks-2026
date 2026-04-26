import type { ReactNode } from "react";

export function CirrusStage({
  children,
  variant: _variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "marketing";
}) {
  return (
    <div className="cirrus-stage">
      <div className="cirrus-stage-inner">{children}</div>
    </div>
  );
}
