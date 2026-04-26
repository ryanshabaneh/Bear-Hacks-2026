import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { ClientOnboardingModal } from "@/components/onboarding/ClientOnboardingModal";
import { StudioFlow } from "@/components/client/StudioFlow";
import { NodesIndicator } from "@/components/client/NodesIndicator";

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
      take: 40,
      include: {
        _count: { select: { slices: true } },
        slices: {
          where: { status: "completed" },
          select: { id: true },
        },
        catchment: { select: { bundleUrl: true, slicesCompleted: true } },
      },
    }),
  ]);

  const showOnboarding = !client?.onboardedAt;
  const balance = (client?.balanceCents ?? 0) / 100;
  const totalSealed = forecasts.filter((forecast) => forecast.status === "sealed").length;
  const totalInFlight = forecasts.filter((forecast) =>
    ["queued", "active", "sealing"].includes(forecast.status),
  ).length;

  const initialItems = forecasts.map((forecast) => {
    const fileName = forecast.inputManifestUrl.startsWith("file://")
      ? forecast.inputManifestUrl.split("/").pop() ?? "audio"
      : "audio";
    return {
      id: forecast.id,
      status: forecast.status,
      fileName,
      audioHoursTotal: forecast.audioHoursTotal,
      budgetCents: forecast.budgetCents,
      budgetCyclesUsed: forecast.budgetCyclesUsed,
      slicesTotal: forecast._count.slices,
      slicesCompleted: forecast.slices.length,
      bundleUrl: forecast.catchment?.bundleUrl ?? null,
      createdAt: forecast.createdAt.toISOString(),
      sealedAt: forecast.sealedAt?.toISOString() ?? null,
    };
  });

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-7 pt-6">
        <header className="flex flex-col gap-2">
          <span className="cirrus-text-unit">Client studio · {client?.displayName ?? "guest"}</span>
          <h1 className="cirrus-text-h1">
            welcome back, {client?.displayName ?? "there"}.
          </h1>
          <p className="cirrus-text-body" style={{ opacity: 0.8, maxWidth: 540 }}>
            i&apos;m strata. drop audio or video, i route it to browser-tab compute,
            you get a clean transcript back. each job is called a forecast.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile
            label="Credit balance"
            value={`$${balance.toFixed(2)}`}
            caption="auto-seeds +$50 on first cast"
            tone="cream"
          />
          <StatTile
            label="In flight"
            value={String(totalInFlight)}
            caption="forecasts currently being transcribed"
            tone="pink"
          />
          <StatTile
            label="Forecasts sealed"
            value={String(totalSealed)}
            caption="finished jobs on this account, all-time"
            tone="default"
          />
        </section>

        <NodesIndicator />

        <StudioFlow initialForecasts={initialItems} />
      </div>
      {showOnboarding ? <ClientOnboardingModal /> : null}
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "default" | "pink" | "cream";
}) {
  const toneClass =
    tone === "pink" ? "y2k-tile-pink" : tone === "cream" ? "y2k-tile-cream" : "";
  return (
    <div className={`y2k-tile ${toneClass} flex flex-col gap-2`}>
      <span className="cirrus-text-unit">{label}</span>
      <span className="cirrus-num" style={{ fontSize: 32, fontWeight: 700 }}>
        {value}
      </span>
      <span className="y2k-mono" style={{ fontSize: 11, opacity: 0.7 }}>
        {caption}
      </span>
    </div>
  );
}
