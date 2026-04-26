import { cn } from "@/lib/utils/cn";
import { Sparkle } from "@/components/ui/Sparkle";

type TitleBarTone = "lavender" | "pink" | "cream";

type WindowProps = {
  title?: string;
  titleBarTone?: TitleBarTone;
  showControls?: boolean;
  sparkles?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

const TONE_CLASS: Record<TitleBarTone, string> = {
  lavender: "",
  pink: "y2k-titlebar-pink",
  cream: "y2k-titlebar-cream",
};

export function Window({
  title,
  titleBarTone = "lavender",
  showControls = true,
  sparkles = true,
  className,
  bodyClassName,
  children,
}: WindowProps) {
  return (
    <div className={cn("y2k-window", className)}>
      <div className={cn("y2k-titlebar", TONE_CLASS[titleBarTone])}>
        <span className="truncate">{title ?? ""}</span>
        {showControls ? (
          <span className="y2k-titlebar-controls" aria-hidden="true">
            <span className="y2k-titlebar-control">_</span>
            <span className="y2k-titlebar-control">□</span>
            <span className="y2k-titlebar-control">×</span>
          </span>
        ) : null}
      </div>

      <div className={cn("y2k-window-body", bodyClassName)}>{children}</div>

      {sparkles ? (
        <>
          <Sparkle size={16} style={{ top: -10, right: 28 }} />
          <Sparkle size={10} style={{ bottom: 16, left: -8, opacity: 0.7 }} />
          <Sparkle size={12} style={{ top: 60, right: -8, opacity: 0.6 }} />
        </>
      ) : null}
    </div>
  );
}
