const NODE_KEY_STORAGE = "strata.nodeKey";
const DEFAULT_BASE_URL = "http://localhost:3000";

function getBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STRATA_BASE_URL) {
    return process.env.NEXT_PUBLIC_STRATA_BASE_URL;
  }
  return DEFAULT_BASE_URL;
}

function getNodeKey(): string {
  if (typeof window === "undefined") return "ssr";
  const existing = window.localStorage.getItem(NODE_KEY_STORAGE);
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `node-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  window.localStorage.setItem(NODE_KEY_STORAGE, fresh);
  return fresh;
}

export type HeartbeatPayload = {
  origin?: string;
  label?: string;
  slicesComputed?: number;
};

export async function sendStrataHeartbeat(payload: HeartbeatPayload = {}): Promise<void> {
  if (typeof window === "undefined") return;
  const url = `${getBaseUrl()}/api/worker/heartbeat`;
  const body = {
    nodeKey: getNodeKey(),
    origin: payload.origin ?? "Slopify",
    label: payload.label ?? "Slopify (Northbeacon)",
    slicesComputed: payload.slicesComputed ?? 0,
  };
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    return;
  }
}
