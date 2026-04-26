import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { Window } from "@/components/ui/Window";
import { Pill } from "@/components/cirrus/primitives/Pill";
import { ForecastDetailLive } from "./ForecastDetailLive";
import { MediaPanel } from "./MediaPanel";

export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client") redirect("/distributor");

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    include: {
      slices: { orderBy: [{ chunkIndex: "asc" }, { attemptNumber: "asc" }] },
      catchment: true,
    },
  });

  if (!forecast) notFound();
  if (forecast.clientId !== session.user.clientId) redirect("/client");

  const slicesTotal = new Set(forecast.slices.map((slice) => slice.chunkIndex)).size;
  const completedSlices = forecast.slices.filter((slice) => slice.status === "completed");

  const videoExts = ["mp4", "mov", "webm"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "m4a", "aac"];
  const fileExt = forecast.inputManifestUrl.split(".").pop()?.toLowerCase() ?? "";
  const mediaKind: "video" | "audio" | "none" = videoExts.includes(fileExt)
    ? "video"
    : audioExts.includes(fileExt)
      ? "audio"
      : "none";
  const mediaSrc = `/api/uploads/${forecast.id}/raw`;

  const initialCompleted = completedSlices.map((slice) => ({
    chunkIndex: slice.chunkIndex,
    timestampStart: slice.timestampStart,
    timestampEnd: slice.timestampEnd,
    text: slice.outputText ?? undefined,
    arrivedAt: slice.completedAt?.getTime() ?? 0,
  }));

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-6 pt-6">
        <Link href="/client" className="y2k-link cirrus-text-unit self-start">
          &laquo; back to dashboard
        </Link>
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="cirrus-text-unit">
              Forecast · {forecast.id.slice(-4).toUpperCase()}
            </span>
            <h1 className="cirrus-text-h1">
              {Math.round(forecast.audioHoursTotal * 60)} min audio
            </h1>
          </div>
          <StatusPill status={forecast.status} />
        </header>

        {mediaKind !== "none" ? (
          <Window title="source.exe" titleBarTone="lavender" sparkles={false}>
            <MediaPanel src={mediaSrc} kind={mediaKind} />
          </Window>
        ) : null}

        <Window title="live.exe" titleBarTone="pink" sparkles={false}>
          <ForecastDetailLive
            forecastId={forecast.id}
            slicesTotal={slicesTotal}
            initialCompleted={initialCompleted}
          />
        </Window>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "queued") return <Pill tone="neutral">Queued</Pill>;
  if (status === "active") return <Pill tone="coral">Front open</Pill>;
  if (status === "sealing") return <Pill tone="butter">Catchment sealing</Pill>;
  if (status === "sealed") return <Pill tone="sage">Catchment sealed</Pill>;
  if (status === "failed") return <Pill tone="coral">Failed</Pill>;
  return <Pill tone="neutral">{status}</Pill>;
}
