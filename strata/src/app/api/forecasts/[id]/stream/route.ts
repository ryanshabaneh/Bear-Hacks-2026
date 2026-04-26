import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { subscribeForecast, type ForecastEvent } from "@/lib/sse/bus";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return new Response("unauthorized", { status: 401 });
  }

  const forecast = await prisma.forecast.findUnique({
    where: { id },
    include: { slices: { orderBy: [{ chunkIndex: "asc" }, { attemptNumber: "asc" }] }, catchment: true },
  });
  if (!forecast) {
    return new Response("not found", { status: 404 });
  }

  if (session.user.role === "client" && forecast.clientId !== session.user.clientId) {
    return new Response("forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ForecastEvent | { type: "snapshot"; forecast: unknown }) => {
        const json = JSON.stringify(event);
        const eventName = event.type.includes(":") ? event.type.replace(":", "-") : event.type;
        controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${json}\n\n`));
      };

      send({
        type: "snapshot",
        forecast: {
          id: forecast.id,
          status: forecast.status,
          audioHoursTotal: forecast.audioHoursTotal,
          budgetCents: forecast.budgetCents,
          budgetCyclesUsed: forecast.budgetCyclesUsed,
          slices: forecast.slices,
          catchment: forecast.catchment,
        },
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      }, 15_000);

      const unsub = subscribeForecast(id, send);

      const onAbort = () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      _req.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
