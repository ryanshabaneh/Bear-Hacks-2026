import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { DEMO_FIXTURE, SHORT_DEMO_FIXTURE, chunksFor } from "@/lib/forecast/fixture";
import { dispatchForecast } from "@/lib/forecast/dispatch";

const REDUNDANCY_K = 2;
const COST_PER_KC_CENTS = 2.9;

const CreateForecastBody = z.object({
  fixture: z.enum(["demo", "short"]).default("short"),
  languageScope: z.enum(["English", "Multilingual", "Translation"]).default("English"),
  outputFormats: z.array(z.enum(["srt", "vtt", "json", "plain"])).default(["srt"]),
  budgetCents: z.number().int().positive().max(50_000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateForecastBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fixture, languageScope, outputFormats } = parsed.data;
  const manifest = fixture === "demo" ? DEMO_FIXTURE : SHORT_DEMO_FIXTURE;
  const chunks = chunksFor(manifest, 30);

  const audioHoursTotal = manifest.totalSeconds / 3600;
  const estimatedCycles = chunks.length * REDUNDANCY_K * 14;
  const budgetCents = parsed.data.budgetCents ?? Math.ceil(estimatedCycles * COST_PER_KC_CENTS);

  const forecast = await prisma.forecast.create({
    data: {
      clientId: session.user.clientId,
      inputManifestUrl: `manifest://${manifest.name}`,
      audioHoursTotal,
      languageScope,
      outputFormats: JSON.stringify(outputFormats),
      budgetCents,
      status: "queued",
      slices: {
        create: chunks.flatMap((chunk) =>
          Array.from({ length: REDUNDANCY_K }, (_, attempt) => ({
            chunkIndex: chunk.chunkIndex,
            timestampStart: chunk.timestampStart,
            timestampEnd: chunk.timestampEnd,
            inputUrl: chunk.inputUrl,
            attemptNumber: attempt + 1,
            status: "issued",
          })),
        ),
      },
    },
  });

  void dispatchForecast({ forecastId: forecast.id });

  return NextResponse.json({
    id: forecast.id,
    status: forecast.status,
    audioHoursTotal,
    chunks: chunks.length,
    budgetCents,
  });
}
