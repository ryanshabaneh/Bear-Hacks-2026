import { NextResponse, type NextRequest } from "next/server";
import { getAuth0Client } from "@/lib/auth0";

export async function proxy(request: NextRequest) {
  if ((process.env.AUTH_MODE ?? "stub") !== "auth0") {
    return NextResponse.next();
  }
  return getAuth0Client().middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|embed/|demo-site/|api/embed/|api/scheduler/).*)",
  ],
};
