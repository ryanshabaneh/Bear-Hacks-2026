import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { constructWebhookEvent } from "@/lib/payments/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, sig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const forecastId = intent.metadata?.forecastId;
    if (forecastId) {
      await prisma.forecast.update({
        where: { id: forecastId },
        data: { status: "funded" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
