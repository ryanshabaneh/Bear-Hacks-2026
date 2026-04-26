// Per plan/03-dcp-integration.md §Distributor SSE route.
// Streams earnings_tick events to the Distributor dashboard.

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sseHeaders, ssePing, subscribeSSE } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });
  if (!distributor) return new Response('Not Found', { status: 404 });
  if (distributor.userId !== session.userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const channel = `distributor:${params.id}`;
  let unsubscribe: (() => void) | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({ type: 'hello', distributorId: params.id })}\n\n`,
        ),
      );
      unsubscribe = subscribeSSE(channel, controller);
      pingTimer = setInterval(() => ssePing(controller), 15_000);

      const onAbort = () => {
        if (pingTimer) clearInterval(pingTimer);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', onAbort);
    },
    cancel() {
      if (pingTimer) clearInterval(pingTimer);
      unsubscribe?.();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
