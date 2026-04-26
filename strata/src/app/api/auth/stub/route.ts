import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { STUB_SESSION_COOKIE } from "@/lib/auth/session";

const StubLoginBody = z.object({
  email: z.string().email(),
  role: z.enum(["distributor", "client"]),
  displayName: z.string().min(1).max(80),
});

export async function POST(req: NextRequest) {
  if ((process.env.AUTH_MODE ?? "stub") !== "stub") {
    return NextResponse.json(
      { error: "stub auth disabled" },
      { status: 404 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = StubLoginBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, role, displayName } = parsed.data;

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role },
  });

  if (role === "distributor") {
    await prisma.distributor.upsert({
      where: { userId: user.id },
      update: { displayName },
      create: {
        userId: user.id,
        displayName,
        dcpPaymentAddress: `0xstub_${user.id.slice(0, 16)}`,
      },
    });
  } else {
    await prisma.client.upsert({
      where: { userId: user.id },
      update: { displayName },
      create: {
        userId: user.id,
        displayName,
      },
    });
  }

  const res = NextResponse.json({ ok: true, userId: user.id, role });
  res.cookies.set(STUB_SESSION_COOKIE, JSON.stringify({ userId: user.id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(STUB_SESSION_COOKIE);
  return res;
}
