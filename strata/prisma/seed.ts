import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DISTRIBUTORS: Array<{
  email: string;
  display: string;
  domain: string;
  category: string;
  pageviewsBucket: string;
}> = [
  { email: "team@slopify.fm", display: "Slopify", domain: "slopify.fm", category: "podcast", pageviewsBucket: "1M-10M" },
  { email: "ops@lighthouse.studio", display: "Lighthouse Studio", domain: "lighthouse.studio", category: "editorial", pageviewsBucket: "100k-1M" },
  { email: "hi@nightcrew.media", display: "Nightcrew Media", domain: "nightcrew.media", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "team@cinderquill.com", display: "Cinder Quill", domain: "cinderquill.com", category: "editorial", pageviewsBucket: "10k-100k" },
  { email: "team@thegrid.report", display: "The Grid Report", domain: "thegrid.report", category: "newsletter", pageviewsBucket: "100k-1M" },
  { email: "ops@stack-and-thread.dev", display: "Stack & Thread", domain: "stack-and-thread.dev", category: "developer", pageviewsBucket: "10k-100k" },
  { email: "team@papercut.fm", display: "Papercut FM", domain: "papercut.fm", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "team@dispatch.kitchen", display: "Dispatch Kitchen", domain: "dispatch.kitchen", category: "newsletter", pageviewsBucket: "10k-100k" },
  { email: "ops@gulfstream.audio", display: "Gulfstream Audio", domain: "gulfstream.audio", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "hi@meridian.fm", display: "Meridian FM", domain: "meridian.fm", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "ops@brassknuckle.media", display: "Brass Knuckle Media", domain: "brassknuckle.media", category: "editorial", pageviewsBucket: "100k-1M" },
  { email: "team@kettleblack.co", display: "Kettle Black", domain: "kettleblack.co", category: "newsletter", pageviewsBucket: "10k-100k" },
  { email: "ops@fjord.report", display: "Fjord Report", domain: "fjord.report", category: "editorial", pageviewsBucket: "10k-100k" },
  { email: "team@coldopen.fm", display: "Cold Open", domain: "coldopen.fm", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "hi@blueline.studio", display: "Blueline Studio", domain: "blueline.studio", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "team@tinframe.media", display: "Tin Frame", domain: "tinframe.media", category: "editorial", pageviewsBucket: "10k-100k" },
  { email: "team@everswell.fm", display: "Everswell", domain: "everswell.fm", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "ops@dustline.report", display: "Dustline Report", domain: "dustline.report", category: "editorial", pageviewsBucket: "10k-100k" },
  { email: "team@sundialpodcast.com", display: "Sundial", domain: "sundialpodcast.com", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "hi@harborwatch.fm", display: "Harborwatch", domain: "harborwatch.fm", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "ops@noisefloor.dev", display: "Noisefloor", domain: "noisefloor.dev", category: "developer", pageviewsBucket: "10k-100k" },
  { email: "team@kindling.fm", display: "Kindling", domain: "kindling.fm", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "team@northbeacon.media", display: "North Beacon", domain: "northbeacon.media", category: "editorial", pageviewsBucket: "10k-100k" },
  { email: "ops@flatiron.audio", display: "Flatiron Audio", domain: "flatiron.audio", category: "podcast", pageviewsBucket: "100k-1M" },
  { email: "hi@parkbench.fm", display: "Parkbench", domain: "parkbench.fm", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "team@thirdrail.media", display: "Third Rail", domain: "thirdrail.media", category: "editorial", pageviewsBucket: "100k-1M" },
  { email: "team@undercurrent.fm", display: "Undercurrent", domain: "undercurrent.fm", category: "podcast", pageviewsBucket: "10k-100k" },
  { email: "team@galleyproof.co", display: "Galley Proof", domain: "galleyproof.co", category: "newsletter", pageviewsBucket: "10k-100k" },
  { email: "ops@bytecount.dev", display: "Bytecount", domain: "bytecount.dev", category: "developer", pageviewsBucket: "10k-100k" },
  { email: "team@porchlight.fm", display: "Porchlight", domain: "porchlight.fm", category: "podcast", pageviewsBucket: "100k-1M" },
];

const REGIONS = ["NA-east", "NA-west", "EU", "APAC"] as const;

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function randomHex(rng: () => number, bytes: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < bytes * 2; i++) out += chars[Math.floor(rng() * 16)];
  return out;
}

function pickWeighted<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

async function clearAll() {
  await prisma.settlement.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.catchment.deleteMany();
  await prisma.slice.deleteMany();
  await prisma.forecast.deleteMany();
  await prisma.computeSlot.deleteMany();
  await prisma.site.deleteMany();
  await prisma.client.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.user.deleteMany({ where: { role: { in: ["distributor", "client"] } } });
}

async function seedDistributors() {
  const out: Array<{ id: string; display: string; slotId: string }> = [];
  for (let i = 0; i < DISTRIBUTORS.length; i++) {
    const d = DISTRIBUTORS[i];
    const user = await prisma.user.create({
      data: { email: d.email, role: "distributor" },
    });
    const distributor = await prisma.distributor.create({
      data: {
        userId: user.id,
        displayName: d.display,
        dcpPaymentAddress: `0xseed_${user.id.slice(0, 16)}`,
        status: "active",
        cocAcceptedAt: new Date(Date.now() - (30 + i) * 86400000),
        cocVersionHash: "coc-v1-seed",
        onboardedAt: new Date(Date.now() - (30 + i) * 86400000),
      },
    });
    const site = await prisma.site.create({
      data: {
        distributorId: distributor.id,
        domain: d.domain,
        category: d.category,
        monthlyPageviewsBucket: d.pageviewsBucket,
        verificationToken: `tok_seed_${i}`,
        verifiedAt: new Date(Date.now() - (28 + i) * 86400000),
      },
    });
    const slot = await prisma.computeSlot.create({
      data: {
        siteId: site.id,
        distributorId: distributor.id,
        name: i === 0 ? "Slopify · primary" : `${d.display} · default`,
        allowedCategories: JSON.stringify(["transcription"]),
        maxTimePerNode: 60,
        defaultPosition: "footer",
        embedKey: `embed_seed_${i}`,
        active: true,
      },
    });
    out.push({ id: distributor.id, display: d.display, slotId: slot.id });
  }
  return out;
}

async function seedClients() {
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) {
    const user = await prisma.user.create({
      data: { email: `client${i}@strata.demo`, role: "client" },
    });
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        displayName: `Studio ${String.fromCharCode(65 + i)}`,
        onboardedAt: new Date(Date.now() - (10 + i) * 86400000),
      },
    });
    ids.push(client.id);
  }
  return ids;
}

async function seedHistoricalForecasts(
  distributors: Array<{ id: string; display: string; slotId: string }>,
  clientIds: string[],
) {
  const rng = pseudoRandom(0xb3a7);
  const FORECAST_COUNT = 150;
  const now = Date.now();

  let totalSlices = 0;
  let totalAttestations = 0;
  let totalSettlements = 0;

  for (let f = 0; f < FORECAST_COUNT; f++) {
    const daysAgo = Math.floor(rng() * 30);
    const hoursOffset = Math.floor(rng() * 24);
    const createdAt = new Date(now - daysAgo * 86400000 - hoursOffset * 3600000);
    const sealedAt = new Date(createdAt.getTime() + (60 + Math.floor(rng() * 240)) * 1000);

    const audioMinutes = 5 + Math.floor(rng() * 90);
    const audioHoursTotal = Number((audioMinutes / 60).toFixed(3));
    const chunkCount = Math.ceil((audioMinutes * 60) / 30);
    const cyclesPerChunk = 12 + Math.floor(rng() * 8);
    const totalCycles = chunkCount * cyclesPerChunk;
    const costPerKc = 2.9;
    const budgetCents = Math.max(50, Math.round((totalCycles / 1000) * costPerKc * 100));

    const clientId = pickWeighted(rng, clientIds);
    const dist = distributors[Math.floor(rng() * distributors.length)];

    const forecast = await prisma.forecast.create({
      data: {
        clientId,
        inputManifestUrl: `https://strata.local/inputs/seed-${f}.json`,
        audioHoursTotal,
        languageScope: "English",
        outputFormats: JSON.stringify(["srt"]),
        status: "sealed",
        budgetCents,
        budgetCyclesUsed: totalCycles,
        workFunctionVersion: "strata-whisper-v1",
        createdAt,
        updatedAt: sealedAt,
        frontOpenedAt: createdAt,
        sealedAt,
      },
    });

    for (let c = 0; c < chunkCount; c++) {
      const cyclesConsumed = cyclesPerChunk + Math.floor(rng() * 4) - 2;
      const region = REGIONS[Math.floor(rng() * REGIONS.length)];
      const outputHash = randomHex(rng, 6);
      const nodePubkey = `node_${randomHex(rng, 4)}`;

      const slice = await prisma.slice.create({
        data: {
          forecastId: forecast.id,
          chunkIndex: c,
          timestampStart: c * 30,
          timestampEnd: c * 30 + 30,
          inputUrl: `https://strata.local/audio/seed-${f}.wav#t=${c * 30},${c * 30 + 30}`,
          attemptNumber: 1,
          status: "completed",
          nodePubkey,
          outputHash,
          outputText: "",
          cyclesConsumed,
          issuedAt: createdAt,
          completedAt: new Date(createdAt.getTime() + (15 + c * 8) * 1000),
        },
      });
      totalSlices++;

      await prisma.attestation.create({
        data: {
          sliceId: slice.id,
          nodePubkey,
          nodeRegionGlyph: region,
          outputHash,
          schedulerSig: "seed-valid",
        },
      });
      totalAttestations++;
    }

    await prisma.catchment.create({
      data: {
        forecastId: forecast.id,
        bundleUrl: `https://strata.local/catchments/${forecast.id}.zip`,
        audioHoursSealed: audioHoursTotal,
        slicesCompleted: chunkCount,
        slicesTotal: chunkCount,
        sealedAt,
      },
    });

    const distributorCents = Math.round(budgetCents * 0.8);
    const strataCents = budgetCents - distributorCents;
    await prisma.settlement.create({
      data: {
        forecastId: forecast.id,
        distributorId: dist.id,
        slotId: dist.slotId,
        grossCents: budgetCents,
        distributorCents,
        strataCents,
        createdAt: sealedAt,
      },
    });
    totalSettlements++;
  }

  return { totalSlices, totalAttestations, totalSettlements };
}

async function main() {
  console.log("[seed] clearing existing rows...");
  await clearAll();

  console.log(`[seed] inserting ${DISTRIBUTORS.length} distributors...`);
  const distributors = await seedDistributors();

  console.log("[seed] inserting 12 clients...");
  const clientIds = await seedClients();

  console.log("[seed] inserting 150 historical forecasts...");
  const totals = await seedHistoricalForecasts(distributors, clientIds);

  console.log(
    `[seed] done. distributors=${distributors.length} clients=${clientIds.length} forecasts=150 slices=${totals.totalSlices} attestations=${totals.totalAttestations} settlements=${totals.totalSettlements}`,
  );
  console.log(`[seed] demo distributor: ${distributors[0].display} (slot id: ${distributors[0].slotId})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
