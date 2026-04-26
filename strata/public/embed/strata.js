(() => {
  const tag = document.currentScript;
  const slotId = tag && tag.getAttribute("data-slot");
  if (!slotId) {
    console.warn("[strata] missing data-slot");
    return;
  }
  if (window.__STRATA_LOADED__) return;
  window.__STRATA_LOADED__ = true;

  const origin = (() => {
    if (tag && tag.src) {
      try {
        return new URL(tag.src).origin;
      } catch {
        return location.origin;
      }
    }
    return location.origin;
  })();

  const iframe = document.createElement("iframe");
  iframe.src = `${origin}/embed/runtime.html?slot=${encodeURIComponent(slotId)}`;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.style.cssText =
    "display:none;width:0;height:0;border:0;position:absolute;";
  iframe.title = "Strata compute runtime";
  document.body.appendChild(iframe);

  const chip = document.createElement("div");
  chip.id = "strata-chip";
  chip.dataset.state = "idle";
  chip.innerHTML = `
    <span class="strata-chip-dot" aria-hidden="true"></span>
    <span class="strata-chip-text">Strata configured. Sky is quiet right now.</span>
    <button class="strata-chip-pause" data-action="pause">Pause</button>
    <a class="strata-chip-info" href="${origin}/what-is-this" target="_blank" rel="noopener">What's this?</a>
  `;
  document.body.appendChild(chip);

  const style = document.createElement("style");
  style.textContent = `
    #strata-chip { position:fixed; bottom:12px; right:12px; z-index:2147483647;
      background:#0a0a0a; color:#fff; font:13px system-ui,sans-serif; padding:8px 12px;
      border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.2); display:flex; gap:10px; align-items:center; }
    #strata-chip .strata-chip-dot { width:8px; height:8px; border-radius:50%; background:#9ca3af; }
    #strata-chip[data-state="running"] .strata-chip-dot { background:#22c55e; }
    #strata-chip[data-state="paused"] .strata-chip-dot { background:#f59e0b; }
    #strata-chip[data-state="error"] .strata-chip-dot { background:#ef4444; }
    #strata-chip a, #strata-chip button { color:#9ca3af; background:none; border:none; cursor:pointer;
      font:inherit; padding:0; text-decoration:underline; }
    #strata-chip a:hover, #strata-chip button:hover { color:#fff; }
  `;
  document.head.appendChild(style);

  const text = chip.querySelector(".strata-chip-text");
  function setState(state, message) {
    chip.dataset.state = state;
    if (message) text.textContent = message;
  }

  chip.querySelector('[data-action="pause"]').addEventListener("click", (e) => {
    const button = e.target;
    const paused = button.dataset.paused === "1";
    button.dataset.paused = paused ? "0" : "1";
    button.textContent = paused ? "Pause" : "Resume";
    iframe.contentWindow &&
      iframe.contentWindow.postMessage(
        { type: paused ? "resume" : "pause" },
        origin,
      );
    setState(
      paused ? "running" : "paused",
      paused
        ? "This page is contributing compute to a transcription Forecast."
        : "Paused for this session. Refresh to resume.",
    );
  });

  window.addEventListener("message", (ev) => {
    if (ev.origin !== origin) return;
    const data = ev.data || {};
    if (data.type === "strata:ready") {
      setState("idle", "Strata configured. Sky is quiet right now.");
    } else if (data.type === "strata:tick") {
      setState(
        "running",
        "This page is contributing compute to a transcription Forecast.",
      );
    } else if (data.type === "strata:error") {
      setState("error", "Compute unavailable.");
    }
  });
})();
