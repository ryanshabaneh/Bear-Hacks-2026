import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.forecast.findMany({
    where: { status: { notIn: ["sealed"] } },
    select: { id: true, status: true },
  });
  if (stuck.length === 0) {
    console.log("[wipe] nothing to delete");
    return;
  }
  console.log(`[wipe] removing ${stuck.length} non-sealed forecasts:`);
  for (const forecast of stuck) {
    console.log(`  ${forecast.id.slice(-6)}  status=${forecast.status}`);
  }
  const ids = stuck.map((forecast) => forecast.id);
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
