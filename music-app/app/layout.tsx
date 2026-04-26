import type { Metadata } from "next";
import Link from "next/link";
import { Silkscreen, VT323 } from "next/font/google";
import { StrataChip } from "./_components/StrataChip";
import "./globals.css";

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

export const metadata: Metadata = {
  title: "STRATUS",
  description: "Cozy pixel music room. Skip ads with idle compute.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${vt323.variable}`}>
      <body>
        {/* Fixed scene decorations behind everything */}
        <div className="scene-deco" aria-hidden="true">
          <div className="string-lights" />

          {/* Wall trim band (chair rail) */}
          <div className="wall-trim" />

          {/* Wall poster, top-left */}
          <div className="poster">
            <div className="poster-band">SYNTH FEST</div>
            <div className="poster-art">
              <span className="poster-dot d1" />
              <span className="poster-dot d2" />
              <span className="poster-dot d3" />
            </div>
            <div className="poster-band poster-band-bottom">2026 · LIVE</div>
          </div>

          {/* Floating shelf with vinyl records, mid-left */}
          <div className="vinyl-shelf">
            <div className="vinyls">
              <span className="vinyl v1" />
              <span className="vinyl v2" />
              <span className="vinyl v3" />
            </div>
            <div className="shelf-board" />
            <div className="shelf-bracket bracket-left" />
            <div className="shelf-bracket bracket-right" />
          </div>

          <div className="window-frame">
            <div className="pane" />
            <div className="pane" />
            <div className="pane" />
            <div className="pane" />
          </div>
          <div className="plant">
            <div className="leaves" />
            <div className="pot" />
          </div>
          <div className="lava-lamp">
            <div className="cap" />
            <div className="glass" />
            <div className="base" />
          </div>
        </div>

        <div className="container">
          <nav className="nav">
            <span className="brand">★ STRATUS</span>
            <Link href="/">Player</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          {children}
        </div>

        {/* Strata "embed" chip — only renders when compute mode is on. */}
        <StrataChip />
      </body>
    </html>
  );
}
