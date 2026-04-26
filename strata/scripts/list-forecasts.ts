import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const list = await prisma.forecast.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      status: true,
      createdAt: true,
      frontOpenedAt: true,
      sealedAt: true,
      _count: { select: { slices: true } },
    },
  });
  for (const forecast of list) {
    const completed = await prisma.slice.count({
      where: { forecastId: forecast.id, status: "completed" },
    });
    console.log(
      `${forecast.id.slice(-6)}  status=${forecast.status.padEnd(8)}  slices=${completed}/${forecast._count.slices}  created=${forecast.createdAt.toISOString()}  opened=${forecast.frontOpenedAt?.toISOString() ?? "-"}  sealed=${forecast.sealedAt?.toISOString() ?? "-"}`,
    );
  }
}
main().then(() => prisma.$disconnect());
