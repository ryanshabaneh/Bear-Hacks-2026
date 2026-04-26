import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const distributors = await prisma.distributor.findMany({
    include: { sites: { include: { slots: true } } },
  });
  for (const distributor of distributors) {
    console.log(`distributor=${distributor.id.slice(-6)} name=${distributor.displayName}`);
    for (const site of distributor.sites) {
      console.log(`  site=${site.id.slice(-6)} domain=${site.domain} slots=${site.slots.length}`);
    }
  }
  console.log(`total distributors=${distributors.length}`);
}
main().then(() => prisma.$disconnect());
