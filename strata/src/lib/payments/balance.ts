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

export type DistributorStats = {
  audioHoursMonth: number;
  forecastsContributed: number;
  earningsLifetimeCents: number;
  earningsMonthCents: number;
};

export async function getDistributorStats(
  distributorId: string,
): Promise<DistributorStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [monthSettlements, lifetimeSettlements] = await Promise.all([
    prisma.settlement.findMany({
      where: { distributorId, createdAt: { gte: monthStart } },
      select: {
        forecastId: true,
        distributorCents: true,
        forecast: { select: { audioHoursTotal: true } },
      },
    }),
    prisma.settlement.aggregate({
      where: { distributorId },
      _sum: { distributorCents: true },
    }),
  ]);

  const audioHoursMonth = monthSettlements.reduce(
    (sum, s) => sum + (s.forecast?.audioHoursTotal ?? 0),
    0,
  );
  const earningsMonthCents = monthSettlements.reduce(
    (sum, s) => sum + s.distributorCents,
    0,
  );

  return {
    audioHoursMonth: Number(audioHoursMonth.toFixed(1)),
    forecastsContributed: monthSettlements.length,
    earningsLifetimeCents: lifetimeSettlements._sum.distributorCents ?? 0,
    earningsMonthCents,
  };
}
