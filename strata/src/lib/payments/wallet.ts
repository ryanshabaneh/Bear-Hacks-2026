import { prisma } from "@/lib/db/prisma";

export const seedCents = 5000;
export const lowWaterCents = 50;

export type ChargeOutcome =
  | { ok: true; balanceCents: number; seeded: boolean; chargedCents: number }
  | { ok: false; reason: "insufficient_funds"; balanceCents: number; chargedCents: number };

export async function chargeForecast(
  clientId: string,
  forecastId: string,
  costCents: number,
): Promise<ChargeOutcome> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, balanceCents: true },
  });
  if (!client) {
    return { ok: false, reason: "insufficient_funds", balanceCents: 0, chargedCents: costCents };
  }

  let balanceCents = client.balanceCents;
  let seeded = false;

  if (balanceCents < costCents && balanceCents <= lowWaterCents) {
    await prisma.client.update({
      where: { id: client.id },
      data: { balanceCents: { increment: seedCents } },
    });
    balanceCents += seedCents;
    seeded = true;
    console.log(
      `[wallet] auto-seed  client=${client.id.slice(-6)} forecast=${forecastId.slice(-6)} +$${(seedCents / 100).toFixed(2)} (demo scope-down)`,
    );
  }

  if (balanceCents < costCents) {
    return { ok: false, reason: "insufficient_funds", balanceCents, chargedCents: costCents };
  }

  const claimed = await prisma.client.updateMany({
    where: { id: client.id, balanceCents: { gte: costCents } },
    data: { balanceCents: { decrement: costCents } },
  });
  if (claimed.count === 0) {
    const refreshed = await prisma.client.findUnique({
      where: { id: client.id },
      select: { balanceCents: true },
    });
    return {
      ok: false,
      reason: "insufficient_funds",
      balanceCents: refreshed?.balanceCents ?? 0,
      chargedCents: costCents,
    };
  }

  console.log(
    `[wallet] charge     client=${client.id.slice(-6)} forecast=${forecastId.slice(-6)} -$${(costCents / 100).toFixed(2)} balance=$${((balanceCents - costCents) / 100).toFixed(2)}`,
  );

  return {
    ok: true,
    balanceCents: balanceCents - costCents,
    seeded,
    chargedCents: costCents,
  };
}
