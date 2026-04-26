import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/cirrus/shell/AppShell";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { ComposerForm } from "./ComposerForm";

export default async function NewForecastPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?account_type=client");
  if (session.user.role !== "client") redirect("/distributor");

  return (
    <AppShell role="client" email={session.user.email}>
      <div className="flex flex-col gap-6 pt-2 max-w-[640px]">
        <header className="flex flex-col gap-2">
          <UnitLabel>Forecast composer</UnitLabel>
          <h1 className="cirrus-text-h1">Release a Forecast.</h1>
          <p className="cirrus-text-body-sm opacity-70">
            We slice your audio into Rain and dispatch it on the next Front. Pick a fixture
            below — production upload lands in a later slice.
          </p>
        </header>

        <ComposerForm />
      </div>
    </AppShell>
  );
}
