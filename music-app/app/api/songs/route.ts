import { NextResponse } from "next/server";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SONGS_DIR = join(process.cwd(), "public", "songs");

export async function GET() {
  try {
    const entries = await readdir(SONGS_DIR);
    const songs = entries
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort()
      .map((f) => ({ name: f.replace(/\.mp3$/i, ""), src: `/songs/${f}` }));
    return NextResponse.json({ songs });
  } catch {
    return NextResponse.json({ songs: [] });
  }
}

function safeName(name: string): string {
  const base = name.replace(/[\\/]/g, "_").replace(/[^A-Za-z0-9._\- ]/g, "_");
  return base.slice(-200);
}

export async function POST(req: Request) {
  await mkdir(SONGS_DIR, { recursive: true });
  const formData = await req.formData();
  const files = formData.getAll("files");
  const saved: string[] = [];
  for (const entry of files) {
    if (!(entry instanceof File)) continue;
    if (!entry.name.toLowerCase().endsWith(".mp3")) continue;
    const buf = Buffer.from(await entry.arrayBuffer());
    const name = safeName(entry.name);
    await writeFile(join(SONGS_DIR, name), buf);
    saved.push(name);
  }
  return NextResponse.json({ saved });
}
