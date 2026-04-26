import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "info" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  type QueryEvent = { duration: number; query: string; params: string };
  const wired = globalForPrisma as unknown as { prismaLogWired?: boolean };
  if (!wired.prismaLogWired) {
    wired.prismaLogWired = true;
    const showSelects = process.env.DEBUG_DB_SELECTS === "1";
    (prisma as unknown as { $on: (e: "query", cb: (event: QueryEvent) => void) => void }).$on(
      "query",
      (event) => {
        const trimmed = event.query.trimStart();
        const verbMatch = trimmed.match(/^(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)/i);
        const verb = verbMatch ? verbMatch[1].toUpperCase() : "SQL";
        const isSelect = verb === "SELECT";
        if (isSelect && !showSelects && event.duration < 2) return;
        const tableMatch = trimmed.match(
          /\b(?:FROM|INTO|UPDATE|JOIN)\s+`?(?:main`?\.`?)?(\w+)/i,
        );
        const table = tableMatch ? tableMatch[1] : "?";
        const ms = `${event.duration}ms`.padStart(5);
        const tag = `${verb} ${table}`.padEnd(18);
        if (isSelect) {
          console.log(`[db ${ms}] ${tag}`);
          return;
        }
        const params =
          event.params.length > 100 ? `${event.params.slice(0, 100)}...` : event.params;
        console.log(`[db ${ms}] ${tag} ${params}`);
      },
    );
  }
}
