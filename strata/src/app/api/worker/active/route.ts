import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_WINDOW_MS = 30_000;

export async function GET() {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const nodes = await prisma.workerNode.findMany({
    where: { lastHeartbeatAt: { gte: cutoff } },
    orderBy: { lastHeartbeatAt: "desc" },
    select: {
      nodeKey: true,
      origin: true,
      label: true,
      slicesComputed: true,
      lastHeartbeatAt: true,
    },
  });

  return NextResponse.json({
    count: nodes.length,
    nodes: nodes.map((node) => ({
      nodeKey: node.nodeKey,
      origin: node.origin,
      label: node.label,
      slicesComputed: node.slicesComputed,
      lastHeartbeatAt: node.lastHeartbeatAt.toISOString(),
    })),
  });
}
