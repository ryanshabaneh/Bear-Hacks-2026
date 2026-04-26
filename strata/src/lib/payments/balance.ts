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

const MONTHLY_BASELINE = {
  audioHoursMonth: 4.2,
  forecastsContributed: 12,
  earningsMonthCents: 4280,
  earningsLifetimeCents: 18750,
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

  const baseline = process.env.DCP_MODE === "hardcode" ? MONTHLY_BASELINE : null;

  return {
    audioHoursMonth: Number(
      (audioHoursMonth + (baseline?.audioHoursMonth ?? 0)).toFixed(1),
    ),
    forecastsContributed:
      monthSettlements.length + (baseline?.forecastsContributed ?? 0),
    earningsLifetimeCents:
      (lifetimeSettlements._sum.distributorCents ?? 0) +
      (baseline?.earningsLifetimeCents ?? 0),
    earningsMonthCents:
      earningsMonthCents + (baseline?.earningsMonthCents ?? 0),
  };
}
