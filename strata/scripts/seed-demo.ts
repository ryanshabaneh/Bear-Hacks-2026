import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const clientEmail = "kellygao@live.ca";
const distributorEmail = "northbeacon@strata.demo";

function token(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

async function main() {
  const clientUser = await prisma.user.upsert({
    where: { email: clientEmail },
    create: {
      email: clientEmail,
      role: "client",
      client: {
        create: {
          displayName: "Saltbox Studio",
          balanceCents: 5000,
          tier: "provisional",
          capabilities: JSON.stringify(["English"]),
          onboardedAt: null,
        },
      },
    },
    update: {
      role: "client",
      client: {
        upsert: {
          create: {
            displayName: "Saltbox Studio",
            balanceCents: 5000,
            tier: "provisional",
            capabilities: JSON.stringify(["English"]),
            onboardedAt: null,
          },
          update: {
            balanceCents: 5000,
            onboardedAt: null,
          },
        },
      },
    },
    include: { client: true },
  });

  const distributorUser = await prisma.user.upsert({
    where: { email: distributorEmail },
    create: {
      email: distributorEmail,
      role: "distributor",
      distributor: {
        create: {
          displayName: "Northbeacon Media",
          dcpPaymentAddress: "0xnorthbeacon000fixture000demo000only",
          status: "active",
          onboardedAt: new Date(),
          sites: {
            create: {
              domain: "northbeacon.media",
              category: "publication",
              monthlyPageviewsBucket: "10k-100k",
              verificationToken: token("nb-verify"),
              verifiedAt: new Date(),
            },
          },
        },
      },
    },
    update: {
      role: "distributor",
    },
    include: {
      distributor: { include: { sites: true } },
    },
  });

  const distributor = distributorUser.distributor;
  if (distributor && distributor.sites.length > 0) {
    const site = distributor.sites[0];
    const existingSlot = await prisma.computeSlot.findFirst({
      where: { siteId: site.id, distributorId: distributor.id },
    });
    if (!existingSlot) {
      await prisma.computeSlot.create({
        data: {
          siteId: site.id,
          distributorId: distributor.id,
          name: "footer slot",
          allowedCategories: JSON.stringify(["transcription"]),
          maxTimePerNode: 90,
          defaultPosition: "footer",
          embedKey: token("nb-slot"),
          active: true,
        },
      });
    }
  }

  const balanceUsd = ((clientUser.client?.balanceCents ?? 0) / 100).toFixed(2);
  console.log(`[seed] client      ${clientEmail} balance=$${balanceUsd} onboardedAt=null`);
  console.log(
    `[seed] distributor ${distributorEmail} display="${distributor?.displayName}" sites=${distributor?.sites.length ?? 0}`,
  );
  console.log(`[seed] ready for demo run`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
