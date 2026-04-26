import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Music App",
  description: "Simple music player with ad / compute breaks every 5 songs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <nav className="nav">
            <Link href="/">Player</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
