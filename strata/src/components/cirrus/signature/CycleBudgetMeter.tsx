import { cn } from "@/lib/utils/cn";

type Props = {
  remaining: number;
  total: number;
  costPerKc?: number;
  forecastId?: string;
  className?: string;
};

export function CycleBudgetMeter({
  remaining,
  total,
  costPerKc = 0.029,
  forecastId,
  className,
}: Props) {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const angleDeg = -90 + pct * 180;

  const minHpa = 980;
  const maxHpa = 1040;
  const currentHpa = Math.round(minHpa + pct * (maxHpa - minHpa));

  const burnedDollars = ((total - remaining) * costPerKc).toFixed(2);
  const budgetDollars = (total * costPerKc).toFixed(2);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <header className="flex items-center justify-between">
        <span className="cirrus-text-unit" style={{ opacity: 0.85 }}>
          Cycle budget{forecastId ? ` · ${forecastId.toUpperCase()}` : ""}
        </span>
        <span className="cirrus-num cirrus-text-unit">
          {remaining} / {total} kc
        </span>
      </header>

      <div
        className="relative w-full"
        style={{
          aspectRatio: "240 / 130",
          background: "var(--y2k-window-cream)",
          border: "1.5px solid var(--y2k-border)",
        }}
      >
        <svg
          viewBox="0 0 240 130"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-label={`Cycle budget meter: ${remaining} of ${total} kilocycles remaining`}
        >
          <defs>
            <radialGradient id="cbm-glow" cx="50%" cy="100%" r="60%">
              <stop offset="0%" stopColor="#f4885a" stopOpacity={0.18 + (1 - pct) * 0.18} />
              <stop offset="100%" stopColor="#f4885a" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="240" height="130" fill="url(#cbm-glow)" />

          <path
            d="M 30 110 A 90 90 0 0 1 210 110"
            fill="none"
            stroke="rgba(31,24,64,0.20)"
            strokeWidth="1.2"
          />

          <path
            d={describeArc(120, 110, 90, -90, angleDeg)}
            fill="none"
            stroke="#1f1840"
            strokeWidth="2.5"
          />

          <g stroke="#1f1840" strokeWidth="0.8" fill="none" opacity="0.6">
            <line x1="30" y1="110" x2="36" y2="106" />
            <line x1="60" y1="60" x2="66" y2="64" />
            <line x1="120" y1="20" x2="120" y2="28" />
            <line x1="180" y1="60" x2="174" y2="64" />
            <line x1="210" y1="110" x2="204" y2="106" />
          </g>

          <text
            x="30"
            y="120"
            fill="#1f1840"
            fontFamily="ui-monospace, monospace"
            fontSize="6.5"
            letterSpacing="0.5"
            opacity="0.7"
          >
            980
          </text>
          <text
            x="120"
            y="14"
            fill="#1f1840"
            fontFamily="ui-monospace, monospace"
            fontSize="6.5"
            letterSpacing="0.5"
            textAnchor="middle"
            opacity="0.7"
          >
            1013 hPa
          </text>
          <text
            x="210"
            y="120"
            fill="#1f1840"
            fontFamily="ui-monospace, monospace"
            fontSize="6.5"
            letterSpacing="0.5"
            textAnchor="end"
            opacity="0.7"
          >
            1040
          </text>

          <g
            style={{
              transform: `rotate(${angleDeg + 90}deg)`,
              transformOrigin: "120px 110px",
              transition: "transform 700ms var(--ease-settle)",
            }}
            className="cbm-needle"
          >
            <line x1="120" y1="110" x2="120" y2="40" stroke="#f4885a" strokeWidth="3" strokeLinecap="round" />
            <line x1="120" y1="110" x2="120" y2="40" stroke="#f4885a" strokeWidth="7" strokeLinecap="round" opacity="0.3" />
          </g>

          <circle cx="120" cy="110" r="4" fill="#1f1840" />
          <circle cx="120" cy="110" r="1.5" fill="#fde6f2" />

          <text
            x="120"
            y="94"
            fill="#1f1840"
            fontFamily="ui-monospace, monospace"
            fontSize="13"
            fontWeight="600"
            textAnchor="middle"
          >
            {currentHpa}
          </text>
          <text
            x="120"
            y="104"
            fill="#1f1840"
            fontFamily="ui-monospace, monospace"
            fontSize="6"
            letterSpacing="0.8"
            textAnchor="middle"
            opacity="0.7"
          >
            HPA · {remaining} KC
          </text>
        </svg>
      </div>

      <p className="cirrus-text-mono-id" style={{ fontSize: 11, opacity: 0.75 }}>
        ${costPerKc.toFixed(3)} / kc · ${burnedDollars} of ${budgetDollars} · settles in 4 to 7 min
      </p>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .cbm-needle { transition: none !important; }
        }
      `}</style>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
