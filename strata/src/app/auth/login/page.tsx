import { CirrusStage } from "@/components/cirrus/stage/CirrusStage";
import { UnitLabel } from "@/components/cirrus/primitives/UnitLabel";
import { LoginForm } from "./LoginForm";

type Search = { screen_hint?: string; account_type?: string; from?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  // In AUTH_MODE=auth0, proxy.ts intercepts /auth/* before this page renders.
  // In AUTH_MODE=stub, the form below handles login/signup directly.
  const params = await searchParams;
  const isSignup = params.screen_hint === "signup";
  const presetRole =
    params.account_type === "distributor" || params.account_type === "client"
      ? params.account_type
      : "client";

  return (
    <CirrusStage>
      <main className="min-h-[80dvh] flex items-center justify-center px-6 py-12">
        <div className="cirrus-card w-full max-w-[420px] p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <UnitLabel>Strata · {isSignup ? "create account" : "sign in"}</UnitLabel>
            <h1 className="cirrus-text-h1">
              {isSignup ? "Open an account." : "Welcome back."}
            </h1>
            <p className="cirrus-text-body-sm opacity-70">
              Stub mode is active. Switch to real Auth0 by setting
              {" "}
              <code className="cirrus-text-mono-id">AUTH_MODE=auth0</code>.
            </p>
          </div>
          <LoginForm presetRole={presetRole} isSignup={isSignup} />
        </div>
      </main>
    </CirrusStage>
  );
}
