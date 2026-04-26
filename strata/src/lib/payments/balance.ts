import { prisma } from "@/lib/db/prisma";

export type DistributorBalance = {
  lifetimeCents: number;
  todayCents: number;
};

export async function getDistributorBalance(
  distributorId: string,
): Promise<DistributorBalance> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [lifetime, today] = await Promise.all([
    prisma.settlement.aggregate({
      where: { distributorId },
      _sum: { distributorCents: true },
    }),
    prisma.settlement.aggregate({
      where: { distributorId, createdAt: { gte: startOfToday } },
      _sum: { distributorCents: true },
    }),
  ]);

  return {
    lifetimeCents: lifetime._sum.distributorCents ?? 0,
    todayCents: today._sum.distributorCents ?? 0,
  };
}
