import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { MonoNumber } from "@/components/cirrus/primitives/MonoNumber";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { Button } from "@/components/ui/Button";
import { ClientOnboardingModal } from "@/components/onboarding/ClientOnboardingModal";

export default async function ClientDashboard() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client" || !session.user.clientId) {
    redirect("/distributor");
  }

  const [client, forecasts] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.user.clientId } }),
    prisma.forecast.findMany({
      where: { clientId: session.user.clientId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { catchment: true },
    }),
  ]);

  const showOnboarding = !client?.onboardedAt;
  const balance = (client?.balanceCents ?? 500) / 100;
  const totalSealed = forecasts.filter((f) => f.status === "sealed").length;

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-8 pt-4">
        <header className="flex flex-col gap-2">
          <UnitLabel>Studio</UnitLabel>
          <h1 className="cirrus-text-h1">Welcome back, {client?.displayName}.</h1>
          <p className="cirrus-text-body-sm opacity-70">
            Cast a Forecast and watch the Sky catch it.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cirrus-card p-5 flex flex-col gap-2">
            <UnitLabel>Credit balance</UnitLabel>
            <MonoNumber className="cirrus-text-display">
              ${balance.toFixed(2)}
            </MonoNumber>
            <span className="cirrus-text-body-sm opacity-60">
              starts with $5 in trial credit
            </span>
          </div>
          <div className="cirrus-card p-5 flex flex-col gap-2">
            <UnitLabel>Forecasts sealed</UnitLabel>
            <MonoNumber className="cirrus-text-display">{totalSealed}</MonoNumber>
            <span className="cirrus-text-body-sm opacity-60">
              all-time on this account
            </span>
          </div>
          <div className="cirrus-card p-5 flex flex-col gap-2 items-start">
            <UnitLabel>Cast a new one</UnitLabel>
            <p className="cirrus-text-body-sm opacity-70">
              Drop an audio file, watch it transcribe live.
            </p>
            <Link href="/client/transcribe" className="mt-1">
              <Button>Open transcribe →</Button>
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <UnitLabel>Recent Forecasts</UnitLabel>
            <span className="cirrus-text-mono-id opacity-60">
              {forecasts.length} shown
            </span>
          </div>
          {forecasts.length === 0 ? (
            <div className="cirrus-card p-8 text-center flex flex-col gap-3 items-center">
              <span className="cirrus-text-h2">No Forecasts yet.</span>
              <span className="cirrus-text-body-sm opacity-60 max-w-[360px]">
                Your first Forecast will appear here. Each one shows live
                transcription progress, attestations, and the final Catchment.
              </span>
              <Link href="/client/transcribe" className="mt-2">
                <Button>Cast your first Forecast →</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {forecasts.map((f) => (
                <Link
                  key={f.id}
                  href={`/client/forecasts/${f.id}`}
                  className="cirrus-card p-4 flex flex-col gap-2 hover:bg-[rgba(255,255,255,0.7)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <UnitLabel>Forecast · {f.id.slice(-4).toUpperCase()}</UnitLabel>
                    <Pill
                      tone={
                        f.status === "sealed"
                          ? "sage"
                          : f.status === "active"
                            ? "coral"
                            : f.status === "failed"
                              ? "neutral"
                              : "butter"
                      }
                    >
                      {f.status}
                    </Pill>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <MonoNumber className="cirrus-text-h2">
                      {(f.audioHoursTotal * 60).toFixed(1)}
                    </MonoNumber>
                    <span className="cirrus-text-body-sm opacity-60">min audio</span>
                  </div>
                  <span className="cirrus-text-body-sm opacity-60">
                    Cycles used: {f.budgetCyclesUsed}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      {showOnboarding ? <ClientOnboardingModal /> : null}
    </AppShell>
  );
}
