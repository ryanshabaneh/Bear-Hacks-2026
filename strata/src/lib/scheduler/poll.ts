import { prisma } from "@/lib/db/prisma";
import { dispatchForecast } from "@/lib/forecast/dispatch";

const TICK_MS = 1000;
const MAX_CONCURRENT = 1;
const STUCK_AFTER_MS = 240000;
const SWEEP_EVERY_TICKS = 10;

type SchedulerState = {
  running: boolean;
  inflight: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
  tickCount: number;
};

const globalForScheduler = globalThis as unknown as {
  __strataScheduler?: SchedulerState;
};

function state(): SchedulerState {
  if (!globalForScheduler.__strataScheduler) {
    globalForScheduler.__strataScheduler = {
      running: false,
      inflight: new Set(),
      timer: null,
      tickCount: 0,
    };
  }
  return globalForScheduler.__strataScheduler;
}

export function startScheduler() {
  const s = state();
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  if (s.running) {
    scheduleNextTick();
    return;
  }
  s.running = true;
  console.log(
    `[scheduler] boot  tick=${TICK_MS}ms  maxConcurrent=${MAX_CONCURRENT}  source=Forecast.castedAt`,
  );
  scheduleNextTick();
}

function scheduleNextTick() {
  const s = state();
  if (!s.running) return;
  s.timer = setTimeout(() => {
    void tick().finally(scheduleNextTick);
  }, TICK_MS);
}

async function tick() {
  const s = state();
  s.tickCount += 1;
  if (s.tickCount % SWEEP_EVERY_TICKS === 0) {
    await sweepStuck();
  }
  if (s.inflight.size >= MAX_CONCURRENT) return;
  const slot = MAX_CONCURRENT - s.inflight.size;

  const ready = await prisma.forecast.findMany({
    where: {
      status: "queued",
      castedAt: { not: null },
      scheduledAt: null,
    },
    orderBy: { castedAt: "asc" },
    take: slot,
    select: { id: true, castedAt: true, audioHoursTotal: true },
  });

  for (const forecast of ready) {
    const claimed = await prisma.forecast.updateMany({
      where: { id: forecast.id, status: "queued", scheduledAt: null },
      data: { scheduledAt: new Date() },
    });
    if (claimed.count === 0) continue;

    s.inflight.add(forecast.id);
    const tag = forecast.id.slice(-4);
    const waited = forecast.castedAt
      ? `${Math.round((Date.now() - forecast.castedAt.getTime()) / 100) / 10}s`
      : "?";
    console.log(
      `[scheduler] pick   forecast=${forecast.id.slice(-6)} tag=${tag} waited=${waited} hours=${forecast.audioHoursTotal.toFixed(2)}`,
    );

    void runOne(forecast.id).finally(() => {
      s.inflight.delete(forecast.id);
    });
  }
}

async function runOne(forecastId: string) {
  try {
    await dispatchForecast({ forecastId });
  } catch (error) {
    console.error(`[scheduler] dispatch threw for ${forecastId}:`, error);
    await prisma.forecast
      .update({ where: { id: forecastId }, data: { status: "failed" } })
      .catch(() => {});
  }
}

async function sweepStuck() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await prisma.forecast.findMany({
    where: {
      status: "active",
      sealedAt: null,
      OR: [{ frontOpenedAt: { lt: cutoff } }, { frontOpenedAt: null }],
    },
    select: { id: true, frontOpenedAt: true },
  });
  if (stuck.length === 0) return;
  for (const forecast of stuck) {
    const ageS = forecast.frontOpenedAt
      ? Math.round((Date.now() - forecast.frontOpenedAt.getTime()) / 1000)
      : 0;
    console.log(
      `[scheduler] sweep  forecast=${forecast.id.slice(-6)} age=${ageS}s -> failed`,
    );
    await prisma.forecast
      .update({ where: { id: forecast.id }, data: { status: "failed" } })
      .catch(() => {});
    await prisma.slice
      .updateMany({
        where: { forecastId: forecast.id, status: "issued" },
        data: { status: "failed" },
      })
      .catch(() => {});
  }
}
