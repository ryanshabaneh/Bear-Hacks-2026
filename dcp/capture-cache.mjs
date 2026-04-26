#!/usr/bin/env node
import { decodeAudio, chunkAudio, transcribeChunks } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const MP3 = process.argv[2];
const NAME = process.argv[3];
if (!MP3 || !NAME) {
  console.error('Usage: node capture-cache.mjs <path/to/audio.mp3> <fixture-name>');
  console.error('Example: node capture-cache.mjs ./samples/slopify-ep01.mp3 slopify-ep01');
  process.exit(1);
}

const outPath = path.join(import.meta.dirname, 'cache', `${NAME}.json`);

const t0 = Date.now();
console.log(`[capture] decoding ${MP3}...`);
const samples = await decodeAudio(MP3);
const audioSec = samples.length / 16000;
console.log(`[capture] ${audioSec.toFixed(1)}s audio, chunking...`);

const chunks = chunkAudio(samples);
console.log(`[capture] ${chunks.length} chunks. Submitting to DCP...`);

const { texts, dispatchedAt, events } = await transcribeChunks(chunks, {
  returnTimings: true,
  onProgress: (d, t) => process.stderr.write(`\r[capture] ${d}/${t}`),
});
process.stderr.write('\n');

const t1 = Date.now();
const wallSec = (t1 - t0) / 1000;

const fixture = {
  name: NAME,
  capturedAt: new Date().toISOString(),
  audioSec: Number(audioSec.toFixed(3)),
  wallSec: Number(wallSec.toFixed(3)),
  chunkCount: chunks.length,
  chunkSeconds: 30,
  dispatchedAt,
  texts,
  events: events.map((e) => ({
    idx: e.idx,
    receivedAt: e.receivedAt,
    relativeReceivedMs: e.receivedAt - dispatchedAt,
    stamps: e.stamps,
    cold: e.cold,
    gpuProbe: e.gpuProbe,
  })),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2));
console.log(`[capture] saved → ${outPath}`);
console.log(`[capture] ${chunks.length} chunks, ${audioSec.toFixed(1)}s audio, ${wallSec.toFixed(1)}s wall, ${(audioSec / wallSec).toFixed(2)}x realtime`);
