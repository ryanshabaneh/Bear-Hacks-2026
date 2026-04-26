import type { ReactNode } from "react";
import { CirrusStage } from "@/components/cirrus/stage/CirrusStage";
import { Topbar } from "@/components/cirrus/shell/Topbar";
import type { AccountRole } from "@/lib/auth/session";

export function AppShell({
  role,
  email,
  children,
}: {
  role: AccountRole;
  email: string;
  children: ReactNode;
}) {
  return (
    <CirrusStage>
      <Topbar role={role} email={email} />
      <main className="px-6 sm:px-8 lg:px-12 pb-16 max-w-[1280px] mx-auto">
        {children}
      </main>
    </CirrusStage>
  );
}
