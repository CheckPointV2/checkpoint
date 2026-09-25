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
  window.CPSetTheme = function () { applyTheme(getTheme() === "dark" ? "light" : "dark"); };
  window.CPOnThemeChange = function (fn) { themeListeners.push(fn); };

  /* ============================================================
     Router
     ============================================================ */
  // The nav-level "tool" the rail links to is not always a 1:1 match with
  // what actually gets mounted: Arrivals and Allocation are one screen
  // (allocation/module.js) presented as a scan list with a detail panel,
  // and Waiting/Departures/Reports are three doors into the same mounted
  // Departures bundle (departures/js/app.js's own internal sub-router
  // already separates their views by `sub`, exactly like Physical
  // Check/Formatting did before). Keying the DOM mount by MOUNT, not by
  // nav tool, is load-bearing: the #view-departures / #view-allocation
  // container ids are what the CSS scoping fix keys every selector off of,
  // so Waiting and Reports must land in the same #view-departures element
  // Departures uses, not a separate #view-waiting one.
  const TOOL_TITLES = {
    dashboard: "Dashboard", arrivals: "Arrivals", waiting: "Waiting",
    departures: "Departures", roomguide: "Room Guide", reports: "Reports", settings: "Settings"
  };
  const TOOL_MOUNT = {
    dashboard: { mount: "dashboard" },
    arrivals: { mount: "allocation" },
    waiting: { mount: "departures", sub: "finder" },
    departures: { mount: "departures", sub: "departures" },
    roomguide: { mount: "roomguide" },
    reports: { mount: "departures", sub: "daylist" },
    settings: { mount: "settings" }
  };
  window.CPActiveTool = "dashboard";
  let pendingSub = null;

  async function route() {
    const hash = location.hash || "#/";
    if (!hash.startsWith("#/")) return; // not ours — a mounted tool owns it (e.g. Departures' own #checkouts)
    const parts = hash.slice(2).split("/").filter(Boolean);
    const tool = parts[0] || "dashboard";
    const sub = pendingSub;
    pendingSub = null;
    await showTool(tool, sub);
  }

  async function showTool(tool, sub) {
    if (!TOOL_MOUNT[tool]) tool = "dashboard";
    window.CPActiveTool = tool;
    const target = TOOL_MOUNT[tool];
    window.CPActiveMount = target.mount; // which bundle owns keyboard shortcuts right now — see departures/js/app.js and roomguide/app.js's shortcut gates
    const effectiveSub = sub || target.sub || null;
    document.title = tool === "dashboard" ? "CheckPoint — Rixos Bab Al Bahr" : TOOL_TITLES[tool] + " — CheckPoint";
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
      else if (tool === "allocation") await mountAllocation(container);
      else if (tool === "dashboard") await mountDashboard(container);
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

  // module.js only touches the DOM once window.CPMountAllocation(container)
  // is actually called — loading it (and the pure-logic files it calls into)
  // up front just defines window.CPAlloc, so Dashboard can read whatever
  // Arrivals has already imported this session without paying for the
  // PDF/XLSX CDN libs, which only load once a file is actually extracted.
  let allocLogicPromise = null;
  function ensureAllocationLogicLoaded() {
    if (window.CPAlloc) return Promise.resolve();
    if (!allocLogicPromise) allocLogicPromise = loadScriptsSequential(["allocation/parse.js", "allocation/rules.js", "allocation/match.js", "allocation/compare.js", "allocation/group.js", "allocation/module.js"]);
    return allocLogicPromise;
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
      "departures/js/finder.js", "departures/js/tools.js", "departures/js/daylist.js", "departures/js/app.js"
    ]);
  }

  async function mountAllocation(container) {
    loadCSSOnce("allocation/style.css");
    await loadScriptsSequential(["allocation/parse.js", "allocation/rules.js", "allocation/match.js", "allocation/compare.js", "allocation/group.js", "allocation/module.js"]);
    await ensureRoomDataLoaded(); // Allocation's room matching needs RBAB_DATA too
    window.CPMountAllocation(container);
  }

  async function mountDashboard(container) {
    loadCSSOnce("shared/dashboard.css");
    await Promise.all([ensureDeparturesDataLoaded(), ensureAllocationLogicLoaded()]);
    await loadScriptsSequential(["shared/dashboard.js"]);
    window.CPMountDashboard(container);
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

  // ---------- rail badges ----------
  // Ambient counts on the rail are the whole point of a persistent nav —
  // they're what let a badge-check replace actually opening a screen. Kept
  // here, not inside any one tool's own render loop, since they depend on
  // two independently-loaded stores (Departures, Allocation) and need to
  // stay current no matter which screen is actually mounted right now.
  function setRailCount(key, n, hot) {
    const el = $(`.cp-rail-count[data-count="${key}"]`);
    if (!el) return;
    el.textContent = n || "";
    el.classList.toggle("hot", !!hot);
  }
  function updateRailBadges() {
    let urgent = 0;
    if (window.CP && window.CP.dep && window.CP.state) {
      const s = window.CP.state();
      const checkCount = s.dueouts ? CP.dep.checkRooms(s).length : 0;
      setRailCount("departures", checkCount, checkCount > 0);
      urgent += checkCount;
      setRailCount("reports", s.dayList ? s.dayList.rooms.length : 0, false);
    }
    if (window.CPAlloc) {
      const a = window.CPAlloc.getAnalysis();
      const flagged = a ? a.items.filter(i => i.tier === "high" || i.tier === "medium").length : 0;
      setRailCount("arrivals", flagged, flagged > 0);
      urgent += a ? a.items.filter(i => i.tier === "high").length : 0;
    }
    setRailCount("urgent", urgent, urgent > 0);
  }
  window.CPUpdateRailBadges = updateRailBadges;

  function boot() {
    bindRail();
    Promise.all([ensureDeparturesDataLoaded(), ensureAllocationLogicLoaded()]).then(() => {
      updateRailBadges();
      if (window.CP && window.CP.onChange) window.CP.onChange(updateRailBadges);
      if (window.CPAlloc) window.CPAlloc.onChange(updateRailBadges);
    });
    window.addEventListener("hashchange", route);
    route();

    $("#lockBtn").addEventListener("click", window.CPLock);
    $("#themeBtn").addEventListener("click", window.CPSetTheme);
    updateThemeIcon(getTheme());

    // Service worker is paused while we're actively iterating — it was causing
    // stale code to stick even after cache clears. Self-heal anyone who already
    // has one installed from before, automatically, no manual steps needed.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    if ("caches" in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }

  setupAuth();
})();
