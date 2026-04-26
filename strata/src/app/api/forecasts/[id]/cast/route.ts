import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { chargeForecast } from "@/lib/payments/wallet";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const forecast = await prisma.forecast.findUnique({ where: { id } });
  if (!forecast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (forecast.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (forecast.status !== "queued") {
    return NextResponse.json(
      { error: "not_queued", status: forecast.status },
      { status: 409 },
    );
  }
  if (forecast.castedAt) {
    return NextResponse.json(
      { error: "already_casted", castedAt: forecast.castedAt },
      { status: 409 },
    );
  }

  const charge = await chargeForecast(
    session.user.clientId,
    forecast.id,
    forecast.budgetCents,
  );
  if (!charge.ok) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        balanceCents: charge.balanceCents,
        costCents: charge.chargedCents,
      },
      { status: 402 },
    );
  }

  const updated = await prisma.forecast.update({
    where: { id: forecast.id },
    data: { castedAt: new Date() },
  });

  console.log(
    `[strata ${forecast.id.slice(-4)}] cast       castedAt=${updated.castedAt?.toISOString()}  charged=$${(charge.chargedCents / 100).toFixed(2)}  balance=$${(charge.balanceCents / 100).toFixed(2)}${charge.seeded ? "  seeded=true" : ""}`,
  );

  return NextResponse.json({
    id: forecast.id,
    status: updated.status,
    castedAt: updated.castedAt,
    balanceCents: charge.balanceCents,
    seeded: charge.seeded,
  });
}
