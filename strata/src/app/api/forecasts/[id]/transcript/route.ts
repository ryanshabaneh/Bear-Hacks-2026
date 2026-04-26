import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      status: true,
      sealedAt: true,
      audioHoursTotal: true,
      slices: {
        where: { status: "completed" },
        orderBy: { chunkIndex: "asc" },
        select: {
          chunkIndex: true,
          timestampStart: true,
          timestampEnd: true,
          outputText: true,
        },
      },
    },
  });

  if (!forecast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (forecast.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const segments = forecast.slices.map((slice) => ({
    chunkIndex: slice.chunkIndex,
    start: slice.timestampStart,
    end: slice.timestampEnd,
    text: slice.outputText ?? "",
  }));
  const fullText = segments
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join(" ");

  return NextResponse.json({
    forecastId: forecast.id,
    status: forecast.status,
    sealedAt: forecast.sealedAt,
    audioHoursTotal: forecast.audioHoursTotal,
    segmentCount: segments.length,
    fullText,
    segments,
  });
}
