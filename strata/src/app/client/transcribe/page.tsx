import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { TranscribeFlow } from "./TranscribeFlow";

export default async function TranscribePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client") redirect("/distributor");

  const raw = (process.env.DCP_MODE ?? "live").toLowerCase();
  const dcpMode =
    raw === "cached" ? "cached" : raw === "hardcode" ? "hardcode" : "live";
  const fixtureName = process.env.DCP_CACHED_FIXTURE ?? "slopify-demo";

  return (
    <AppShell role="client" email={session.user.email}>
      <TranscribeFlow dcpMode={dcpMode} fixtureName={fixtureName} />
    </AppShell>
  );
}
