import { cn } from "@/lib/utils/cn";

type SparkleProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function Sparkle({ size = 14, className, style }: SparkleProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("y2k-sparkle", className)}
      style={style}
    >
      <path
        d="M12 1 L13.6 9.4 L22 11 L13.6 12.6 L12 21 L10.4 12.6 L2 11 L10.4 9.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}
