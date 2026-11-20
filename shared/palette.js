/* CheckPoint — command palette (Ctrl/Cmd+K), keyboard shortcuts overlay
   ("?"), focus mode (F), and the "rixos" easter egg. Global, shell-level:
   works from any tool, not just one. */
(function () {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const ROUTES = [
    { label: "Home", hash: "#/home" },
    { label: "Room Guide", hash: "#/roomguide" },
    { label: "Departures", hash: "#/departures" },
    { label: "Reports", hash: "#/reports" },
    { label: "Templates", hash: "#/comms" },
    { label: "Reminders", hash: "#/reminders" },
    { label: "Notes", hash: "#/notes" },
    { label: "Settings", hash: "#/settings" }
  ];

  const SHORTCUTS = [
    ["Ctrl/Cmd + K", "Command palette"],
    ["Ctrl/Cmd + Shift + N", "Open scratchpad"],
    ["F", "Focus mode (hide sidebar + top bar)"],
    ["?", "This shortcuts list"],
    ["1–9", "In Templates: copy a favorite · In Reminders: (see card actions)"],
    ["Esc", "Close any panel, or exit focus mode"]
  ];

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function itemsFor(query) {
    const q = query.trim().toLowerCase();
    const items = ROUTES.map(r => ({ label: r.label, hint: "Go to", run: () => { location.hash = r.hash; } }));

    let templates = [];
    try { templates = (JSON.parse(localStorage.getItem("cp_comms_v1")) || {}).templates || []; } catch (e) {}
    templates.forEach(t => items.push({ label: t.title, hint: "Template", run: () => { location.hash = "#/comms"; } }));

    let notes = [];
    try { notes = (JSON.parse(localStorage.getItem("cp_notes_v1")) || {}).notes || []; } catch (e) {}
    notes.forEach(n => { if (n.text) items.push({ label: n.text.split("\n")[0].slice(0, 60), hint: "Note", run: () => { location.hash = "#/notes"; } }); });

    if (!q) return items.slice(0, 8);
    return items.filter(i => i.label.toLowerCase().includes(q));
  }

  function openPalette() {
    window.CPSheet(`
      <div class="palette">
        <input id="cpPalQ" class="cp-input pal-input" placeholder="Jump to a tool, template, or note…" autocomplete="off" spellcheck="false">
        <ul id="cpPalList" class="pal-list" role="listbox"></ul>
      </div>`, (el, close) => {
      const q = el.querySelector("#cpPalQ"), ul = el.querySelector("#cpPalList");
      let sel = 0, shown = [];
      const draw = () => {
        const raw = q.value;
        if (raw.trim().toLowerCase() === "rixos") { fireConfetti(); }
        shown = itemsFor(raw);
        sel = Math.min(sel, Math.max(0, shown.length - 1));
        ul.innerHTML = shown.map((c, i) => `<li role="option" aria-selected="${i === sel}" data-i="${i}"><span>${esc(c.label)}</span><em>${esc(c.hint)}</em></li>`).join("") || `<li class="pal-none">No match.</li>`;
      };
      const runSel = (i) => { const c = shown[i]; if (!c) return; close(); c.run(); };
      q.addEventListener("input", () => { sel = 0; draw(); });
      q.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
        else if (e.key === "Enter") { e.preventDefault(); runSel(sel); }
      });
      ul.addEventListener("click", e => { const li = e.target.closest("[data-i]"); if (li) runSel(+li.dataset.i); });
      draw();
      setTimeout(() => q.focus(), 20);
    });
  }
  window.CPOpenPalette = openPalette;

  function openShortcuts() {
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:19px;">Keyboard shortcuts</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <table class="shortcuts-table">${SHORTCUTS.map(([k, v]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(v)}</td></tr>`).join("")}</table>`,
    (el, close) => { el.querySelector("[data-close]").onclick = close; });
  }

  /* ---------- focus mode ---------- */
  function toggleFocusMode() {
    const app = document.getElementById("mainApp");
    if (!app) return;
    app.classList.toggle("cp-focus-mode");
  }

  /* ---------- rixos easter egg: gold confetti ---------- */
  function fireConfetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wrap = document.createElement("div");
    wrap.className = "cp-confetti-wrap";
    document.body.appendChild(wrap);
    const colors = ["#D2AC76", "#C9A24B", "#E7C98F", "#6B4E33"];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("span");
      p.className = "cp-confetti-piece";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + "s";
      p.style.animationDuration = (2 + Math.random() * 1.5) + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(p);
    }
    setTimeout(() => wrap.remove(), 4000);
  }

  document.addEventListener("keydown", (e) => {
    const typing = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (typing(document.activeElement) || document.querySelector(".cp-modal-overlay.show")) return;
    if (e.key === "?") { e.preventDefault(); openShortcuts(); return; }
    if (e.key === "Escape" && document.getElementById("mainApp").classList.contains("cp-focus-mode")) { toggleFocusMode(); return; }
    if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey) { toggleFocusMode(); }
  });
})();
