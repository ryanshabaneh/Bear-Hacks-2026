// Stub-mode auth (BE2 fleshes out the auth0 path — see plan/06-auth0.md).
// BE1 SSE + onboarding routes depend on getSession() / requireRole().

import { cookies } from 'next/headers';

export type Session = {
  userId: string;
  email: string;
  role: 'distributor' | 'client' | 'admin';
};

export async function getSession(): Promise<Session | null> {
  if (process.env.AUTH_MODE === 'stub' || !process.env.AUTH_MODE) {
    const c = cookies().get('strata-stub-session');
    if (!c) return null;
    try {
      return JSON.parse(c.value) as Session;
    } catch {
      return null;
    }
  }
  // auth0 path: BE2 wires @auth0/nextjs-auth0 here per plan/06-auth0.md.
  return null;
}

export function requireRole(
  session: Session | null,
  role: Session['role'],
): asserts session is Session {
  if (!session) throw new Response('Unauthorized', { status: 401 });
  if (session.role !== role) throw new Response('Forbidden', { status: 403 });
}
