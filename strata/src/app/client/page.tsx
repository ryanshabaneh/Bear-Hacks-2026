import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";

export default async function ClientDashboard() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client") redirect("/distributor");

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-8 pt-4">
        <section className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UnitLabel>Forecasts</UnitLabel>
            <span className="cirrus-text-mono-id opacity-60">none yet</span>
          </div>
          <Link
            href="/client/forecasts/new"
            className="inline-flex items-center px-3 py-1.5 rounded-md cirrus-text-body-sm"
            style={{ background: "var(--color-ink-900)", color: "var(--color-cream)" }}
          >
            Start a Forecast →
          </Link>
        </section>

        <p className="cirrus-text-body-sm opacity-50">
          Forecast list, balance, capability ceiling panels mount here in slice 35.
        </p>
      </div>
    </AppShell>
  );
}
