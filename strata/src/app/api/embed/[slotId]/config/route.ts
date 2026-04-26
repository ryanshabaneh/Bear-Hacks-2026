import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slotId: string }> },
) {
  const { slotId } = await params;
  const slot = await prisma.computeSlot.findUnique({
    where: { id: slotId },
    include: { distributor: true },
  });

  if (!slot || !slot.active) {
    return NextResponse.json({ active: false }, { headers: corsHeaders() });
  }

  return NextResponse.json(
    {
      active: true,
      paymentAddress: slot.distributor.dcpPaymentAddress,
    },
    { headers: corsHeaders() },
  );
}
