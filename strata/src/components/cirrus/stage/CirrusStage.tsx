import type { ReactNode } from "react";

export function CirrusStage({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "marketing";
}) {
  return (
    <div className="cirrus-stage">
      <div className="cirrus-leak cirrus-leak-coral" aria-hidden="true" />
      <div className="cirrus-leak cirrus-leak-ice" aria-hidden="true" />
      {variant === "marketing" ? (
        <div className="cirrus-leak cirrus-leak-sunlit" aria-hidden="true" />
      ) : null}
      <div className="cirrus-stage-inner">{children}</div>
    </div>
  );
}
