import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const forecasts = await prisma.forecast.findMany({
    select: { id: true, status: true },
  });
  if (forecasts.length === 0) {
    console.log("[wipe] no forecasts to delete");
    return;
  }
  console.log(`[wipe] removing ${forecasts.length} forecasts:`);
  for (const forecast of forecasts) {
    console.log(`  ${forecast.id.slice(-6)}  status=${forecast.status}`);
  }
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
  const result = await prisma.forecast.deleteMany({ where: { id: { in: ids } } });
  console.log(`[wipe] deleted ${result.count} forecasts and dependents`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
