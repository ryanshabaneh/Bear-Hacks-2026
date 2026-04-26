import { cn } from "@/lib/utils/cn";

type Capabilities = {
  WEBGPU: number;
  AUDIO: number;
  HEAP_1GB: number;
  WASM: number;
  EN_OK: number;
  F32: number;
};

type Props = {
  totalNodes: number;
  capabilities: Capabilities;
  className?: string;
};

export function CapabilityBloom({ totalNodes, capabilities, className }: Props) {
  const ratio = (n: number) => (totalNodes > 0 ? Math.max(0.45, n / totalNodes) : 0);

  return (
    <div className={cn("cirrus-card p-3.5 flex flex-col gap-2", className)}>
      <header className="flex items-center justify-between">
        <span className="cirrus-text-unit opacity-80">Sky · {totalNodes} nodes</span>
        <span className="cirrus-text-mono-id opacity-60" style={{ fontSize: 9 }}>
          self-reported
        </span>
      </header>

      <div className="relative w-full" style={{ aspectRatio: "180 / 140" }}>
        <svg
          viewBox="0 0 180 140"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-label={`Capability bloom for ${totalNodes} nodes`}
        >
          <g transform="translate(90,75)">
            <circle cx="0" cy="0" r="16" fill="rgba(13,24,40,0.92)" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fill="#fafaf7"
              fontFamily="ui-monospace, monospace"
              fontSize="9"
              fontWeight="500"
            >
              {totalNodes}
            </text>

            <g stroke="rgba(244,136,90,0.5)" fill="none" strokeWidth="0.8">
              <line x1="0" y1="-16" x2="0" y2="-46" />
              <line x1="14" y1="-8" x2="40" y2="-23" />
              <line x1="14" y1="8" x2="40" y2="23" />
              <line x1="0" y1="16" x2="0" y2="46" />
              <line x1="-14" y1="8" x2="-40" y2="23" />
              <line x1="-14" y1="-8" x2="-40" y2="-23" />
            </g>

            <BloomPetal cx={0} cy={-50} rx={24} ry={10} fill="#f4885a" opacity={ratio(capabilities.WEBGPU)} label={`WEBGPU ${capabilities.WEBGPU}`} ty={-48} />
            <BloomPetal cx={44} cy={-25} rx={22} ry={9} fill="#98b898" opacity={ratio(capabilities.AUDIO)} label={`AUDIO ${capabilities.AUDIO}`} ty={-23} />
            <BloomPetal cx={44} cy={25} rx={22} ry={9} fill="#e8c878" opacity={ratio(capabilities.HEAP_1GB)} label={`≥1GB ${capabilities.HEAP_1GB}`} ty={27} />
            <BloomPetal cx={0} cy={50} rx={24} ry={10} fill="#b8c8d8" opacity={ratio(capabilities.WASM)} label={`WASM ${capabilities.WASM}`} ty={52} />
            <BloomPetal cx={-44} cy={25} rx={22} ry={9} fill="#c8d4e0" opacity={ratio(capabilities.EN_OK)} label={`EN-OK ${capabilities.EN_OK}`} ty={27} />
            <BloomPetal cx={-44} cy={-25} rx={22} ry={9} fill="#fbd9c0" opacity={ratio(capabilities.F32)} label={`F32 ${capabilities.F32}`} ty={-23} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function BloomPetal({
  cx,
  cy,
  rx,
  ry,
  fill,
  opacity,
  label,
  ty,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  opacity: number;
  label: string;
  ty: number;
}) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} opacity={opacity} />
      <text
        x={cx}
        y={ty}
        textAnchor="middle"
        fill="#0d1828"
        fontFamily="ui-monospace, monospace"
        fontSize="7"
        fontWeight="500"
      >
        {label}
      </text>
    </g>
  );
}
