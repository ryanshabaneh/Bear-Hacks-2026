export type BreakMode = "ad" | "compute";

const KEY = "music-app:break-mode";

export function getBreakMode(): BreakMode {
  if (typeof window === "undefined") return "ad";
  const v = window.localStorage.getItem(KEY);
  return v === "compute" ? "compute" : "ad";
}

export function setBreakMode(mode: BreakMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, mode);
}

export const SONGS_PER_BREAK = 5;
export const AD_DURATION_MS = 3000;
