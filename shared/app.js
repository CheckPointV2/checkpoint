(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ============================================================
     Auth — one password for the whole hub.
     Client-side only: this deters casual link-sharing, it does not
     secure the data, which stays reachable at its direct URLs regardless.
     To change the password: open this file in a browser console and run
       crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourNewPassword'))
         .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
     then paste the printed hash below as PASS_HASH.
     Default password is: rixosCP2026
     ============================================================ */
  const PASS_HASH = "036111d7bd4ff17f618a9012782f299c2ff19554f1fb57a88edbba4bf3e9cc88"; // default password: rixosCP2026 — change via the note above
  const AUTH_KEY = "cp_auth_ok";

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function isAuthed() { return sessionStorage.getItem(AUTH_KEY) === "ok" || localStorage.getItem(AUTH_KEY) === "ok"; }

  function showApp() {
    $("#authGate").style.display = "none";
    $("#mainApp").style.display = "";
    boot();
  }

  async function setupAuth() {
    if (isAuthed()) { showApp(); return; }
    const form = $("#authForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = $("#authPass").value;
      const hash = await sha256(val);
      if (hash === PASS_HASH) {
        localStorage.setItem(AUTH_KEY, "ok");
        showApp();
      } else {
        $("#authError").classList.add("show");
      }
    });
  }

  window.CPLock = function () {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  };

  /* ============================================================
     Theme — single source of truth for every tool.
     ============================================================ */
  const THEME_KEY = "cp_theme";
  const themeListeners = [];
  function getTheme() { return localStorage.getItem(THEME_KEY) || "light"; }
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);
    themeListeners.forEach(fn => { try { fn(t); } catch (e) {} });
    updateThemeIcon(t);
  }
  function updateThemeIcon(t) {
    const btn = $("#themeBtn");
    if (!btn) return;
    const icon = btn.querySelector(".cp-rail-icon") || btn;
    const label = btn.querySelector(".cp-rail-btn-label");
    icon.innerHTML = t === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    if (label) label.textContent = t === "dark" ? "Light mode" : "Dark mode";
  }
  document.documentElement.dataset.theme = getTheme(); // set before paint

  /* ============================================================
     Animation level — mirrors prefers-reduced-motion but as an explicit
     in-app choice (Settings: Full / Subtle / Off). "Off" is a global CSS
     kill-switch (see shared/tokens.css); "Subtle" is left for individual
     components to interpret (e.g. Home's particles, the logo shimmer).
     ============================================================ */
  function applyMotionClass() {
    const level = window.CPPrefs ? window.CPPrefs.get().animationLevel : "full";
    document.documentElement.classList.toggle("cp-motion-off", level === "off");
    document.documentElement.dataset.motion = level;
  }
  applyMotionClass();
  if (window.CPPrefs) window.CPPrefs.onChange(applyMotionClass);
  window.CPSetTheme = function () { applyTheme(getTheme() === "dark" ? "light" : "dark"); };
  window.CPOnThemeChange = function (fn) { themeListeners.push(fn); };

  /* ============================================================
     Router
     ============================================================ */
  // The nav-level "tool" the rail links to is not always a 1:1 match with
  // what actually gets mounted: Departures and Reports are two doors into
  // the same mounted Departures bundle (departures/js/app.js's own internal
  // sub-router already separates their views by `sub`, exactly like
  // Physical Check/Formatting did before). Keying the DOM mount by MOUNT,
  // not by nav tool, is load-bearing: the #view-departures container id is
  // what the CSS scoping fix keys every selector off of, so Reports must
  // land in the same #view-departures element Departures uses, not a
  // separate #view-reports one.
  const TOOL_TITLES = {
    home: "CheckPoint", departures: "Departures", roomguide: "Room Guide", reports: "Reports",
    comms: "Templates", reminders: "Reminders", notes: "Notes", settings: "Settings"
  };
  const TOOL_MOUNT = {
    home: { mount: "home" },
    departures: { mount: "departures", sub: "departures" },
    roomguide: { mount: "roomguide" },
    reports: { mount: "departures", sub: "daylist" },
    comms: { mount: "comms" },
    reminders: { mount: "reminders" },
    notes: { mount: "notes" },
    settings: { mount: "settings" }
  };
  window.CPActiveTool = "home";
  let pendingSub = null;

  async function route() {
    const hash = location.hash || "#/";
    if (!hash.startsWith("#/")) return; // not ours — a mounted tool owns it (e.g. Departures' own #checkouts)
    const parts = hash.slice(2).split("/").filter(Boolean);
    const tool = parts[0] || lastTool() || "home";
    const sub = pendingSub;
    pendingSub = null;
    await showTool(tool, sub);
  }

  async function showTool(tool, sub) {
    if (!TOOL_MOUNT[tool]) tool = "home";
    window.CPActiveTool = tool;
    saveLastTool(tool);
    const target = TOOL_MOUNT[tool];
    window.CPActiveMount = target.mount; // which bundle owns keyboard shortcuts right now — see departures/js/app.js and roomguide/app.js's shortcut gates
    const effectiveSub = sub || target.sub || null;
    document.title = tool === "home" ? "CheckPoint — Rixos Bab Al Bahr" : TOOL_TITLES[tool] + " — CheckPoint";
    $$(".cp-view").forEach(v => v.classList.remove("active"));

    const view = await ensureMounted(target.mount);
    view.classList.add("active");
    if (target.mount === "departures" && effectiveSub && window.CP && window.CP.go) {
      window.CP.go(effectiveSub);
    }
    updateRailActive();
    window.scrollTo(0, 0);
  }

  function updateRailActive() {
    $$(".cp-rail-btn[data-route]").forEach(el => el.removeAttribute("aria-current"));
    const match = document.querySelector(`.cp-rail-btn[data-route="#/${window.CPActiveTool}"]`);
    if (match) match.setAttribute("aria-current", "page");
  }

  /* ============================================================
     Lazy mount cache — fetch + inject each tool's markup, css and
     scripts exactly once, then just toggle visibility after that.
     ============================================================ */
  const mounted = {};

  function loadCSSOnce(href) {
    if ($(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptsSequential(srcs) {
    return srcs.reduce((p, src) => p.then(() => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    })), Promise.resolve());
  }

  async function ensureMounted(tool) {
    if (mounted[tool]) return mounted[tool];
    const container = document.createElement("div");
    container.className = "cp-view";
    container.id = "view-" + tool;
    container.innerHTML = '<div class="cp-loading">Loading…</div>';
    $("#viewRoot").appendChild(container);
    mounted[tool] = container;

    try {
      if (tool === "roomguide") await mountRoomGuide(container);
      else if (tool === "departures") await mountDepartures(container);
      else if (tool === "home") await mountHome(container);
      else if (tool === "comms") await mountComms(container);
      else if (tool === "reminders") await mountReminders(container);
      else if (tool === "notes") await mountNotes(container);
      else if (tool === "settings") await mountSettings(container);
    } catch (err) {
      container.innerHTML = '<div class="cp-loading">Could not load this tool. ' + (err && err.message ? err.message : "") + '</div>';
      console.error(err);
    }
    return container;
  }

  let roomDataPromise = null;
  function ensureRoomDataLoaded() {
    if (window.RBAB_DATA) return Promise.resolve();
    if (!roomDataPromise) roomDataPromise = loadScriptsSequential(["roomguide/data.js"]);
    return roomDataPromise;
  }

  let depDataPromise = null;
  function ensureDeparturesDataLoaded() {
    if (window.CP && window.CP.dep) return Promise.resolve();
    if (!depDataPromise) depDataPromise = loadScriptsSequential(["departures/js/store.js", "departures/js/departures.js"]);
    return depDataPromise;
  }

  async function mountRoomGuide(container) {
    loadCSSOnce("roomguide/style.css");
    const res = await fetch("roomguide/index.html");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelector("#authGate")?.remove();
    const mainApp = doc.querySelector("#mainApp");
    if (mainApp) mainApp.removeAttribute("style");
    container.innerHTML = doc.body.innerHTML;
    await ensureRoomDataLoaded();
    await loadScriptsSequential(["roomguide/app.js"]);
    window.CPMountRoomGuide();
  }

  async function mountDepartures(container) {
    loadCSSOnce("departures/css/app.css");
    const res = await fetch("departures/index.html");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    container.innerHTML = doc.body.innerHTML;
    await loadScriptsSequential([
      "departures/js/store.js", "departures/js/departures.js", "departures/js/checkouts.js",
      "departures/js/tools.js", "departures/js/daylist.js", "departures/js/app.js"
    ]);
  }

  async function mountHome(container) {
    loadCSSOnce("shared/home.css");
    await loadScriptsSequential(["shared/home.js"]);
    window.CPMountHome(container);
  }

  async function mountComms(container) {
    loadCSSOnce("comms/style.css");
    await loadScriptsSequential(["comms/app.js"]);
    window.CPMountComms(container);
  }

  async function mountReminders(container) {
    loadCSSOnce("reminders/style.css");
    await loadScriptsSequential(["reminders/app.js"]);
    window.CPMountReminders(container);
  }

  async function mountNotes(container) {
    loadCSSOnce("notes/style.css");
    await loadScriptsSequential(["notes/app.js"]);
    window.CPMountNotes(container);
  }

  async function mountSettings(container) {
    loadCSSOnce("shared/settings.css");
    await loadScriptsSequential(["shared/settings.js"]);
    window.CPMountSettings(container);
  }

  /* ============================================================
     Boot
     ============================================================ */
  function bindRail() {
    $$("[data-route]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        pendingSub = el.dataset.sub || null;
        const target = el.dataset.route;
        if (location.hash === target) route(); else location.hash = target;
      });
    });
  }

  // ---------- resume where I left off ----------
  const LAST_TOOL_KEY = "cp_last_tool";
  function lastTool() { try { return localStorage.getItem(LAST_TOOL_KEY); } catch (e) { return null; } }
  function saveLastTool(tool) { try { localStorage.setItem(LAST_TOOL_KEY, tool); } catch (e) {} }

  // ---------- rail badges ----------
  // Ambient counts on the rail are the whole point of a persistent nav —
  // they're what let a badge-check replace actually opening a screen. Kept
  // here, not inside any one tool's own render loop, since they depend on
  // independently-loaded stores and need to stay current no matter which
  // screen is actually mounted right now.
  function setRailCount(key, n, hot) {
    const el = $(`.cp-rail-count[data-count="${key}"]`);
    if (!el) return;
    el.textContent = n || "";
    el.classList.toggle("hot", !!hot);
  }
  function updateRailBadges() {
    if (window.CP && window.CP.dep && window.CP.state) {
      const s = window.CP.state();
      const checkCount = s.dueouts ? CP.dep.checkRooms(s).length : 0;
      setRailCount("departures", checkCount, checkCount > 0);
      setRailCount("reports", s.dayList ? s.dayList.rooms.length : 0, false);
    }
    if (window.CPReminders) {
      const n = window.CPReminders.overdueCount ? window.CPReminders.overdueCount() : 0;
      setRailCount("reminders", n, n > 0);
    }
  }
  window.CPUpdateRailBadges = updateRailBadges;

  function boot() {
    bindRail();
    ensureDeparturesDataLoaded().then(() => {
      updateRailBadges();
      if (window.CP && window.CP.onChange) window.CP.onChange(updateRailBadges);
    });
    window.addEventListener("hashchange", route);
    route();

    $("#lockBtn").addEventListener("click", window.CPLock);
    $("#themeBtn").addEventListener("click", window.CPSetTheme);
    updateThemeIcon(getTheme());
    bindTopbar();
    bindRailCollapse();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }

    // "What's new" needs to be checked every boot, not only once the
    // Settings tool has actually been visited — load its (tiny) script
    // just for the function, without mounting the Settings view itself.
    loadCSSOnce("shared/settings.css");
    loadScriptsSequential(["shared/settings.js"]).then(() => {
      window.CPShowWhatsNewIfNeeded && window.CPShowWhatsNewIfNeeded();
    });
  }

  /* ============================================================
     Top bar — persistent across every tool: date, time, the next
     reminder due (once the Reminders tool exists), and a Settings
     shortcut. Lives in the shell, not inside any one tool's markup.
     ============================================================ */
  function renderTopbarClock() {
    const d = new Date();
    const timeEl = $("#cpTopClock"), dateEl = $("#cpTopDate");
    if (timeEl) timeEl.textContent = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (dateEl) dateEl.textContent = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  function renderTicker() {
    const wrap = $("#cpTicker");
    if (!wrap) return;
    const next = window.CPReminders && window.CPReminders.getNext ? window.CPReminders.getNext() : null;
    if (!next) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const mins = Math.round((next.at - Date.now()) / 60000);
    const label = mins <= 0 ? "Due now" : mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
    wrap.innerHTML = `<span class="cp-ticker-dot"></span><span class="cp-ticker-text">${CP.esc ? CP.esc(next.title) : next.title}</span><span class="cp-ticker-time">${label}</span>`;
  }
  function bindTopbar() {
    renderTopbarClock();
    renderTicker();
    setInterval(() => { renderTopbarClock(); renderTicker(); }, 15000);
    const settingsBtn = $("#cpTopSettings");
    if (settingsBtn) settingsBtn.addEventListener("click", (e) => { e.preventDefault(); location.hash = "#/settings"; });
    const ticker = $("#cpTicker");
    if (ticker) ticker.addEventListener("click", () => { location.hash = "#/reminders"; });
  }
  window.CPRefreshTicker = renderTicker;

  /* ---------- sidebar collapse (full / icon-only), remembered ---------- */
  const RAIL_COLLAPSED_KEY = "cp_rail_collapsed";
  function bindRailCollapse() {
    const app = $("#mainApp"), btn = $("#railCollapseBtn");
    if (!app || !btn) return;
    if (localStorage.getItem(RAIL_COLLAPSED_KEY) === "1") app.classList.add("cp-rail-collapsed");
    btn.addEventListener("click", () => {
      const on = app.classList.toggle("cp-rail-collapsed");
      localStorage.setItem(RAIL_COLLAPSED_KEY, on ? "1" : "0");
      btn.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
    });
  }

  setupAuth();
})();
