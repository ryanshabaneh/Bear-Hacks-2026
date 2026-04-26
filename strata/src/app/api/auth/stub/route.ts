// Stub-mode login endpoint. Disabled when AUTH_MODE=auth0.
// POST { role, email } → sets `strata-stub-session` cookie, returns 200.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Session } from '@/lib/auth';

const ALLOWED_ROLES = new Set(['distributor', 'client', 'admin']);

export async function POST(req: NextRequest) {
  if (process.env.AUTH_MODE === 'auth0') {
    return new Response('Disabled (AUTH_MODE=auth0)', { status: 404 });
  }

  let body: { role?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { role, email } = body;
  if (!role || !email || !ALLOWED_ROLES.has(role)) {
    return new Response('Bad role or email', { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role },
  });

  // For Distributor/Client, ensure the role-specific row exists so dashboards
  // can read displayName etc. without separate provisioning.
  if (role === 'distributor') {
    await prisma.distributor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: email.split('@')[0],
        dcpPaymentAddress: '0xDEMO_PAYMENT_ADDRESS_PLACEHOLDER',
      },
    });
  } else if (role === 'client') {
    await prisma.client.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        displayName: email.split('@')[0],
      },
    });
  }

  const session: Session = {
    userId: user.id,
    email,
    role: role as Session['role'],
  };

  const res = NextResponse.json({ ok: true });
  res.cookies.set('strata-stub-session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  });
  return res;
}
