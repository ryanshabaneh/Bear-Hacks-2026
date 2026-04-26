#!/usr/bin/env node
import { decodeAudio, chunkAudio, transcribeChunks } from './lib.mjs';
import fs from 'node:fs';

const MP3 = process.argv[2];
if (!MP3) {
  console.error('Usage: node run-podcast.mjs <path/to/audio.mp3>');
  process.exit(1);
}

const t0 = Date.now();
console.log('[1/3] decoding mp3...');
const samples = await decodeAudio(MP3);
console.log(`      ${(samples.length / 16000).toFixed(1)}s of audio`);

console.log('[2/3] chunking...');
const chunks = chunkAudio(samples);
console.log(`      ${chunks.length} chunks`);

console.log('[3/3] transcribing on DCP (timed)...');
const { texts, dispatchedAt, events } = await transcribeChunks(chunks, {
  returnTimings: true,
  onProgress: (d, t) => process.stderr.write(`\r      ${d}/${t}`),
});
process.stderr.write('\n');

const t1 = Date.now();
const wallSec = ((t1 - t0) / 1000).toFixed(1);
const audioSec = (samples.length / 16000).toFixed(1);
const ratio = (audioSec / wallSec).toFixed(2);

console.log(`\nWall: ${wallSec}s | Audio: ${audioSec}s | Realtime: ${ratio}×`);

// GPU probe (worker-side) — same on every event since cached in globalThis
const probe = events[0]?.gpuProbe ?? {};
console.log('\n=== GPU PROBE (worker-side) ===');
console.log(`  navigator.gpu present : ${probe.hasNavigatorGpu ?? '?'}`);
console.log(`  GPU adapter available : ${probe.adapterOk ?? '?'}`);
console.log(`  vendor                : ${probe.vendor ?? '(none)'}`);
if (probe.error) console.log(`  error                 : ${probe.error}`);

// Per-chunk per-segment timing
console.log('\n=== PER-CHUNK SEGMENT TIMING (ms, relative to dispatch) ===');
console.log('idx | cold | wStart | ortRdy | encRdy | decRdy | dpRdy | encRun | done | total | encoder | decode-loop');
events.sort((a, b) => a.idx - b.idx);
for (const e of events) {
  const s = e.stamps;
  const c = e.cold;
  const coldFlag = c.encoder || c.decoder || c.decoderPast ? '*' : ' ';
  const r = (k) => String(s[k] - dispatchedAt).padStart(6);
  const dur = (a, b) => String(s[b] - s[a]).padStart(6);
  const total = String(s.workerEnd - s.workerStart).padStart(5);
  console.log(
    `${String(e.idx).padStart(3)} | ${coldFlag}    | ` +
    `${r('workerStart')} | ${r('ortReady')} | ${r('encReady')} | ${r('decReady')} | ${r('decPastReady')} | ${r('encoderRunDone')} | ${r('workerEnd')} | ${total} | ` +
    `${dur('decPastReady', 'encoderRunDone')} | ${dur('encoderRunDone', 'workerEnd')}`,
  );
}

const transcript = texts.join(' ');
fs.writeFileSync('./transcript.txt', transcript);
console.log(`\nTranscript: ${transcript.length} chars → transcript.txt`);
