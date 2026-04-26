import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDistributorStats } from "@/lib/payments/balance";
import { DistributorOnboardingModal } from "@/components/onboarding/DistributorOnboardingModal";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { Window } from "@/components/ui/Window";
import { TrustNetworkPanel } from "@/components/distributor/TrustNetworkPanel";

export default async function DistributorDashboard() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=distributor");
  if (session.user.role !== "distributor" || !session.user.distributorId) {
    redirect("/client");
  }

  const [distributor, stats] = await Promise.all([
    prisma.distributor.findUnique({
      where: { id: session.user.distributorId },
    }),
    getDistributorStats(session.user.distributorId),
  ]);

  const displayName = distributor?.displayName ?? "Distributor";
  const showOnboarding = !distributor?.onboardedAt;
  const isSlopify = displayName.toLowerCase() === "slopify";
  const networkLabel = isSlopify ? "Slopify-PCN" : "Public Sky";
  const monthUsd = (stats.earningsMonthCents / 100).toFixed(2);

  return (
    <AppShell role="distributor" email={session.user.email}>
      <div className="flex flex-col gap-7 pt-6">
        <header className="flex flex-col gap-2">
          <span className="cirrus-text-unit">Distributor sky · {displayName}</span>
          <h1 className="cirrus-text-h1">compute lent.</h1>
          <p className="cirrus-text-body" style={{ opacity: 0.8, maxWidth: 540 }}>
            you lend idle browser-tab compute. strata routes transcription work to
            it, settles 80/20 on every sealed forecast.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="y2k-tile y2k-tile-cream flex flex-col gap-2">
            <span className="cirrus-text-unit">Audio-hours</span>
            <span className="cirrus-num" style={{ fontSize: 30, fontWeight: 700 }}>
              {stats.audioHoursMonth.toFixed(1)}
            </span>
            <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
              audio your nodes transcribed this month
            </span>
          </div>
          <div className="y2k-tile y2k-tile-pink flex flex-col gap-2">
            <span className="cirrus-text-unit">Forecasts contributed</span>
            <span className="cirrus-num" style={{ fontSize: 30, fontWeight: 700 }}>
              {stats.forecastsContributed}
            </span>
            <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
              jobs your compute helped seal this month
            </span>
          </div>
          <div className="y2k-tile flex flex-col gap-2">
            <span className="cirrus-text-unit">Earnings (USD)</span>
            <span className="cirrus-num" style={{ fontSize: 30, fontWeight: 700 }}>
              ${monthUsd}
            </span>
            <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
              your 80% share, this month
            </span>
          </div>
        </section>

        <Window title="network.exe" titleBarTone="lavender" sparkles={false}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="cirrus-text-unit">Compute network</span>
                <span className="cirrus-num" style={{ fontSize: 18, fontWeight: 700 }}>
                  {networkLabel}
                </span>
              </div>
              <span
                className={
                  isSlopify ? "cirrus-pill cirrus-pill-coral" : "cirrus-pill cirrus-pill-neutral"
                }
              >
                {isSlopify ? "Private group · v1 attribution" : "Public network"}
              </span>
            </div>
            <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
              {isSlopify
                ? "your nodes only see jobs from inside the slopify group. routing weights honour the group's compute-tier policy."
                : "your nodes accept any public strata job that meets the bid price. open marketplace."}
            </span>
          </div>
        </Window>

        <Window title="trust.exe" titleBarTone="pink" sparkles={false}>
          <TrustNetworkPanel />
        </Window>
      </div>
      {showOnboarding ? <DistributorOnboardingModal /> : null}
    </AppShell>
  );
}
