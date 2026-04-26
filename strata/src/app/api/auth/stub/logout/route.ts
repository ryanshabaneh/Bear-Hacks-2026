// Stub-mode logout. Clears the stub session cookie.
// In auth0 mode, the SDK has its own /auth/logout — this route is a no-op then.

import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('strata-stub-session');
  return res;
}
