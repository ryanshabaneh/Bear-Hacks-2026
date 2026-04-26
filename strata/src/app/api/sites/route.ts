import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

const CreateSiteBody = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'must be a bare domain like myblog.com'),
});

function newToken() {
  return `tok_${randomBytes(16).toString('hex')}`;
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    requireRole(session, 'distributor');

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSiteBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const distributor = await prisma.distributor.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: 'distributor_profile_missing' }, { status: 404 });
    }

    const site = await prisma.site.create({
      data: {
        distributorId: distributor.id,
        domain: parsed.data.domain.toLowerCase(),
        verificationToken: newToken(),
      },
      select: {
        id: true,
        domain: true,
        verificationToken: true,
        verified: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        site,
        wellKnown: {
          url: `https://${site.domain}/.well-known/strata.json`,
          body: { verification_token: site.verificationToken },
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('POST /api/sites failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    requireRole(session, 'distributor');

    const distributor = await prisma.distributor.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!distributor) return NextResponse.json({ sites: [] });

    const sites = await prisma.site.findMany({
      where: { distributorId: distributor.id },
      orderBy: { createdAt: 'desc' },
      include: { slots: { select: { id: true, name: true, active: true } } },
    });
    return NextResponse.json({ sites });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('GET /api/sites failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
