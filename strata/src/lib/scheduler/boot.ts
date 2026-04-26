import { startScheduler } from "@/lib/scheduler/poll";

const handler = (reason: unknown) => {
  const message =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  console.error(`[strata] unhandledRejection swallowed: ${message}`);
};

export async function bootStrata() {
  const existing = process.listeners("unhandledRejection");
  const ours = existing.find((fn) => fn === handler);
  if (!ours) {
    process.on("unhandledRejection", handler);
    console.log(
      `[strata] boot guard attached  pid=${process.pid}  node=${process.version}  listeners=${process.listeners("unhandledRejection").length}`,
    );
  } else {
    console.log(
      `[strata] boot guard already attached  pid=${process.pid}  listeners=${existing.length}`,
    );
  }
  startScheduler();
}
