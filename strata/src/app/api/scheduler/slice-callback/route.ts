import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { publishForecast } from "@/lib/sse/bus";

const CallbackBody = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("accepted"),
    forecastId: z.string(),
    dcpJobId: z.string(),
    total: z.number().int(),
  }),
  z.object({
    phase: z.literal("status"),
    forecastId: z.string(),
    distributed: z.number().int(),
    computed: z.number().int(),
  }),
  z.object({
    phase: z.literal("result"),
    forecastId: z.string(),
    chunkIndex: z.number().int(),
    attemptNumber: z.number().int(),
    nodePubkey: z.string(),
    nodeRegion: z.string(),
    outputHash: z.string(),
    outputText: z.string(),
    cyclesConsumed: z.number().int(),
    schedulerSig: z.string(),
  }),
  z.object({
    phase: z.literal("error"),
    forecastId: z.string(),
    chunkIndex: z.number().int().optional(),
    attemptNumber: z.number().int().optional(),
    message: z.string(),
  }),
  z.object({
    phase: z.literal("done"),
    forecastId: z.string(),
    bundleUrl: z.string(),
    audioHoursSealed: z.number(),
    slicesCompleted: z.number().int(),
    slicesTotal: z.number().int(),
  }),
  z.object({
    phase: z.literal("failed"),
    forecastId: z.string(),
    reason: z.string(),
  }),
]);

function verifyBearer(req: NextRequest): boolean {
  const expected = process.env.DCP_WORKER_SHARED_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  const provided = m[1];
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CallbackBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = parsed.data;

  switch (event.phase) {
    case "accepted": {
      await prisma.forecast.update({
        where: { id: event.forecastId },
        data: { status: "active", frontOpenedAt: new Date() },
      });
      publishForecast(event.forecastId, {
        type: "front:opening",
        forecastId: event.forecastId,
        total: event.total,
        ts: Date.now(),
      });
      return NextResponse.json({ ok: true });
    }

    case "status": {
      return NextResponse.json({ ok: true });
    }

    case "result": {
      const slice = await prisma.slice.findFirst({
        where: {
          forecastId: event.forecastId,
          chunkIndex: event.chunkIndex,
          attemptNumber: event.attemptNumber,
        },
      });
      if (!slice) return NextResponse.json({ error: "slice_not_found" }, { status: 404 });

      const peer = await prisma.slice.findFirst({
        where: {
          forecastId: event.forecastId,
          chunkIndex: event.chunkIndex,
          NOT: { attemptNumber: event.attemptNumber },
        },
      });

      const quorumAgreed = peer && peer.outputHash && peer.outputHash === event.outputHash;

      await prisma.slice.update({
        where: { id: slice.id },
        data: {
          status: quorumAgreed ? "completed" : "running",
          nodePubkey: event.nodePubkey,
          outputHash: event.outputHash,
          outputText: event.outputText,
          cyclesConsumed: event.cyclesConsumed,
          completedAt: quorumAgreed ? new Date() : null,
        },
      });

      await prisma.attestation.upsert({
        where: { sliceId: slice.id },
        update: {
          nodePubkey: event.nodePubkey,
          nodeRegionGlyph: event.nodeRegion,
          outputHash: event.outputHash,
          schedulerSig: event.schedulerSig,
        },
        create: {
          sliceId: slice.id,
          nodePubkey: event.nodePubkey,
          nodeRegionGlyph: event.nodeRegion,
          outputHash: event.outputHash,
          schedulerSig: event.schedulerSig,
        },
      });

      if (quorumAgreed) {
        await prisma.forecast.update({
          where: { id: event.forecastId },
          data: { budgetCyclesUsed: { increment: event.cyclesConsumed } },
        });

        publishForecast(event.forecastId, {
          type: "slice:arrived",
          forecastId: event.forecastId,
          chunkIndex: event.chunkIndex,
          timestampStart: slice.timestampStart,
          timestampEnd: slice.timestampEnd,
          outputHash: event.outputHash,
          nodeRegion: event.nodeRegion,
          cyclesConsumed: event.cyclesConsumed,
          text: event.outputText,
          ts: Date.now(),
        });
      }

      return NextResponse.json({ ok: true, quorumAgreed });
    }

    case "error": {
      publishForecast(event.forecastId, {
        type: "forecast:failed",
        forecastId: event.forecastId,
        reason: event.message,
        ts: Date.now(),
      });
      return NextResponse.json({ ok: true });
    }

    case "done": {
      await prisma.forecast.update({
        where: { id: event.forecastId },
        data: { status: "sealed", sealedAt: new Date() },
      });

      await prisma.catchment.upsert({
        where: { forecastId: event.forecastId },
        update: {
          bundleUrl: event.bundleUrl,
          audioHoursSealed: event.audioHoursSealed,
          slicesCompleted: event.slicesCompleted,
          slicesTotal: event.slicesTotal,
        },
        create: {
          forecastId: event.forecastId,
          bundleUrl: event.bundleUrl,
          audioHoursSealed: event.audioHoursSealed,
          slicesCompleted: event.slicesCompleted,
          slicesTotal: event.slicesTotal,
        },
      });

      publishForecast(event.forecastId, {
        type: "catchment:sealed",
        forecastId: event.forecastId,
        bundleUrl: event.bundleUrl,
        slicesCompleted: event.slicesCompleted,
        slicesTotal: event.slicesTotal,
        audioHoursSealed: event.audioHoursSealed,
        ts: Date.now(),
      });

      return NextResponse.json({ ok: true });
    }

    case "failed": {
      await prisma.forecast.update({
        where: { id: event.forecastId },
        data: { status: "failed" },
      });
      publishForecast(event.forecastId, {
        type: "forecast:failed",
        forecastId: event.forecastId,
        reason: event.reason,
        ts: Date.now(),
      });
      return NextResponse.json({ ok: true });
    }
  }
}
