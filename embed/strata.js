/* Strata embed loader — see plan/04-embed.md.
 * Deployed to https://embed.strata.dev/strata.js (Cloudflare Pages, immutable + hashed).
 * Distributors paste:
 *   <script src="https://embed.strata.dev/strata.js" data-slot="SLOT_ID" async></script>
 */
(() => {
  if (window.__STRATA_LOADED__) return;
  const tag = document.currentScript;
  const slotId = tag && tag.getAttribute('data-slot');
  if (!slotId) {
    console.warn('[strata] missing data-slot');
    return;
  }
  window.__STRATA_LOADED__ = true;

  const RUNTIME_ORIGIN = 'https://embed.strata.dev';
  const INFO_URL = 'https://strata.dev/what-is-this';

  // 1. Hidden runtime iframe — this is where the DCP worker actually runs.
  const iframe = document.createElement('iframe');
  iframe.src = `${RUNTIME_ORIGIN}/runtime.html?slot=${encodeURIComponent(slotId)}`;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Strata compute runtime';
  iframe.style.cssText =
    'display:none;width:0;height:0;border:0;position:absolute;left:-9999px;';

  function attachIframe() {
    (document.body || document.documentElement).appendChild(iframe);
  }
  if (document.body) attachIframe();
  else document.addEventListener('DOMContentLoaded', attachIframe, { once: true });

  // 2. Footer chip — single visible UI artifact.
  const chip = document.createElement('div');
  chip.id = 'strata-chip';
  chip.setAttribute('role', 'status');
  chip.innerHTML =
    '<span class="strata-chip-text" data-strata="text">' +
    'This site is supported by your idle compute.</span>' +
    '<button class="strata-chip-pause" data-action="pause" type="button">Pause</button>' +
    '<a class="strata-chip-info" target="_blank" rel="noopener">What’s this?</a>';
  chip.querySelector('.strata-chip-info').href = INFO_URL;

  function attachChip() {
    (document.body || document.documentElement).appendChild(chip);
  }
  if (document.body) attachChip();
  else document.addEventListener('DOMContentLoaded', attachChip, { once: true });

  // 3. Inline styles (no extra HTTP request).
  const style = document.createElement('style');
  style.textContent =
    '#strata-chip{position:fixed;bottom:12px;right:12px;z-index:2147483647;' +
    'background:#0a0a0a;color:#fff;font:13px system-ui,sans-serif;padding:8px 12px;' +
    'border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;gap:10px;' +
    'align-items:center;}' +
    '#strata-chip a,#strata-chip button{color:#9ca3af;background:none;border:none;' +
    'cursor:pointer;font:inherit;padding:0;text-decoration:underline;}' +
    '#strata-chip a:hover,#strata-chip button:hover{color:#fff;}' +
    '#strata-chip[data-state="running"] .strata-chip-text::before{content:"";' +
    'display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;' +
    'margin-right:6px;vertical-align:middle;}' +
    '#strata-chip[data-state="paused"]{background:#3b2a05;}' +
    '#strata-chip[data-state="error"]{background:#3b0a0a;}';
  (document.head || document.documentElement).appendChild(style);

  // 4. Wire pause toggle.
  let paused = false;
  chip.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.action !== 'pause') return;
    paused = !paused;
    target.textContent = paused ? 'Resume' : 'Pause';
    chip.setAttribute('data-state', paused ? 'paused' : 'idle');
    const updateText = chip.querySelector('[data-strata="text"]');
    if (updateText) {
      updateText.textContent = paused
        ? 'Compute paused — site relies on this revenue.'
        : 'This site is supported by your idle compute.';
    }
    iframe.contentWindow &&
      iframe.contentWindow.postMessage(
        { type: paused ? 'pause' : 'resume' },
        RUNTIME_ORIGIN,
      );
  });

  // 5. Listen for runtime status / earnings ticks from the iframe.
  window.addEventListener('message', (ev) => {
    if (ev.origin !== RUNTIME_ORIGIN) return;
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    const text = chip.querySelector('[data-strata="text"]');
    if (data.type === 'strata:status' && text) {
      if (data.state === 'running') {
        chip.setAttribute('data-state', 'running');
        text.textContent =
          typeof data.computed === 'number' && typeof data.total === 'number'
            ? `Computing… (slice ${data.computed}/${data.total})`
            : 'Computing…';
      } else if (data.state === 'idle') {
        chip.setAttribute('data-state', 'idle');
        text.textContent = 'This site is supported by your idle compute.';
      } else if (data.state === 'error') {
        chip.setAttribute('data-state', 'error');
        text.textContent = 'Compute unavailable.';
      }
    }
  });
})();
