// In-memory SSE channels — see plan/03-dcp-integration.md §SSE infrastructure
//
// Process-local: works for a single Next.js node (Vercel serverless will not
// share state across regions). For BearHacks demo this is fine because the
// submit worker calls back to the same Vercel deployment that the dashboard
// EventSource is connected to, and Vercel pins SSE connections to one region.

type Controller = ReadableStreamDefaultController<Uint8Array>;

const channels = new Map<string, Set<Controller>>();
const encoder = new TextEncoder();

export function subscribeSSE(channel: string, controller: Controller): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(controller);
  return () => {
    set!.delete(controller);
    if (set!.size === 0) channels.delete(channel);
  };
}

export function broadcastSSE(channel: string, payload: unknown): void {
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const msg = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  set.forEach((c) => {
    try {
      c.enqueue(msg);
    } catch {
      set.delete(c);
    }
  });
}

export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

// Send a comment line to keep the connection alive through proxies.
export function ssePing(controller: Controller): void {
  try {
    controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
  } catch {
    // already closed
  }
}
