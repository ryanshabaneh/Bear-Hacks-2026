import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_EMAILS = process.argv.slice(2);

async function main() {
  if (TARGET_EMAILS.length === 0) {
    console.log("[reset] resetting onboardedAt for ALL users.");
    console.log("[reset] pass emails as args to limit scope: pnpm tsx scripts/reset-onboarding.ts kellygao@live.ca");
  }

  const where =
    TARGET_EMAILS.length > 0
      ? { user: { email: { in: TARGET_EMAILS } } }
      : {};

  const clientResult = await prisma.client.updateMany({
    where,
    data: { onboardedAt: null },
  });
  const distributorResult = await prisma.distributor.updateMany({
    where,
    data: { onboardedAt: null },
  });

  console.log(`[reset] clients reset: ${clientResult.count}`);
  console.log(`[reset] distributors reset: ${distributorResult.count}`);
  console.log("[reset] tutorial will re-show on next dashboard visit.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
