import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join("/tmp", "strata-uploads");
const COST_PER_KC_CENTS = 2.9;
const ESTIMATED_CYCLES_PER_CHUNK = 14;
const MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED_EXTS = new Set([
  ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac",
  ".mp4", ".mov", ".webm", ".mkv", ".avi",
]);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("audio");
  const estimatedSeconds = Number(form.get("estimatedSeconds") ?? 0);

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

  const forecast = await prisma.forecast.create({
    data: {
      clientId: session.user.clientId,
      inputManifestUrl: `file://${savedPath}`,
      audioHoursTotal,
      languageScope: "English",
      outputFormats: JSON.stringify(["srt"]),
      status: "queued",
      budgetCents,
    },
  });

  console.log(
    `[strata ${forecast.id.slice(-4)}] queued     file=${file.name} bytes=${file.size} estChunks=${chunkCount}`,
  );

  return NextResponse.json({
    id: forecast.id,
    status: forecast.status,
    fileName: file.name,
    fileBytes: file.size,
    audioHoursTotal,
    budgetCents,
    estimatedChunks: chunkCount,
  });
}
