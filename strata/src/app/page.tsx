import Link from "next/link";
import { CirrusStage } from "@/components/cirrus/stage/CirrusStage";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { MonoNumber } from "@/components/cirrus/primitives/MonoNumber";

export default function MarketingLanding() {
  return (
    <CirrusStage variant="marketing">
      <div className="px-6 sm:px-8 lg:px-12 py-6 lg:py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="block w-2 h-2 rounded-full bg-coral-500" />
            <span className="cirrus-text-h2">Strata</span>
          </Link>
          <nav className="flex items-center gap-6 cirrus-text-body-sm opacity-80">
            <Link href="/pricing">Pricing</Link>
            <Link href="/distributors">Distributors</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/auth/login" className="opacity-100">
              Sign in
            </Link>
          </nav>
        </header>
      </div>

      <main className="px-6 sm:px-8 lg:px-12 pt-8 lg:pt-16 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 max-w-[1200px] mx-auto">
        <section className="flex flex-col gap-6 max-w-[480px]">
          <div className="cirrus-card inline-flex items-center gap-3 px-3 py-1.5 self-start">
            <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-coral-500" />
            <UnitLabel>Sky is live</UnitLabel>
            <span className="cirrus-text-mono-id opacity-70">+38 / 60s</span>
          </div>

          <h1 className="cirrus-text-marketing-h1">Transcription, priced like weather.</h1>

          <p className="cirrus-text-body opacity-80 leading-relaxed">
            Your audio falls across a live Sky of browsers and settles as a finished
            transcript. <strong>Four cents an audio-hour.</strong> Three times under
            AssemblyAI batch. Nine times under Whisper API.
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login?screen_hint=signup&account_type=client"
              className="inline-flex items-center px-4 py-2.5 rounded-md cirrus-text-body transition-colors"
              style={{ background: "var(--color-ink-900)", color: "var(--color-cream)" }}
            >
              Start a Forecast →
            </Link>
            <Link
              href="/auth/login?screen_hint=signup&account_type=distributor"
              className="inline-flex items-center px-4 py-2.5 rounded-md cirrus-text-body cirrus-card"
            >
              Host the Sky
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 cirrus-text-mono-id opacity-80 mt-4">
            <span>
              <strong style={{ color: "var(--color-coral-500)" }}>
                Strata <MonoNumber>$0.04</MonoNumber>
              </strong>
            </span>
            <span aria-hidden>·</span>
            <span>AssemblyAI <MonoNumber>$0.12</MonoNumber></span>
            <span aria-hidden>·</span>
            <span>Whisper API <MonoNumber>$0.36</MonoNumber></span>
            <span aria-hidden>·</span>
            <span>Rev AI <MonoNumber>$1.20</MonoNumber></span>
            <span aria-hidden>·</span>
            <span className="opacity-50">Rev human <MonoNumber>$90</MonoNumber></span>
          </div>
        </section>

        <aside className="hidden lg:flex items-center justify-center" aria-hidden="true">
          <svg
            viewBox="0 0 480 560"
            preserveAspectRatio="xMidYMid meet"
            className="w-full max-w-[420px] h-auto"
          >
            <defs>
              <linearGradient id="strata-band-1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5ecf2" />
                <stop offset="100%" stopColor="#e8d4e8" />
              </linearGradient>
              <linearGradient id="strata-band-2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8d4e8" />
                <stop offset="100%" stopColor="#c4a8d4" />
              </linearGradient>
              <linearGradient id="strata-band-3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9080b0" />
                <stop offset="100%" stopColor="#3a2a5a" />
              </linearGradient>
              <linearGradient id="strata-band-4" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a2a5a" />
                <stop offset="100%" stopColor="#0a1424" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="480" height="140" fill="url(#strata-band-1)" />
            <rect x="0" y="140" width="480" height="168" fill="url(#strata-band-2)" />
            <rect x="0" y="308" width="480" height="140" fill="url(#strata-band-3)" />
            <rect x="0" y="448" width="480" height="112" fill="url(#strata-band-4)" />
            <g stroke="rgba(255,255,255,0.40)" fill="none" strokeWidth="0.6">
              <path d="M 0 80 Q 120 70, 240 78 T 480 78" />
              <path d="M 0 220 Q 120 215, 240 222 T 480 220" />
              <path d="M 0 380 Q 120 372, 240 380 T 480 380" />
              <path d="M 0 500 Q 120 495, 240 502 T 480 500" />
            </g>
            <circle cx="80" cy="62" r="1.5" fill="#f4885a" />
            <circle cx="380" cy="510" r="1.5" fill="#f4885a" />
            <circle cx="160" cy="200" r="1" fill="#fafaf7" opacity="0.6" />
            <circle cx="320" cy="260" r="1" fill="#fafaf7" opacity="0.4" />
            <circle cx="220" cy="340" r="0.8" fill="#fafaf7" opacity="0.3" />
          </svg>
        </aside>
      </main>

      <footer className="px-6 sm:px-8 lg:px-12 pb-8 max-w-[1200px] mx-auto flex justify-between cirrus-text-body-sm opacity-60">
        <span>strata.app · v0</span>
        <Pill tone="sage">Sky · 47 nodes</Pill>
      </footer>
    </CirrusStage>
  );
}
