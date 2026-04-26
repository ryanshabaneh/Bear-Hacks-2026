export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootStrata } = await import("@/lib/scheduler/boot");
  await bootStrata();
}
