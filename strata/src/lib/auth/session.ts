import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { getAuth0Client } from "@/lib/auth0";

export type AccountRole = "distributor" | "client";

export type Session = {
  user: {
    id: string;
    email: string;
    role: AccountRole;
    distributorId?: string;
    clientId?: string;
  };
} | null;

const STUB_COOKIE = "strata_stub_session";

function readMode(): "stub" | "auth0" {
  return (process.env.AUTH_MODE ?? "stub") === "auth0" ? "auth0" : "stub";
}

export async function getSession(): Promise<Session> {
  const mode = readMode();
  if (mode === "stub") return getStubSession();
  return getAuth0Session();
}

async function getStubSession(): Promise<Session> {
  const jar = await cookies();
  const raw = jar.get(STUB_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId: string };
    if (!parsed.userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      include: { distributor: true, client: true },
    });
    if (!user) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role as AccountRole,
        distributorId: user.distributor?.id,
        clientId: user.client?.id,
      },
    };
  } catch {
    return null;
  }
}

async function getAuth0Session(): Promise<Session> {
  let auth0Session;
  try {
    auth0Session = await getAuth0Client().getSession();
  } catch (err) {
    console.warn("[auth] auth0 session lookup failed, falling back to stub:", err);
    return getStubSession();
  }
  if (!auth0Session?.user) return null;

  const auth0User = auth0Session.user;
  const email =
    typeof auth0User.email === "string" ? auth0User.email : undefined;
  if (!email) return null;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      role: "client",
      auth0Sub: typeof auth0User.sub === "string" ? auth0User.sub : email,
    },
    include: { distributor: true, client: true },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role as AccountRole,
      distributorId: user.distributor?.id,
      clientId: user.client?.id,
    },
  };
}

export async function requireSession(): Promise<NonNullable<Session>> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export const STUB_SESSION_COOKIE = STUB_COOKIE;
