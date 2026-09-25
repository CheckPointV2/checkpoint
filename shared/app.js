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
    btn.innerHTML = t === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }
  document.documentElement.dataset.theme = getTheme(); // set before paint
  window.CPSetTheme = function () { applyTheme(getTheme() === "dark" ? "light" : "dark"); };
  window.CPOnThemeChange = function (fn) { themeListeners.push(fn); };

  /* ============================================================
     Router
     ============================================================ */
  // Room Guide is the landing tool — there is no separate dashboard "home"
  // view anymore. "#/" and "#/roomguide" are the same destination.
  const TOOL_TITLES = { roomguide: "Room Guide", departures: "Departures", allocation: "Allocation Copilot" };
  window.CPActiveTool = "roomguide";
  window.CPActiveSub = null;
  let pendingSub = null;

  async function route() {
    const hash = location.hash || "#/";
    if (!hash.startsWith("#/")) return; // not ours — a mounted tool owns it (e.g. Departures' own #checkouts)
    const parts = hash.slice(2).split("/").filter(Boolean);
    const tool = parts[0] || "roomguide";
    const sub = pendingSub;
    pendingSub = null;
    await showTool(tool, sub);
  }

  async function showTool(tool, sub) {
    if (!TOOL_TITLES[tool]) tool = "roomguide";
    window.CPActiveTool = tool;
    window.CPActiveSub = sub || (tool === "departures" ? "departures" : null);
    document.title = tool === "roomguide" ? "CheckPoint — Rixos Bab Al Bahr" : TOOL_TITLES[tool] + " — CheckPoint";
    $$(".cp-view").forEach(v => v.classList.remove("active"));

    const view = await ensureMounted(tool);
    view.classList.add("active");
    if (tool === "departures" && sub && window.CP && window.CP.go) {
      window.CP.go(sub);
    }
    updateDockActive();
    window.scrollTo(0, 0);
  }

  function updateDockActive() {
    $$(".cp-dock-btn[data-route]").forEach(el => el.removeAttribute("aria-current"));
    const tool = window.CPActiveTool;
    const sub = window.CPActiveSub;
    let match = null;
    if (tool === "departures") {
      match = document.querySelector(`.cp-dock-btn[data-route="#/departures"][data-sub="${sub}"]`);
    } else {
      match = document.querySelector(`.cp-dock-btn[data-route="#/${tool}"]`);
    }
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
      "departures/js/finder.js", "departures/js/tools.js", "departures/js/daylist.js", "departures/js/app.js"
    ]);
  }

  async function mountAllocation(container) {
    loadCSSOnce("allocation/style.css");
    await loadScriptsSequential(["allocation/parse.js", "allocation/rules.js", "allocation/match.js", "allocation/compare.js", "allocation/group.js", "allocation/module.js"]);
    await ensureRoomDataLoaded(); // Allocation's room matching needs RBAB_DATA too
    window.CPMountAllocation(container);
  }

  /* ============================================================
     Boot
     ============================================================ */
  function bindDock() {
    $$("[data-route]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        pendingSub = el.dataset.sub || null;
        const target = el.dataset.route;
        if (location.hash === target) route(); else location.hash = target;
      });
    });
  }

  function boot() {
    bindDock();
    ensureDeparturesDataLoaded();
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
