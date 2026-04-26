import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const fakes = await prisma.forecast.findMany({
    where: { inputManifestUrl: { startsWith: "seed://" } },
    select: { id: true },
  });
  const fakeIds = fakes.map((row) => row.id);
  if (fakeIds.length === 0) {
    console.log("[wipe] no fake forecasts (seed://) found");
    return;
  }
  console.log(`[wipe] removing ${fakeIds.length} fake forecasts and dependents...`);

  await prisma.attestation.deleteMany({
    where: { slice: { forecastId: { in: fakeIds } } },
  });
  await prisma.slice.deleteMany({ where: { forecastId: { in: fakeIds } } });
  await prisma.catchment.deleteMany({ where: { forecastId: { in: fakeIds } } });
  await prisma.settlement.deleteMany({ where: { forecastId: { in: fakeIds } } });
  await prisma.forecast.deleteMany({ where: { id: { in: fakeIds } } });

  console.log("[wipe] done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
