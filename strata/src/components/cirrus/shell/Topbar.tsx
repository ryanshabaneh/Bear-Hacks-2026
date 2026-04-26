import Link from "next/link";
import type { AccountRole } from "@/lib/auth/session";
import { Brandmark } from "@/components/ui/Brandmark";

export function Topbar({
  role,
  email,
}: {
  role: AccountRole;
  email: string;
}) {
  return (
    <header
      className="flex items-center justify-between px-6 sm:px-8 lg:px-12 py-3"
      style={{
        background: "var(--y2k-titlebar-lavender)",
        borderBottom: "1.5px solid var(--y2k-border)",
        boxShadow: "0 4px 0 0 var(--y2k-shadow)",
      }}
    >
      <div className="flex items-center gap-3">
        <Link href="/" className="group">
          <Brandmark />
        </Link>
        <span className="opacity-50 y2k-mono" aria-hidden>
          ::
        </span>
        <span
          className="y2k-mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--y2k-border)",
            border: "1.5px solid var(--y2k-border)",
            background: "var(--y2k-window)",
            padding: "2px 8px",
            boxShadow: "1px 1px 0 0 var(--y2k-shadow)",
          }}
        >
          {role === "distributor" ? "Distributor" : "Client"}
        </span>
      </div>

      <nav className="flex items-center gap-5 y2k-mono" style={{ fontSize: 12 }}>
        {role === "distributor" ? (
          <Link href="/distributor" className="y2k-link">
            Dashboard
          </Link>
        ) : (
          <Link href="/client" className="y2k-link">
            Studio
          </Link>
        )}

        <span
          className="y2k-mono"
          style={{ fontSize: 10.5, opacity: 0.7, color: "var(--y2k-border)" }}
        >
          {email}
        </span>
        <Link href="/auth/logout" className="y2k-link" aria-label="Sign out">
          Sign out
        </Link>
      </nav>
    </header>
  );
}
