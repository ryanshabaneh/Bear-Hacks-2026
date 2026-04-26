import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-loaded",
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Strata — Transcription, priced like weather.",
  description:
    "Your audio falls across a live Sky of browsers and settles as a finished transcript. Four cents an audio-hour.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`antialiased ${serif.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
