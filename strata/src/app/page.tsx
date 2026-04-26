import Link from "next/link";
import { CirrusStage } from "@/components/cirrus/stage/CirrusStage";
import { Window } from "@/components/ui/Window";
import { Sparkle } from "@/components/ui/Sparkle";
import { Brandmark } from "@/components/ui/Brandmark";

export default function MarketingLanding() {
  return (
    <CirrusStage variant="marketing">
      <div className="px-6 sm:px-8 lg:px-12 py-5">
        <header className="flex items-center justify-between">
          <Link href="/">
            <Brandmark />
          </Link>
          <nav className="flex items-center gap-4 y2k-mono" style={{ fontSize: 12 }}>
            <Link href="/auth/login" className="y2k-link">
              Sign in
            </Link>
            <Link
              href="/auth/login?screen_hint=signup&account_type=client"
              className="y2k-button y2k-button-primary"
            >
              Open account
            </Link>
          </nav>
        </header>
      </div>

      <main className="px-6 sm:px-8 lg:px-12 pt-6 pb-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-8 max-w-[1200px] mx-auto">
        <section className="flex flex-col gap-6 max-w-[520px]">
          <div
            className="inline-flex items-center gap-2 self-start y2k-mono"
            style={{
              padding: "4px 10px",
              border: "1.5px solid var(--y2k-border)",
              background: "var(--y2k-window)",
              boxShadow: "2px 2px 0 0 var(--y2k-shadow)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--y2k-border)",
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block"
              style={{
                width: 8,
                height: 8,
                background: "var(--y2k-accent-coral)",
                border: "1px solid var(--y2k-border)",
              }}
            />
            <span>Sky is live</span>
            <span style={{ opacity: 0.6 }}>+38 / 60s</span>
          </div>

          <h1 className="cirrus-text-marketing-h1">
            transcription, by the swarm.
          </h1>

          <p
            className="y2k-mono"
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--y2k-border)",
              opacity: 0.85,
            }}
          >
            your audio falls across a live Sky of browsers and settles as a
            finished transcript. <strong>four cents an audio-hour.</strong> three
            times under AssemblyAI batch. nine times under Whisper API.
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login?screen_hint=signup&account_type=client"
              className="y2k-button y2k-button-primary"
            >
              Start a Forecast →
            </Link>
            <Link
              href="/auth/login?screen_hint=signup&account_type=distributor"
              className="y2k-button"
            >
              Host the Sky
            </Link>
          </div>

          <Window
            title="delta.exe"
            titleBarTone="cream"
            sparkles={false}
            className="mt-2"
          >
            <div className="flex flex-col gap-1.5 y2k-mono" style={{ fontSize: 12 }}>
              <CostRow name="Strata" value="$0.04" emphasis />
              <CostRow name="AssemblyAI" value="$0.12" />
              <CostRow name="Whisper API" value="$0.36" />
              <CostRow name="Rev AI" value="$1.20" />
              <CostRow name="Rev human" value="$90.00" muted />
            </div>
          </Window>
        </section>

        <aside className="hidden lg:flex items-start justify-center pt-2" aria-hidden="true">
          <div
            className="relative"
            style={{ width: "100%", maxWidth: 420 }}
          >
            <Window
              title="weather.bmp"
              titleBarTone="lavender"
              sparkles={true}
            >
              <div
                style={{
                  background: "var(--y2k-bg)",
                  aspectRatio: "5 / 6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--y2k-border)",
                  padding: 16,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hero/cloud.webp"
                  alt=""
                  fetchPriority="high"
                  style={{
                    width: "78%",
                    height: "auto",
                    display: "block",
                    filter: "drop-shadow(3px 6px 0 rgba(31,24,64,0.18))",
                  }}
                />
              </div>
            </Window>
            <Sparkle size={22} style={{ top: -16, right: -10 }} />
            <Sparkle size={14} style={{ bottom: 36, left: -12, opacity: 0.75 }} />
          </div>
        </aside>
      </main>

      <footer
        className="px-6 sm:px-8 lg:px-12 pb-8 max-w-[1200px] mx-auto flex justify-between items-center y2k-mono"
        style={{ fontSize: 11, color: "var(--y2k-border)", opacity: 0.7 }}
      >
        <span>strata.app · v0</span>
        <span className="cirrus-pill cirrus-pill-sage">Sky · 47 nodes</span>
      </footer>
    </CirrusStage>
  );
}

function CostRow({
  name,
  value,
  emphasis,
  muted,
}: {
  name: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ opacity: muted ? 0.5 : 1 }}
    >
      <span
        style={{
          fontWeight: emphasis ? 700 : 500,
          color: emphasis ? "var(--color-coral-700)" : "var(--y2k-border)",
        }}
      >
        {name}
      </span>
      <span
        className="cirrus-num"
        style={{
          fontWeight: emphasis ? 700 : 500,
          color: "var(--y2k-border)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
