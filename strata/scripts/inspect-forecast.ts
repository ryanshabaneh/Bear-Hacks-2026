import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SUFFIX = process.argv[2] ?? "";

async function main() {
  const forecast = await prisma.forecast.findFirst({
    where: SUFFIX ? { id: { endsWith: SUFFIX } } : {},
    orderBy: { createdAt: "desc" },
    include: {
      slices: {
        select: {
          chunkIndex: true,
          status: true,
          completedAt: true,
          outputText: true,
        },
        orderBy: { chunkIndex: "asc" },
      },
    },
  });
  if (!forecast) {
    console.log("not found");
    return;
  }
  console.log(
    `forecast ${forecast.id.slice(-6)}  status=${forecast.status}  cycles=${forecast.budgetCyclesUsed}`,
  );
  console.log(`  frontOpenedAt=${forecast.frontOpenedAt?.toISOString() ?? "-"}`);
  console.log(`  sealedAt=${forecast.sealedAt?.toISOString() ?? "-"}`);
  console.log(`  inputManifestUrl=${forecast.inputManifestUrl}`);
  console.log("  slices:");
  for (const slice of forecast.slices) {
    const text = slice.outputText
      ? `"${slice.outputText.slice(0, 30).replace(/\s+/g, " ")}..."`
      : "-";
    console.log(
      `    ${String(slice.chunkIndex).padStart(3)}  ${slice.status.padEnd(10)}  done=${slice.completedAt?.toISOString() ?? "-"}  text=${text}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
