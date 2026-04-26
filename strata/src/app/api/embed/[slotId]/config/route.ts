// Per plan/04-embed.md §Compute Group secret bake-in.
// Returns the runtime config for a single slot — paymentAddress + Compute Group
// credentials. CORS-locked to the embed runtime origin so the host site cannot
// read the joinSecret directly.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const RUNTIME_ORIGIN =
  process.env.STRATA_EMBED_RUNTIME_ORIGIN || 'https://embed.strata.dev';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': RUNTIME_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  } as const;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  _req: Request,
  { params }: { params: { slotId: string } },
) {
  try {
    const slot = await prisma.computeSlot.findUnique({
      where: { id: params.slotId },
      include: {
        distributor: { select: { dcpPaymentAddress: true } },
        site: { select: { verified: true } },
      },
    });

    if (!slot || !slot.active || !slot.site.verified) {
      return NextResponse.json({ active: false }, { headers: corsHeaders() });
    }

    return NextResponse.json(
      {
        active: true,
        paymentAddress: slot.distributor.dcpPaymentAddress,
        joinKey: process.env.STRATA_GROUP_KEY ?? '',
        joinSecret: process.env.STRATA_GROUP_SECRET ?? '',
      },
      { headers: corsHeaders() },
    );
  } catch (e) {
    console.error('GET /api/embed/[slotId]/config failed', e);
    return NextResponse.json(
      { active: false, error: 'server_error' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
