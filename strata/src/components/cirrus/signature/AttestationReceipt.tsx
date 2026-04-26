import { cn } from "@/lib/utils/cn";

export type AttestationData = {
  sliceTimestampStart: number;
  sliceTimestampEnd: number;
  outputHash: string;
  nodeRegion: string;
  cyclesConsumed: number;
  quorum: { k: number; agreed: boolean };
  oracleSampled: boolean;
  oracleAgreed?: boolean;
  schedulerSig: "valid" | "invalid";
};

type Props = {
  attestation: AttestationData;
  variant?: "inline" | "hover";
  className?: string;
};

export function AttestationReceipt({ attestation, variant = "inline", className }: Props) {
  const truncatedHash = truncateHash(attestation.outputHash);
  const sliceLabel = `${formatSeconds(attestation.sliceTimestampStart)} → ${formatSeconds(
    attestation.sliceTimestampEnd,
  )}`;

  const quorumLabel = attestation.quorum.agreed
    ? `k=${attestation.quorum.k} · agreed`
    : `k=${attestation.quorum.k} · MISMATCH`;
  const oracleLabel = !attestation.oracleSampled
    ? "not sampled"
    : attestation.oracleAgreed
      ? "sampled · agreed"
      : "sampled · MISMATCH";

  return (
    <div
      role="group"
      aria-label="Slice attestation"
      className={cn(
        "cirrus-card p-3 flex flex-col gap-1",
        variant === "hover" ? "shadow-none" : "",
        className,
      )}
      style={{ minWidth: 240 }}
    >
      <ReceiptRow k="SLICE" v={sliceLabel} />
      <ReceiptRow k="HASH" v={truncatedHash} accent="coral" mono />
      <ReceiptRow k="NODE" v={`region:${attestation.nodeRegion} · ${attestation.cyclesConsumed} kc`} />
      <ReceiptRow k="QUORUM" v={quorumLabel} accent={attestation.quorum.agreed ? "sage" : "coral"} />
      <ReceiptRow k="ORACLE" v={oracleLabel} />
      <ReceiptRow
        k="SIG"
        v={`scheduler ${attestation.schedulerSig === "valid" ? "✓" : "✗"}`}
        accent={attestation.schedulerSig === "valid" ? "ink" : "coral"}
      />
    </div>
  );
}

function ReceiptRow({
  k,
  v,
  accent,
  mono = false,
}: {
  k: string;
  v: string;
  accent?: "coral" | "sage" | "ink";
  mono?: boolean;
}) {
  const valueColor =
    accent === "coral"
      ? "var(--color-coral-700)"
      : accent === "sage"
        ? "var(--color-sage-800)"
        : accent === "ink"
          ? "var(--color-ink-700)"
          : undefined;

  return (
    <div className="flex items-center justify-between gap-3 cirrus-text-mono-id" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
      <span className="opacity-60">{k}</span>
      <span className={mono ? "cirrus-num" : undefined} style={{ color: valueColor }}>
        {v}
      </span>
    </div>
  );
}

function truncateHash(hash: string): string {
  if (hash.length <= 9) return hash;
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

function formatSeconds(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${String(mm).padStart(1, "0")}:${String(ss).padStart(2, "0")}`;
}
