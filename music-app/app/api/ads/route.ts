import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const ADS_DIR = join(process.cwd(), "public", "ads");
const VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i;

export async function GET() {
  try {
    const entries = await readdir(ADS_DIR);
    const ads = entries
      .filter((f) => VIDEO_RE.test(f))
      .sort()
      .map((f) => `/ads/${f}`);
    return NextResponse.json({ ads });
  } catch {
    return NextResponse.json({ ads: [] });
  }
}
