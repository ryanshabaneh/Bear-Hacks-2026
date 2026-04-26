import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function loadOwnedSite(id: string, userId: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: { distributor: { select: { id: true, userId: true } } },
  });
  if (!site) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) };
  if (site.distributor.userId !== userId) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { site };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    requireRole(session, 'distributor');

    const { site, error } = await loadOwnedSite(params.id, session.userId);
    if (error) return error;

    return NextResponse.json({
      id: site.id,
      domain: site.domain,
      verified: site.verified,
      verificationToken: site.verificationToken,
      wellKnown: {
        url: `https://${site.domain}/.well-known/strata.json`,
        body: { verification_token: site.verificationToken },
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('GET /api/sites/[id]/verify failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    requireRole(session, 'distributor');

    const { site, error } = await loadOwnedSite(params.id, session.userId);
    if (error) return error;

    if (site.verified) {
      return NextResponse.json({ verified: true, alreadyVerified: true });
    }

    const url = `https://${site.domain}/.well-known/strata.json`;
    let fetched: { verification_token?: unknown } = {};
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return NextResponse.json(
          { verified: false, reason: 'well_known_status', status: res.status },
          { status: 200 },
        );
      }
      fetched = (await res.json().catch(() => ({}))) as typeof fetched;
    } catch (fetchErr) {
      return NextResponse.json(
        { verified: false, reason: 'well_known_unreachable', detail: String(fetchErr) },
        { status: 200 },
      );
    }

    if (fetched.verification_token !== site.verificationToken) {
      return NextResponse.json(
        { verified: false, reason: 'token_mismatch' },
        { status: 200 },
      );
    }

    await prisma.site.update({
      where: { id: site.id },
      data: { verified: true },
    });

    return NextResponse.json({ verified: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('POST /api/sites/[id]/verify failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
