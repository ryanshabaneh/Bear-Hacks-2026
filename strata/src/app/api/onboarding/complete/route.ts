import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (session.user.role === "distributor" && session.user.distributorId) {
    await prisma.distributor.update({
      where: { id: session.user.distributorId },
      data: { onboardedAt: now },
    });
  } else if (session.user.role === "client" && session.user.clientId) {
    await prisma.client.update({
      where: { id: session.user.clientId },
      data: { onboardedAt: now },
    });
  } else {
    return NextResponse.json({ error: "no profile" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, onboardedAt: now.toISOString() });
}
