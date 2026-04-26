import { cn } from "@/lib/utils/cn";

type BrandmarkProps = {
  size?: number;
  wordmarkSize?: number;
  asset?: string;
  showWordmark?: boolean;
  className?: string;
};

export function Brandmark({
  size = 18,
  wordmarkSize = 16,
  asset = "/assets/sparkles.svg",
  showWordmark = true,
  className,
}: BrandmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, display: "block" }}
      />
      {showWordmark ? (
        <span
          className="y2k-mono"
          style={{ fontSize: wordmarkSize, fontWeight: 700, color: "var(--y2k-border)" }}
        >
          Strata
        </span>
      ) : null}
    </span>
  );
}
