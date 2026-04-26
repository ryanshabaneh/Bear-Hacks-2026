import Link from "next/link";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import type { AccountRole } from "@/lib/auth/session";

export function Topbar({
  role,
  email,
}: {
  role: AccountRole;
  email: string;
}) {
  return (
    <header className="flex items-center justify-between px-6 sm:px-8 lg:px-12 py-4 lg:py-5">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden="true" className="block w-2 h-2 rounded-full bg-coral-500" />
          <span className="cirrus-text-h2">Strata</span>
        </Link>
        <span className="opacity-30" aria-hidden>/</span>
        <Pill tone="neutral">{role === "distributor" ? "Distributor" : "Client"}</Pill>
      </div>

      <nav className="flex items-center gap-6 cirrus-text-body-sm">
        {role === "distributor" ? (
          <>
            <Link href="/distributor" className="opacity-80 hover:opacity-100">
              Dashboard
            </Link>
            <Link href="/distributor/sites" className="opacity-80 hover:opacity-100">
              Sites
            </Link>
            <Link href="/distributor/payouts" className="opacity-80 hover:opacity-100">
              Payouts
            </Link>
          </>
        ) : (
          <>
            <Link href="/client" className="opacity-80 hover:opacity-100">
              Dashboard
            </Link>
            <Link href="/client/forecasts/new" className="opacity-80 hover:opacity-100">
              New Forecast
            </Link>
            <Link href="/client/balance" className="opacity-80 hover:opacity-100">
              Balance
            </Link>
          </>
        )}

        <span className="flex items-center gap-2 opacity-60">
          <UnitLabel className="opacity-80">{email}</UnitLabel>
          <Link href="/auth/logout" className="opacity-80 hover:opacity-100" aria-label="Sign out">
            Sign out
          </Link>
        </span>
      </nav>
    </header>
  );
}
