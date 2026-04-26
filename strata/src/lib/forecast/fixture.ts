export type FixtureClip = {
  id: string;
  title: string;
  url: string;
  durationSeconds: number;
};

export type FixtureManifest = {
  name: string;
  totalSeconds: number;
  clips: FixtureClip[];
  groundTruthSrtUrl?: string;
};

export const DEMO_FIXTURE: FixtureManifest = {
  name: "demo-fixture-2026-04-26",
  totalSeconds: 1800,
  clips: [
    {
      id: "clip-01",
      title: "Intro",
      url: "https://cdn.strata.app/fixtures/clip-01.wav",
      durationSeconds: 600,
    },
    {
      id: "clip-02",
      title: "Middle",
      url: "https://cdn.strata.app/fixtures/clip-02.wav",
      durationSeconds: 600,
    },
    {
      id: "clip-03",
      title: "Outro",
      url: "https://cdn.strata.app/fixtures/clip-03.wav",
      durationSeconds: 600,
    },
  ],
  groundTruthSrtUrl: "https://cdn.strata.app/fixtures/demo-ground-truth.srt",
};

export const SHORT_DEMO_FIXTURE: FixtureManifest = {
  name: "short-demo-fixture",
  totalSeconds: 90,
  clips: [
    {
      id: "short-01",
      title: "30s test",
      url: "https://cdn.strata.app/fixtures/test-30s.wav",
      durationSeconds: 90,
    },
  ],
};

export function chunksFor(manifest: FixtureManifest, chunkSeconds = 30): Array<{
  chunkIndex: number;
  timestampStart: number;
  timestampEnd: number;
  inputUrl: string;
}> {
  const out: Array<{
    chunkIndex: number;
    timestampStart: number;
    timestampEnd: number;
    inputUrl: string;
  }> = [];
  let chunkIndex = 0;
  let runningOffset = 0;
  for (const clip of manifest.clips) {
    const chunksInClip = Math.ceil(clip.durationSeconds / chunkSeconds);
    for (let i = 0; i < chunksInClip; i++) {
      const sliceStart = i * chunkSeconds;
      const sliceEnd = Math.min(sliceStart + chunkSeconds, clip.durationSeconds);
      out.push({
        chunkIndex,
        timestampStart: runningOffset + sliceStart,
        timestampEnd: runningOffset + sliceEnd,
        inputUrl: `${clip.url}#t=${sliceStart},${sliceEnd}`,
      });
      chunkIndex += 1;
    }
    runningOffset += clip.durationSeconds;
  }
  return out;
}
