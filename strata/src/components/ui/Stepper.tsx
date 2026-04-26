import { cn } from "@/lib/utils/cn";

type StepperProps = {
  total: number;
  current: number;
  className?: string;
};

export function Stepper({ total, current, className }: StepperProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={`Step ${current} of ${total}`}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const state =
          idx < current ? "done" : idx === current ? "active" : "upcoming";
        return (
          <span
            key={i}
            aria-hidden="true"
            className="h-1 rounded-full transition-all"
            style={{
              width: state === "active" ? 28 : 14,
              background:
                state === "done"
                  ? "var(--color-coral-500)"
                  : state === "active"
                    ? "var(--color-coral-500)"
                    : "rgba(13, 24, 40, 0.18)",
              opacity: state === "done" ? 0.6 : 1,
            }}
          />
        );
      })}
      <span className="ml-2 cirrus-text-mono-id opacity-60">
        {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}
