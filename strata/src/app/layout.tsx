import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
