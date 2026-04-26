import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { dispatchForecast } from "@/lib/forecast/dispatch";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join("/tmp", "strata-uploads");
const COST_PER_KC_CENTS = 2.9;
const ESTIMATED_CYCLES_PER_CHUNK = 14;
const MAX_BYTES = 80 * 1024 * 1024;

const ALLOWED_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("audio");
  const estimatedSeconds = Number(form.get("estimatedSeconds") ?? 0);
  const fixtureName = (form.get("fixtureName") as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json(
      { error: "unsupported_format", allowed: Array.from(ALLOWED_EXTS) },
      { status: 400 },
    );
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const uploadId = randomUUID();
  const savedPath = path.join(UPLOAD_DIR, `${uploadId}${ext}`);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(savedPath, Buffer.from(arrayBuffer));

  const seconds = estimatedSeconds > 0 ? estimatedSeconds : 0;
  const chunkCount = Math.max(1, Math.ceil(seconds / 30));
  const audioHoursTotal = Number((seconds / 3600).toFixed(4));
  const estimatedCycles = chunkCount * ESTIMATED_CYCLES_PER_CHUNK;
  const budgetCents = Math.max(
    50,
    Math.ceil((estimatedCycles / 1000) * COST_PER_KC_CENTS * 100),
  );

  const REDUNDANCY_K = 2;
  const forecast = await prisma.forecast.create({
    data: {
      clientId: session.user.clientId,
      inputManifestUrl: `file://${savedPath}`,
      audioHoursTotal,
      languageScope: "English",
      outputFormats: JSON.stringify(["srt"]),
      status: "queued",
      budgetCents,
      slices: {
        create: Array.from({ length: chunkCount }, (_, idx) =>
          Array.from({ length: REDUNDANCY_K }, (__, attempt) => ({
            chunkIndex: idx,
            timestampStart: idx * 30,
            timestampEnd: idx * 30 + 30,
            inputUrl: `file://${savedPath}#t=${idx * 30},${idx * 30 + 30}`,
            attemptNumber: attempt + 1,
            status: "issued",
          })),
        ).flat(),
      },
    },
  });

  void dispatchForecast({
    forecastId: forecast.id,
    fixtureName: fixtureName ?? undefined,
  });

  return NextResponse.json({
    id: forecast.id,
    status: forecast.status,
    chunks: chunkCount,
    audioHoursTotal,
    budgetCents,
  });
}
