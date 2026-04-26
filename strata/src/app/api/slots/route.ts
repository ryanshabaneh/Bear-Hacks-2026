import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

const CreateSlotBody = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    requireRole(session, 'distributor');

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSlotBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const site = await prisma.site.findUnique({
      where: { id: parsed.data.siteId },
      include: { distributor: { select: { id: true, userId: true } } },
    });
    if (!site) return NextResponse.json({ error: 'site_not_found' }, { status: 404 });
    if (site.distributor.userId !== session.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (!site.verified) {
      return NextResponse.json({ error: 'site_not_verified' }, { status: 409 });
    }

    const slot = await prisma.computeSlot.create({
      data: {
        siteId: site.id,
        distributorId: site.distributor.id,
        name: parsed.data.name,
      },
      select: { id: true, name: true, active: true, siteId: true, createdAt: true },
    });

    return NextResponse.json({ slot, snippet: snippetFor(slot.id) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error('POST /api/slots failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

function snippetFor(slotId: string) {
  return `<script src="https://embed.strata.dev/strata.js" data-slot="${slotId}" async></script>`;
}
