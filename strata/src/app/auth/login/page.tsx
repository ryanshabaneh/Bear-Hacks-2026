import { CirrusStage } from "@/components/cirrus/stage/CirrusStage";
import { Window } from "@/components/ui/Window";
import { LoginForm } from "./LoginForm";

type Search = { screen_hint?: string; account_type?: string; from?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const isSignup = params.screen_hint === "signup";
  const presetRole =
    params.account_type === "distributor" || params.account_type === "client"
      ? params.account_type
      : "client";

  return (
    <CirrusStage>
      <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          <Window
            title={isSignup ? "open-account.exe" : "sign-in.exe"}
            titleBarTone={isSignup ? "pink" : "lavender"}
            sparkles={true}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="cirrus-text-unit">
                  Strata · {isSignup ? "create account" : "sign in"}
                </span>
                <h1 className="cirrus-text-h1">
                  {isSignup ? "open an account." : "welcome back."}
                </h1>
                <p
                  className="y2k-mono"
                  style={{ fontSize: 12, opacity: 0.75, color: "var(--y2k-border)" }}
                >
                  your stratosphere orchestrator awaits.
                </p>
              </div>
              <LoginForm presetRole={presetRole} isSignup={isSignup} />
            </div>
          </Window>
        </div>
      </main>
    </CirrusStage>
  );
}
