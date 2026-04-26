import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const failed = await prisma.forecast.findMany({
    where: { status: "failed" },
    select: { id: true, inputManifestUrl: true },
  });
  if (failed.length === 0) {
    console.log("[wipe] no failed forecasts");
    return;
  }
  const ids = failed.map((row) => row.id);
  console.log(`[wipe] removing ${ids.length} failed forecasts:`);
  for (const row of failed) {
    console.log(`        ${row.id.slice(-6)}  ${row.inputManifestUrl}`);
  }

  await prisma.attestation.deleteMany({
    where: { slice: { forecastId: { in: ids } } },
  });
  await prisma.slice.deleteMany({ where: { forecastId: { in: ids } } });
  await prisma.catchment.deleteMany({ where: { forecastId: { in: ids } } });
  await prisma.settlement.deleteMany({ where: { forecastId: { in: ids } } });
  await prisma.forecast.deleteMany({ where: { id: { in: ids } } });
  console.log("[wipe] done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
