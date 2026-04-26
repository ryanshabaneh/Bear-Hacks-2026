import { type NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Readable } from "node:stream";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function nodeToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  let closed = false;
  const safeClose = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      return;
    }
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        if (closed) return;
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          closed = true;
          nodeStream.destroy();
        }
      });
      nodeStream.once("end", () => safeClose(controller));
      nodeStream.once("close", () => safeClose(controller));
      nodeStream.once("error", (error: Error) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(error);
        } catch {
          return;
        }
      });
    },
    cancel() {
      closed = true;
      nodeStream.destroy();
    },
  });
}

const mimeByExt: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

function mimeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return mimeByExt[ext] ?? "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ forecastId: string }> },
) {
  const { forecastId } = await params;
  const session = await getSession();
  if (!session || session.user.role !== "client" || !session.user.clientId) {
    return new Response("unauthorized", { status: 401 });
  }

  const forecast = await prisma.forecast.findUnique({
    where: { id: forecastId },
    select: { clientId: true, inputManifestUrl: true },
  });
  if (!forecast) return new Response("not_found", { status: 404 });
  if (forecast.clientId !== session.user.clientId) {
    return new Response("forbidden", { status: 403 });
  }

  const fileScheme = "file://";
  if (!forecast.inputManifestUrl.startsWith(fileScheme)) {
    return new Response("unsupported_source", { status: 400 });
  }
  const rawPath = forecast.inputManifestUrl.slice(fileScheme.length);
  const filePath = resolve(rawPath);
  const allowedPrefix = "/tmp/strata-uploads/";
  if (!filePath.startsWith(allowedPrefix)) {
    return new Response("forbidden_path", { status: 403 });
  }

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch {
    return new Response("file_missing", { status: 404 });
  }

  const fileSize = stat.size;
  const contentType = mimeFor(filePath);
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      return new Response("invalid_range", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const startStr = match[1];
    const endStr = match[2];
    const start = startStr === "" ? Math.max(0, fileSize - Number(endStr)) : Number(startStr);
    const end = startStr === "" ? fileSize - 1 : endStr === "" ? fileSize - 1 : Number(endStr);
    if (start >= fileSize || end >= fileSize || start > end) {
      return new Response("range_not_satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const stream = createReadStream(filePath, { start, end });
    const webStream = nodeToWebStream(stream);
    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const stream = createReadStream(filePath);
  const webStream = nodeToWebStream(stream);
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=300",
    },
  });
}
