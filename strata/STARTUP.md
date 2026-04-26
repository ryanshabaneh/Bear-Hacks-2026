# strata local startup

End-to-end commands to boot the live transcription flow on this laptop. All paths relative to the monorepo root.

## one-time setup

```bash
# strata deps + db
cd ~/Bear-Hacks-2026/strata
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed

# dcp deps. sharp/onnxruntime-node need native bindings; pnpm blocks build scripts by default.
cd ~/Bear-Hacks-2026/dcp
pnpm install
pnpm approve-builds        # accept sharp + onnxruntime-node when prompted
```

DCP keystores must exist at `~/.dcp/id.keystore` and `~/.dcp/default.keystore`. No passphrase is fine for now (lib.mjs unlocks with empty string).

## live transcription run

Live mode requires browser-tab workers. Open at least one tab at https://dcp.work and leave it foregrounded — backgrounded tabs throttle.

```bash
# .env.local
DCP_MODE=live              # live | cached | hardcode
# DCP_BID_PRICE=1          # uncomment to override default 1
```

```bash
cd ~/Bear-Hacks-2026/strata
pnpm dev                   # next 16 turbopack on :3000
```

Stripe webhooks for the funded → catchment_sealed flow:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
# copy the whsec_... into STRIPE_WEBHOOK_SECRET in .env.local before first run
```

## demo walk

1. login as distributor → onboarding modal → dashboard
2. login as client → onboarding modal → /client/transcribe
3. drop an audio file → cast forecast → redirect to /client/forecasts/{id}
4. front opens, slices arrive in real time from the dcp.work tabs, catchment seals
5. settlement row appears (80/20 split) — visible via prisma studio

## capture a cached fixture

After a successful live run, replay it deterministically:

```bash
cd ~/Bear-Hacks-2026/dcp
node capture-cache.mjs path/to/audio.mp3 slopify-demo   # writes dcp/cache/slopify-demo.json
```

Then in `.env.local`:
```bash
DCP_MODE=cached
DCP_CACHED_FIXTURE=slopify-demo
```

## hardcode fallback

Smoke-test only. Synthetic in-process replay with hardcoded transcript lines. No audio decode, no DCP.

```bash
DCP_MODE=hardcode
```

## inspect db

```bash
cd ~/Bear-Hacks-2026/strata
pnpm prisma studio         # :5555
```

## reset

```bash
cd ~/Bear-Hacks-2026/strata
pnpm prisma migrate reset --force   # drops dev.db + reseeds
rm -rf /tmp/strata-uploads
```

## health checks

```bash
curl -s localhost:3000/api/health | jq
curl -s localhost:3000/api/transcribe -X POST -F audio=@sample.mp3 -F estimatedSeconds=120
```
