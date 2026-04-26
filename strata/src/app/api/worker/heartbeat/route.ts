import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_WINDOW_MS = 30_000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  let body: { nodeKey?: string; origin?: string; label?: string; slicesComputed?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const nodeKey = body.nodeKey?.trim();
  const origin = body.origin?.trim() || "unknown";
  if (!nodeKey) {
    return NextResponse.json({ error: "missing_nodeKey" }, { status: 400, headers: corsHeaders });
  }

  const label = body.label?.trim() || null;
  const slicesDelta = Number.isFinite(body.slicesComputed) ? Math.max(0, Number(body.slicesComputed)) : 0;
  const now = new Date();

  await prisma.workerNode.upsert({
    where: { nodeKey },
    create: {
      nodeKey,
      origin,
      label,
      slicesComputed: slicesDelta,
      lastHeartbeatAt: now,
    },
    update: {
      origin,
      label,
      slicesComputed: { increment: slicesDelta },
      lastHeartbeatAt: now,
    },
  });

  const cutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  const activeCount = await prisma.workerNode.count({
    where: { lastHeartbeatAt: { gte: cutoff } },
  });

  return NextResponse.json(
    { ok: true, activeCount, recordedAt: now.toISOString() },
    { headers: corsHeaders },
  );
}
