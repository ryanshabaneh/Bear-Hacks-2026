DCP Whisper — Distributed Audio Transcription
=============================================

A library for transcribing audio files using OpenAI's whisper-tiny ONNX
model distributed across volunteer workers on Distributive's DCP network.

Quick start
-----------

    import { transcribe } from './lib.mjs';
    const text = await transcribe('podcast.mp3');

Prerequisites
-------------

1. Node.js >= 18
2. ffmpeg on PATH  (used to decode mp3/wav/ogg/flac/m4a/etc.)
3. DCP keystores at ~/.dcp/id.keystore and ~/.dcp/default.keystore
   Download both from https://portal.distributed.computer
4. At least one worker running. Easiest: open https://dcp.work in a
   browser tab and click Start. More tabs / devices = more parallelism.
5. Bank account funded with DCP Compute Credits (DCC). The default bid
   is 1 DCC/slice; tune via opts.bidPrice.

Install
-------

    cd dcp
    npm install


API
===

decodeAudio(input) -> Promise<Float32Array>
-------------------------------------------
Decode any ffmpeg-readable format to 16 kHz mono float32 PCM.

  input    : string (file path) | Buffer (audio bytes)
  returns  : Float32Array of audio samples


chunkAudio(samples, chunkSeconds = 30) -> Float32Array[]
--------------------------------------------------------
Split samples into fixed-length windows. Whisper-tiny is trained on 30s
windows; other values work but are not recommended.

  samples       : Float32Array
  chunkSeconds  : number, default 30
  returns       : Float32Array[]   (last element may be shorter)


transcribeChunks(chunks, opts?) -> Promise<string[]>
----------------------------------------------------
Distribute chunks across DCP workers, run whisper-tiny inference per
chunk, return one transcript per chunk in input order.

  chunks   : Float32Array[]
  opts     : {
               bidPrice      ?: number         // DCC per slice (default 1)
               computeGroup  ?: { joinKey, joinSecret }   // target private group
               onProgress    ?: (done, total) => void     // per-slice callback
               returnTimings ?: boolean        // see below
             }
  returns  : string[]
             OR { texts, dispatchedAt, events }   if returnTimings === true
             where events = [{ idx, receivedAt, stamps, cold, gpuProbe }]


transcribe(input, opts?) -> Promise<string>
-------------------------------------------
Convenience wrapper:  decodeAudio -> chunkAudio -> transcribeChunks -> join.

  input  : string | Buffer
  opts   : same as transcribeChunks plus
             chunkSeconds ?: number   (default 30)
  returns: string  (chunks joined with " ")


Example
=======

run-podcast.mjs is a complete example: it loads a local MP3, transcribes
it, and prints per-chunk timing + a worker-side WebGPU probe.

    cd dcp
    npm install
    node run-podcast.mjs path/to/your/audio.mp3


How it works
============

1. ffmpeg decodes audio to 16 kHz mono float32 samples.
2. Samples are chunked into 30 s windows.
3. Mel spectrogram is computed per chunk on the client via the
   @xenova/transformers feature extractor.
4. compute.for(...) dispatches one DCP slice per chunk.
5. On each worker:
   a. Load three ONNX sessions (encoder, decoder, decoder-with-past)
      from pre-published DCP packages. Cached in globalThis across
      slices, so subsequent slices on the same worker skip this.
   b. Run encoder forward pass on the mel spectrogram.
   c. Greedy autoregressive decoder loop with KV caching:
        - step 0:   decoder_model      (no past)        -> capture KVs
        - step 1+:  decoder_with_past  (uses past KVs)  -> ~14x faster
      Stops at <|endoftext|> token or after 220 tokens.
   d. Return token IDs.
6. Client decodes tokens with the Whisper tokenizer.
7. Per-chunk transcripts joined into final string.


Pre-published DCP packages (already on the scheduler)
=====================================================

  whisper-tiny-encoder-q        (~10 MB, quantized int8)
  whisper-tiny-decoder-q        (~30 MB, used at step 0)
  whisper-tiny-decoder-past-q   (~29 MB, used at steps 1+)

These were published once and live on the scheduler. lib.mjs's work
function require()s them by name. You do NOT need to re-upload them.


Limitations & notes
===================

- whisper-tiny is the smallest Whisper model. On podcasts with banter,
  laughter, or overlapping speech it can produce repetition loops. For
  better quality, swap to whisper-base or whisper-small (re-upload the
  ONNX as new packages, change the require() names in lib.mjs).

- DCP browser-tab workers do NOT have navigator.gpu. Inference runs on
  WASM (CPU). The standalone Distributive Linux worker bundles WebGPU
  via Dawn; lib.mjs already passes ['webgpu', 'wasm'] so capable workers
  light up automatically.

- Per-slice DCP routing has a ~20-30 s overhead floor. Single-chunk
  workloads will feel slow; throughput improves dramatically with batch
  size and worker count.

- Worker availability is volunteer-driven. Wall-clock varies run-to-run
  with who's online. Empirically observed: 0.4x - 2x realtime on a
  single dcp.work browser tab for an 8.7 min podcast.
