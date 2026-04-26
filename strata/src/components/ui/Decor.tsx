import { cn } from "@/lib/utils/cn";

type Tone =
  | "ink"
  | "pink"
  | "lavender"
  | "blue"
  | "mint"
  | "butter"
  | "coral"
  | "sage"
  | "cream";

type DecorProps = {
  asset: string;
  tone?: Tone;
  size?: number;
  width?: number;
  height?: number;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function Decor({
  asset,
  tone = "lavender",
  size,
  width,
  height,
  opacity,
  className,
  style,
}: DecorProps) {
  const w = width ?? size ?? 24;
  const h = height ?? size ?? 24;
  const url = `url("${asset}")`;
  return (
    <span
      aria-hidden="true"
      className={cn("y2k-decor", `y2k-decor-${tone}`, className)}
      style={{
        width: w,
        height: h,
        maskImage: url,
        WebkitMaskImage: url,
        opacity,
        ...style,
      }}
    />
  );
}
