/* CheckPoint — hub-wide feel: ripple, magnetic hover, logo shimmer,
   sidebar stagger-in, copy→checkmark morph, a shared toast, and soft
   optional UI sounds. Kept as its own file so shared/app.js stays about
   routing. Everything here checks window.CPMotionOK() first — "Off"
   means none of this runs, not just runs instantly. */
(function () {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- shared toast (for tools mounted directly in the shell) ---------- */
  function ensureToastEl() {
    let el = document.getElementById("cpShellToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cpShellToast";
      el.className = "cp-toast-wrap";
      el.innerHTML = '<div class="cp-toast"></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  window.CPToast = function (msg) {
    const wrap = ensureToastEl();
    const t = wrap.firstElementChild;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 1900);
  };

  window.CPCopy = async function (text, msg, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) {}
      ta.remove();
    }
    window.CPToast(msg || "Copied");
    window.CPPlaySound && window.CPPlaySound("click");
    if (btn) morphToCheck(btn);
  };

  // Swaps a button's icon for a checkmark for a beat, then restores it —
  // used for any "Copy" action across the app, not just Departures'.
  function morphToCheck(btn) {
    if (btn._morphing) return;
    btn._morphing = true;
    const original = btn.innerHTML;
    const ok = !window.CPMotionOK || window.CPMotionOK("subtle");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="cp-morph-check"><path d="M5 13l4 4L19 7"/></svg>';
    btn.classList.add("cp-copied");
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("cp-copied");
      btn._morphing = false;
    }, ok ? 1100 : 700);
  }
  window.CPMorphToCheck = morphToCheck;

  /* ---------- shared sheet/modal (for tools mounted directly in the shell) ---------- */
  // Departures already has its own <dialog id="sheet"> wired to its own
  // markup; this is the equivalent for Templates/Reminders/Notes, which
  // have no such dialog of their own to reuse.
  function ensureModalEl() {
    let el = document.getElementById("cpShellModal");
    if (!el) {
      el = document.createElement("div");
      el.id = "cpShellModal";
      el.className = "cp-modal-overlay";
      el.innerHTML = '<div class="cp-modal" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(el);
      el.addEventListener("click", (e) => { if (e.target === el) closeSheet(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.classList.contains("show")) closeSheet(); });
    }
    return el;
  }
  function closeSheet() {
    const el = document.getElementById("cpShellModal");
    if (el) el.classList.remove("show");
  }
  window.CPSheet = function (html, bindFn) {
    const el = ensureModalEl();
    const box = el.querySelector(".cp-modal");
    box.innerHTML = html;
    el.classList.add("show");
    if (bindFn) bindFn(box, closeSheet);
    return closeSheet;
  };
  window.CPCloseSheet = closeSheet;

  window.CPConfirm = function (title, body, yesLabel, onYes) {
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
        <div><h2 style="margin:0 0 4px;font-family:var(--font-display);font-size:19px;">${title}</h2><p style="margin:0;font-size:13px;color:var(--ink-soft);">${body}</p></div>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="cp-btn cp-btn-primary" data-yes type="button">${yesLabel}</button>
        <button class="cp-btn" data-no type="button">Cancel</button>
      </div>`, (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      el.querySelector("[data-no]").onclick = close;
      el.querySelector("[data-yes]").onclick = () => { close(); onYes(); };
    });
  };

  /* ---------- button ripple ---------- */
  function addRipple(e) {
    if (!window.CPMotionOK || !window.CPMotionOK("subtle")) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.6;
    r.className = "cp-ripple";
    r.style.width = r.style.height = size + "px";
    const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
    r.style.left = x + "px"; r.style.top = y + "px";
    btn.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
  }
  function bindRippleTargets(root) {
    // Rail nav buttons are excluded: their active-page indicator bar
    // intentionally sits outside the button's own box (a negative left
    // offset into the rail's gutter), which the ripple's overflow:hidden
    // would clip. Magnetic hover already gives them tactile feedback.
    $$(".cp-btn, .btn, .chip, .cp-icon-btn", root).forEach(el => {
      if (el._rippleBound) return;
      el._rippleBound = true;
      el.classList.add("cp-ripple-host");
      el.addEventListener("pointerdown", addRipple);
    });
  }
  // New markup gets injected constantly (each tool mount, each re-render),
  // so ripple binding runs off a MutationObserver instead of a one-time
  // pass — cheap (class-guarded, no-op on repeat) and never misses a button.
  new MutationObserver(() => bindRippleTargets(document)).observe(document.body, { childList: true, subtree: true });

  /* ---------- magnetic hover on rail icons ---------- */
  function bindMagnetic() {
    $$(".cp-rail-btn").forEach(btn => {
      if (btn._magBound) return;
      btn._magBound = true;
      const icon = btn.querySelector(".cp-rail-icon");
      if (!icon) return;
      btn.addEventListener("mousemove", (e) => {
        if (!window.CPMotionOK || !window.CPMotionOK("full")) return;
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.12;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.12;
        icon.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener("mouseleave", () => { icon.style.transform = ""; });
    });
  }

  /* ---------- sidebar stagger-in on load ---------- */
  function staggerRail() {
    const btns = $$(".cp-rail-btn, .cp-rail-brand");
    btns.forEach((el, i) => {
      el.classList.add("cp-enter");
      el.style.animationDelay = Math.min(i * 45, 400) + "ms";
    });
  }

  /* ---------- logo shimmer, every few seconds ---------- */
  function startLogoShimmer() {
    const name = document.getElementById("cpRailName");
    if (!name) return;
    setInterval(() => {
      if (!window.CPMotionOK || !window.CPMotionOK("subtle")) return;
      name.classList.remove("cp-shimmer");
      void name.offsetWidth; // restart the animation
      name.classList.add("cp-shimmer");
    }, 6000);
  }

  /* ---------- soft UI sounds, muted by default ---------- */
  let actx = null;
  function tone(freq, dur, gain, type) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator(), g = actx.createGain();
      osc.type = type || "sine"; osc.frequency.value = freq;
      g.gain.value = 0;
      osc.connect(g); g.connect(actx.destination);
      const t0 = actx.currentTime;
      g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  window.CPPlaySound = function (kind) {
    if (!window.CPPrefs || !window.CPPrefs.get().soundsEnabled) return;
    if (kind === "click") tone(720, 0.06, 0.05, "sine");
    else if (kind === "chime") { tone(660, 0.5, 0.06, "sine"); setTimeout(() => tone(880, 0.6, 0.05, "sine"), 90); }
  };

  function init() {
    staggerRail();
    bindMagnetic();
    startLogoShimmer();
    bindRippleTargets(document);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
