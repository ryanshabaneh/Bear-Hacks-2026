async function postCallback(callbackUrl, body) {
  const sharedSecret = process.env.DCP_WORKER_SHARED_SECRET;
  if (!sharedSecret) throw new Error("DCP_WORKER_SHARED_SECRET not set");

  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sharedSecret}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[callback] non-2xx ${res.status} from ${callbackUrl}: ${text}`);
  }
}

module.exports = { postCallback };
