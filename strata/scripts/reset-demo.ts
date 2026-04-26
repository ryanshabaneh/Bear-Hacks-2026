import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";

const prisma = new PrismaClient();
const TARGET_EMAIL = process.argv[2];

async function main() {
  const forecasts = await prisma.forecast.findMany({ select: { id: true } });
  const ids = forecasts.map((forecast) => forecast.id);
  const sliceIds = await prisma.slice.findMany({
    where: { forecastId: { in: ids } },
    select: { id: true },
  });
  const sliceIdList = sliceIds.map((slice) => slice.id);

  await prisma.attestation.deleteMany({ where: { sliceId: { in: sliceIdList } } });
  await prisma.settlement.deleteMany({ where: { forecastId: { in: ids } } });
  await prisma.catchment.deleteMany({ where: { forecastId: { in: ids } } });
  await prisma.slice.deleteMany({ where: { forecastId: { in: ids } } });
  const wiped = await prisma.forecast.deleteMany({ where: { id: { in: ids } } });

  const targetWhere = TARGET_EMAIL ? { user: { email: TARGET_EMAIL } } : {};
  const balanceReset = await prisma.client.updateMany({
    where: targetWhere,
    data: { balanceCents: 0 },
  });
  const clientOnboardingReset = await prisma.client.updateMany({
    where: targetWhere,
    data: { onboardedAt: null },
  });
  const distributorOnboardingReset = await prisma.distributor.updateMany({
    where: targetWhere,
    data: { onboardedAt: null },
  });

  await rm("/tmp/strata-uploads", { recursive: true, force: true }).catch(() => {});

  const scope = TARGET_EMAIL ? `email=${TARGET_EMAIL}` : "all accounts";
  console.log(`[reset] forecasts wiped: ${wiped.count}`);
  console.log(`[reset] uploads dir cleared: /tmp/strata-uploads`);
  console.log(`[reset] balances reset to $0: ${balanceReset.count} client(s) (${scope})`);
  console.log(
    `[reset] onboarding cleared: ${clientOnboardingReset.count} client(s), ${distributorOnboardingReset.count} distributor(s)`,
  );
  console.log(`[reset] ready for clean demo run`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
