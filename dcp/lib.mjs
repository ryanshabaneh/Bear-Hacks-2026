// Whisper-on-DCP library.
//
// Public API (4 functions):
//   decodeAudio(input)        -> Float32Array @ 16kHz mono
//     input: file path (string) or Buffer of audio bytes (mp3/wav/etc)
//   chunkAudio(samples, sec)  -> Float32Array[]
//   transcribeChunks(chunks)  -> string[]    (one transcript per chunk, distributed via DCP)
//   transcribe(input)         -> string      (convenience: decode + chunk + transcribe + join)

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { AutoProcessor, AutoTokenizer } from '@xenova/transformers';

const require = createRequire(import.meta.url);

const SR = 16000;
const DEFAULT_CHUNK_SEC = 30;
const SCHEDULER = 'https://scheduler.distributed.computer';

// ---------------------------------------------------------------------
// Layer 1: format → samples (ffmpeg shell-out)
// ---------------------------------------------------------------------
export function decodeAudio(input) {
  return new Promise((resolve, reject) => {
    const fromStdin = Buffer.isBuffer(input);
    const args = [
      '-loglevel', 'error',
      '-i', fromStdin ? 'pipe:0' : input,
      '-ac', '1',
      '-ar', String(SR),
      '-f', 'f32le',
      'pipe:1',
    ];
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const bufs = [];
    ff.stdout.on('data', (b) => bufs.push(b));
    ff.stderr.on('data', (b) => process.stderr.write(b));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
      const merged = Buffer.concat(bufs);
      // Float32 little-endian → typed array. Copy so we own the memory.
      const view = new Float32Array(
        merged.buffer,
        merged.byteOffset,
        Math.floor(merged.byteLength / 4),
      );
      resolve(new Float32Array(view));
    });
    if (fromStdin) ff.stdin.end(input);
  });
}

// ---------------------------------------------------------------------
// Layer 2: samples → chunks
// ---------------------------------------------------------------------
export function chunkAudio(samples, chunkSeconds = DEFAULT_CHUNK_SEC) {
  const size = SR * chunkSeconds;
  const chunks = [];
  for (let i = 0; i < samples.length; i += size) {
    chunks.push(samples.subarray(i, Math.min(i + size, samples.length)));
  }
  return chunks;
}

// ---------------------------------------------------------------------
// Layer 3: chunks → transcripts (distributed via DCP)
// ---------------------------------------------------------------------

// Worker function. MUST be self-contained — DCP serializes via toString().
async function whisperWorkFunction(sliceData, labels) {
  const stamps = { workerStart: Date.now() };
  progress(0.01);

  // WebGPU probe (runs once per worker, cached)
  if (!globalThis.gpuProbe) {
    const probe = { hasNavigatorGpu: false, adapterOk: false, vendor: null, error: null };
    try {
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        probe.hasNavigatorGpu = true;
        const adapter = await navigator.gpu.requestAdapter();
        probe.adapterOk = !!adapter;
        if (adapter && adapter.info) probe.vendor = String(adapter.info.vendor || adapter.info.architecture || 'unknown');
      }
    } catch (e) { probe.error = String(e && e.message || e); }
    globalThis.gpuProbe = probe;
  }

  if (!globalThis.ort) {
    require('dcp-wasm.js');
    globalThis.ort = require('dcp-ort.js');
    ort.env.wasm.simd = true;
  }
  stamps.ortReady = Date.now();

  function b64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  let cold = { encoder: false, decoder: false, decoderPast: false };
  if (!globalThis.encSession) {
    cold.encoder = true;
    const m = require('whisper-tiny-encoder-q/module.js');
    globalThis.encSession = await ort.InferenceSession.create(
      b64ToArrayBuffer(m.model),
      { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' },
    );
  }
  stamps.encReady = Date.now();
  if (!globalThis.decSession) {
    cold.decoder = true;
    const m = require('whisper-tiny-decoder-q/module.js');
    globalThis.decSession = await ort.InferenceSession.create(
      b64ToArrayBuffer(m.model),
      { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' },
    );
  }
  stamps.decReady = Date.now();
  if (!globalThis.decPastSession) {
    cold.decoderPast = true;
    const m = require('whisper-tiny-decoder-past-q/module.js');
    globalThis.decPastSession = await ort.InferenceSession.create(
      b64ToArrayBuffer(m.model),
      { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' },
    );
  }
  stamps.decPastReady = Date.now();
  progress(0.5);

  const melTensor = new ort.Tensor('float32', sliceData.mel, sliceData.dims);
  const encOut = await encSession.run({ input_features: melTensor });
  const encHidden = encOut['last_hidden_state'];
  stamps.encoderRunDone = Date.now();
  progress(0.6);

  const TOKEN_SOT = 50258, TOKEN_EN = 50259, TOKEN_TRANSCRIBE = 50359;
  const TOKEN_NO_TS = 50363, TOKEN_EOS = 50257;
  const NL = 4;

  // Step 0: full decoder, capture all KV
  let tokens = [TOKEN_SOT, TOKEN_EN, TOKEN_TRANSCRIBE, TOKEN_NO_TS];
  const inputIds0 = new ort.Tensor(
    'int64',
    BigInt64Array.from(tokens.map((t) => BigInt(t))),
    [1, tokens.length],
  );
  const dec0 = await decSession.run({ input_ids: inputIds0, encoder_hidden_states: encHidden });
  {
    const l = dec0.logits;
    const [, sq, v] = l.dims;
    const off = (sq - 1) * v;
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < v; i++) if (l.data[off + i] > bv) { bv = l.data[off + i]; bi = i; }
    tokens.push(bi);
  }
  const encoderPast = {};
  let decoderPast = {};
  for (let L = 0; L < NL; L++) {
    encoderPast[`past_key_values.${L}.encoder.key`] = dec0[`present.${L}.encoder.key`];
    encoderPast[`past_key_values.${L}.encoder.value`] = dec0[`present.${L}.encoder.value`];
    decoderPast[`past_key_values.${L}.decoder.key`] = dec0[`present.${L}.decoder.key`];
    decoderPast[`past_key_values.${L}.decoder.value`] = dec0[`present.${L}.decoder.value`];
  }

  const MAX_NEW = 220;
  for (let step = 1; step < MAX_NEW; step++) {
    progress(0.6 + (0.39 * step) / MAX_NEW);
    const lastTok = tokens[tokens.length - 1];
    if (lastTok === TOKEN_EOS) {
      tokens.pop();
      break;
    }
    const inputIds = new ort.Tensor('int64', BigInt64Array.from([BigInt(lastTok)]), [1, 1]);
    const out = await decPastSession.run({
      input_ids: inputIds,
      ...encoderPast,
      ...decoderPast,
    });
    const l = out.logits;
    const v = l.dims[2];
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < v; i++) if (l.data[i] > bv) { bv = l.data[i]; bi = i; }
    tokens.push(bi);
    decoderPast = {};
    for (let L = 0; L < NL; L++) {
      decoderPast[`past_key_values.${L}.decoder.key`] = out[`present.${L}.decoder.key`];
      decoderPast[`past_key_values.${L}.decoder.value`] = out[`present.${L}.decoder.value`];
    }
  }
  progress(1.0);
  stamps.workerEnd = Date.now();
  return {
    idx: sliceData.idx,
    tokens,
    stamps,
    cold,
    gpuProbe: globalThis.gpuProbe,
  };
}

// Cached client-side helpers
let _processor;
let _tokenizer;
let _dcpInited = false;
async function ensureDcp() {
  if (!_dcpInited) {
    await require('dcp-client').init(SCHEDULER);
    _dcpInited = true;
  }
}

export async function transcribeChunks(chunks, opts = {}) {
  const { bidPrice = 1, computeGroup, onProgress } = opts;

  await ensureDcp();
  const compute = require('dcp/compute');
  if (!_processor) _processor = await AutoProcessor.from_pretrained('Xenova/whisper-tiny');
  if (!_tokenizer) _tokenizer = await AutoTokenizer.from_pretrained('Xenova/whisper-tiny');

  // Mel for every chunk on the client (fast, parallel-friendly later)
  const slices = [];
  for (let i = 0; i < chunks.length; i++) {
    const f = await _processor.feature_extractor(chunks[i]);
    slices.push({ idx: i, mel: f.input_features.data, dims: f.input_features.dims });
  }

  const job = compute.for(slices, whisperWorkFunction);
  job.public = { name: `whisper-tiny multi-chunk (${chunks.length} chunks)` };
  job.requires('onnxruntime-dcp/dcp-wasm.js');
  job.requires('onnxruntime-dcp/dcp-ort.js');
  job.requires('whisper-tiny-encoder-q/module.js');
  job.requires('whisper-tiny-decoder-q/module.js');
  job.requires('whisper-tiny-decoder-past-q/module.js');
  if (computeGroup) job.computeGroups = [computeGroup];

  let done = 0;
  const dispatchedAt = Date.now();
  const events = [];
  job.on('result', (ev) => {
    done++;
    const r = ev.result;
    events.push({ idx: r.idx, receivedAt: Date.now(), stamps: r.stamps, cold: r.cold, gpuProbe: r.gpuProbe });
    if (onProgress) onProgress(done, chunks.length);
  });

  const results = await job.exec(bidPrice);
  const arr = Array.from(results);
  arr.sort((a, b) => a.idx - b.idx);
  const texts = arr.map((r) => _tokenizer.decode(r.tokens, { skip_special_tokens: true }).trim());
  if (opts.returnTimings) return { texts, dispatchedAt, events };
  return texts;
}

// ---------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------
export async function transcribe(input, opts = {}) {
  const samples = await decodeAudio(input);
  const chunks = chunkAudio(samples, opts.chunkSeconds);
  const texts = await transcribeChunks(chunks, opts);
  return texts.join(' ');
}
