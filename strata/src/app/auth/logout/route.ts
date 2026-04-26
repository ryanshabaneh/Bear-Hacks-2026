import { NextResponse } from "next/server";
import { STUB_SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  // In AUTH_MODE=auth0, proxy.ts intercepts /auth/* before this handler.
  // In AUTH_MODE=stub, this clears the stub cookie and returns home.
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const res = NextResponse.redirect(new URL("/", base));
  res.cookies.delete(STUB_SESSION_COOKIE);
  return res;
}
