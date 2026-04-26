# Whisper-in-sandbox spike — TEMPLATE (BE3 fills in)

> Per `plan/01-preflight.md` §5. Resolve by T+2. This file locks the architecture for everyone else.

## Result

**Path chosen:** _TODO — A | B | C_

**Confidence:** _TODO — confirmed | partial | bypassed_

## Path A — Strata-hosted version-pinned bundle

- Bundle URL tested: _TODO_
- Loaded successfully inside DCP sandbox? _yes / no_
- Whisper-base ONNX initialized? _yes / no_
- WebGPU device acquired (`navigator.gpu`)? _yes / no / fell back to WASM-SIMD_
- `OfflineAudioContext` available for chunk decode? _yes / no_
- RemoteDataPattern fetch succeeded for bundle URL? _yes / no_
- RemoteDataPattern fetch succeeded for chunk URL? _yes / no_
- Total cold-start (model fetch + warm + first decode) under 30s ENOPROGRESS budget with `progress()` heartbeats? _yes / no — actual: ___s_
- Notes: _TODO_

## Path B — Content-addressed jsdelivr fallback

- Tested? _yes / no — only test if Path A fails_
- Bundle URL: _TODO_
- Result: _TODO_

## Path C — Localhost inference fallback

- Tested? _yes / no — only test if Paths A and B fail_
- Localhost endpoint: _http://localhost:8080/transcribe_
- Result: _TODO_

## Architectural implications

_TODO — one paragraph explaining what the chosen path means for the rest of the team. Examples:_

- _If A: everyone targets `import('https://cdn.strata.app/runtime/whisper-work-v1.js')`. CDN must be provisioned (BE3 / devops)._
- _If B: jsdelivr URL goes in `STRATA_WHISPER_BUNDLE_URL` env var. Pin version, never `@latest`._
- _If C: demo story degrades from 'real distributed compute' to 'real DCP scheduling, fake distribution'. Update narration script in `plan/07-demo-script.md`._

## Open questions / followups

- _TODO — anything that didn't get resolved in the spike but matters for Phase 1+_
