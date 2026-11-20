/* CheckPoint — idle auto-lock + bronze clock screensaver. A privacy
   screen, not real security (the PIN is stored client-side, same as the
   session password) — it just keeps the screen from sitting open with
   guest/shift data visible if the device is left unattended a moment. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  let lastActivity = Date.now();
  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "cpScreensaver";
    overlay.className = "screensaver";
    overlay.innerHTML = `
      <div class="screensaver-clock" id="ssClock"></div>
      <div class="screensaver-date" id="ssDate"></div>
      <form class="screensaver-pin" id="ssPinForm" hidden>
        <input type="password" inputmode="numeric" id="ssPinInput" class="cp-input" placeholder="PIN" autocomplete="off">
        <div class="screensaver-pin-error" id="ssPinError">Incorrect PIN.</div>
      </form>
      <p class="screensaver-hint" id="ssHint">Tap anywhere to continue</p>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function tickClock() {
    const d = new Date();
    const el = $("#ssClock", overlay), dEl = $("#ssDate", overlay);
    if (el) el.textContent = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (dEl) dEl.textContent = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }
  let clockTimer = null;

  function show() {
    const el = ensureOverlay();
    const pin = window.CPPrefs ? window.CPPrefs.get().pin : null;
    $("#ssPinForm", el).hidden = !pin;
    $("#ssHint", el).hidden = !!pin;
    $("#ssPinError", el).classList.remove("show");
    tickClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(tickClock, 1000);
    el.classList.add("show");
    if (pin) setTimeout(() => $("#ssPinInput", el).focus(), 300);
  }
  function hide() {
    if (overlay) overlay.classList.remove("show");
    clearInterval(clockTimer);
    lastActivity = Date.now();
  }

  function bindDismiss() {
    const el = ensureOverlay();
    el.addEventListener("click", (e) => {
      const pin = window.CPPrefs ? window.CPPrefs.get().pin : null;
      if (!pin) hide();
    });
    $("#ssPinForm", el).addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#ssPinInput", el);
      const pin = window.CPPrefs ? window.CPPrefs.get().pin : null;
      if (input.value === pin) { input.value = ""; hide(); }
      else { $("#ssPinError", el).classList.add("show"); input.value = ""; }
    });
  }

  ["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach(evt => {
    document.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true });
  });

  setInterval(() => {
    const mins = window.CPPrefs ? window.CPPrefs.get().autoLockMinutes : 0;
    if (!mins) return;
    if (overlay && overlay.classList.contains("show")) return;
    if (Date.now() - lastActivity >= mins * 60000) show();
  }, 15000);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindDismiss);
  else bindDismiss();

  window.CPShowScreensaver = show;
})();
