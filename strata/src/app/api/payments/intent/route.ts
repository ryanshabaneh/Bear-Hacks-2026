import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { createForecastFundingIntent } from "@/lib/payments/stripe";

const Body = z.object({
  forecastId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const forecast = await prisma.forecast.findUnique({
    where: { id: parsed.data.forecastId },
  });
  if (!forecast || forecast.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const intent = await createForecastFundingIntent({
    budgetCents: forecast.budgetCents,
    forecastId: forecast.id,
    clientId: session.user.clientId,
  });

  return NextResponse.json({
    clientSecret: intent.client_secret,
    intentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
  });
}
