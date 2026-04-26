import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const forecasts = await prisma.forecast.findMany({
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
  });

  const items = forecasts.map((forecast) => {
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

  return NextResponse.json({ forecasts: items });
}
