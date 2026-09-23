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
  const TOOL_TITLES = { home: "Home", roomguide: "Room Guide", departures: "Departures", allocation: "Allocation Intelligence" };
  window.CPActiveTool = "home";
  window.CPActiveSub = null;
  let pendingSub = null;

  async function route() {
    const hash = location.hash || "#/";
    if (!hash.startsWith("#/")) return; // not ours — a mounted tool owns it (e.g. Departures' own #checkouts)
    const parts = hash.slice(2).split("/").filter(Boolean);
    const tool = parts[0] || "home";
    const sub = pendingSub;
    pendingSub = null;
    await showTool(tool, sub);
  }

  async function showTool(tool, sub) {
    if (!TOOL_TITLES[tool]) tool = "home";
    window.CPActiveTool = tool;
    window.CPActiveSub = sub || (tool === "departures" ? "departures" : null);
    document.title = tool === "home" ? "CheckPoint — Rixos Bab Al Bahr" : TOOL_TITLES[tool] + " — CheckPoint";
    $$(".cp-view").forEach(v => v.classList.remove("active"));

    if (tool === "home") {
      $("#view-home").classList.add("active");
      renderHome();
    } else {
      const view = await ensureMounted(tool);
      view.classList.add("active");
      if (tool === "departures" && sub && window.CP && window.CP.go) {
        window.CP.go(sub);
      }
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
      match = document.querySelector(`.cp-dock-btn[data-route="#/${tool === "home" ? "" : tool}"]`);
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
    await loadScriptsSequential(["allocation/module.js"]);
    window.CPMountAllocation(container);
  }

  /* ============================================================
     Home dashboard
     ============================================================ */
  async function renderHome() {
    const hour = new Date().getHours();
    $("#homeGreet").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("#homeDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    await ensureDeparturesDataLoaded();
    const s = window.CP.state();
    const hasImport = !!s.dueouts;
    const checkRooms = hasImport ? window.CP.dep.checkRooms(s) : [];
    const stats = hasImport ? window.CP.dep.buildingStats(s) : null;
    const checkedOutToday = Object.keys((s.co && s.co.processed) || {}).length;

    let roomsSeen = 0;
    try { roomsSeen = JSON.parse(localStorage.getItem("rbab-recent") || "[]").length; } catch (e) {}

    // primary attention hero
    const heroEl = $("#homeAttn");
    if (!hasImport) {
      heroEl.innerHTML = `
        <div class="cp-attn-num cp-serif">—</div>
        <div class="cp-attn-label">No due-outs imported yet today</div>
        <div class="cp-attn-sub">Import the Opera export in Departures to see what still needs a physical check.</div>`;
    } else {
      const chips = window.CP.BUILDING_ORDER
        .filter(b => stats[b] && stats[b].total > 0)
        .map(b => `<span class="cp-attn-chip${stats[b].check > 0 ? " hot" : ""}">${b} · ${stats[b].check}</span>`)
        .join("");
      const mins = Math.round((Date.now() - s.dueouts.importedAt) / 60000);
      const freshness = mins < 1 ? "just now" : mins === 1 ? "1 min ago" : mins < 60 ? mins + " min ago" : Math.floor(mins / 60) + "h ago";
      heroEl.innerHTML = `
        <div class="cp-attn-num cp-serif">${checkRooms.length}</div>
        <div class="cp-attn-label">${checkRooms.length === 1 ? "room still needs a physical check" : "rooms still need a physical check"}</div>
        <div class="cp-attn-chips">${chips}</div>
        <div class="cp-attn-sub">Due-outs imported ${freshness}</div>`;
    }
    heroEl.onclick = () => { pendingSub = "departures"; location.hash = "#/departures"; };

    const secondary = [
      { num: checkedOutToday, label: "Checked out today" },
      { num: roomsSeen, label: "Rooms viewed recently" }
    ];
    $("#homeStats").innerHTML = secondary.map(st =>
      `<div class="cp-slab cp-stat-block"><div class="cp-stat-num cp-serif">${st.num}</div><div class="cp-stat-label">${st.label}</div></div>`
    ).join("");
  }

  /* ============================================================
     Command palette
     ============================================================ */
  let paletteIndex = [];
  function buildStaticIndex() {
    paletteIndex = [
      { label: "Home", tag: "page", route: "#/" },
      { label: "Room Guide", tag: "page", route: "#/roomguide" },
      { label: "Departures", tag: "page", route: "#/departures", sub: "departures" },
      { label: "Checkouts", tag: "page", route: "#/departures", sub: "checkouts" },
      { label: "Allocation Intelligence", tag: "page", route: "#/allocation" }
    ];
  }
  buildStaticIndex();

  async function ensureRoomIndex() {
    await ensureRoomDataLoaded();
  }

  function roomResults(query) {
    if (!window.RBAB_DATA) return [];
    const q = query.toUpperCase();
    const out = [];
    for (const bkey of RBAB_DATA.buildingOrder) {
      const rooms = RBAB_DATA.buildings[bkey].rooms;
      for (const num in rooms) {
        if (num.startsWith(query)) out.push({ label: "Room " + num, tag: RBAB_DATA.buildings[bkey].label, route: "#/roomguide", room: { bkey, num } });
        if (out.length > 8) return out;
      }
    }
    return out;
  }

  function openPalette() {
    $("#paletteOverlay").classList.add("show");
    $("#paletteInput").value = "";
    $("#paletteInput").focus();
    renderPaletteResults("");
    ensureRoomIndex();
  }
  function closePalette() { $("#paletteOverlay").classList.remove("show"); }

  function renderPaletteResults(query) {
    const q = query.trim();
    let results;
    if (!q) {
      results = paletteIndex;
    } else {
      results = paletteIndex.filter(r => r.label.toLowerCase().includes(q.toLowerCase()));
      if (/^\d+$/.test(q)) results = results.concat(roomResults(q));
    }
    const box = $("#paletteResults");
    if (!results.length) { box.innerHTML = '<div class="cp-palette-empty">No matches</div>'; return; }
    box.innerHTML = results.slice(0, 12).map((r, i) =>
      `<div class="cp-palette-item${i === 0 ? " active" : ""}" data-i="${i}"><span>${r.label}</span><span class="cp-palette-tag">${r.tag}</span></div>`
    ).join("");
    box.dataset.results = JSON.stringify(results.slice(0, 12));
    $$(".cp-palette-item", box).forEach(el => el.addEventListener("click", () => selectPaletteItem(+el.dataset.i)));
  }

  async function selectPaletteItem(i) {
    const results = JSON.parse($("#paletteResults").dataset.results || "[]");
    const r = results[i];
    if (!r) return;
    closePalette();
    pendingSub = r.sub || null;
    location.hash = r.route;
    if (r.room) {
      await ensureMounted("roomguide");
      setTimeout(() => { if (window.CPRoomGuideGoTo) window.CPRoomGuideGoTo(r.room.bkey, r.room.num); }, 60);
    }
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
    $("#printBtn").addEventListener("click", () => window.print());

    $("#searchTrigger").addEventListener("click", openPalette);
    $("#paletteOverlay").addEventListener("click", (e) => { if (e.target.id === "paletteOverlay") closePalette(); });
    $("#paletteInput").addEventListener("input", (e) => renderPaletteResults(e.target.value));
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") closePalette();
      else if (e.key === "Enter" && $("#paletteOverlay").classList.contains("show")) {
        const active = $(".cp-palette-item.active") || $(".cp-palette-item");
        if (active) selectPaletteItem(+active.dataset.i);
      }
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  setupAuth();
})();
