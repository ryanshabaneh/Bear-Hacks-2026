import { EventEmitter } from "node:events";

type Bus = EventEmitter & { __strata?: true };

const globalForBus = globalThis as unknown as { __strataBus?: Bus };

function makeBus(): Bus {
  const bus = new EventEmitter() as Bus;
  bus.setMaxListeners(0);
  bus.__strata = true;
  return bus;
}

export const bus: Bus = globalForBus.__strataBus ?? makeBus();
if (process.env.NODE_ENV !== "production") globalForBus.__strataBus = bus;

export type ForecastEvent =
  | { type: "front:opening"; forecastId: string; total: number; ts: number }
  | { type: "slice:arrived"; forecastId: string; chunkIndex: number; timestampStart: number; timestampEnd: number; outputHash: string; nodeRegion: string; cyclesConsumed: number; text: string; ts: number }
  | { type: "catchment:sealed"; forecastId: string; bundleUrl: string; slicesCompleted: number; slicesTotal: number; audioHoursSealed: number; ts: number }
  | { type: "forecast:failed"; forecastId: string; reason: string; ts: number };

export type DistributorEvent =
  | { type: "slice:landed"; distributorId: string; outcome: "landed" | "in-flight" | "settled"; region?: string; ts: number };

export function publishForecast(forecastId: string, event: ForecastEvent) {
  bus.emit(`forecast:${forecastId}`, event);
}

export function publishDistributor(distributorId: string, event: DistributorEvent) {
  bus.emit(`distributor:${distributorId}`, event);
}

export function subscribeForecast(forecastId: string, handler: (event: ForecastEvent) => void) {
  const channel = `forecast:${forecastId}`;
  bus.on(channel, handler);
  return () => {
    bus.off(channel, handler);
  };
}

export function subscribeDistributor(distributorId: string, handler: (event: DistributorEvent) => void) {
  const channel = `distributor:${distributorId}`;
  bus.on(channel, handler);
  return () => {
    bus.off(channel, handler);
  };
}
