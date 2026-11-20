/* CheckPoint — Notes: freeform, markdown-lite, tags, search, list/grid,
   handover template, a scratchpad drawer reachable from anywhere, and the
   end-of-day close-shift export (reads Reminders' store too — the one
   deliberate cross-tool link the brief itself asks for). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = "cp_notes_v1";
  const ARCHIVE_KEY = "cp_archive_v1";
  const TAGS = ["Shift", "Guest situation", "Personal"];
  const COLORS = ["", "yellow", "blue", "green", "pink"];
  let container = null;
  let view = "list"; // list | grid
  let searchQ = "";
  let activeTagFilter = null;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function load() {
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.notes) return raw; } catch (e) {}
    return { notes: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  let state = load();

  /* ---------- markdown-lite ---------- */
  function renderMD(text) {
    const lines = esc(text).split("\n");
    let html = "", inList = false;
    const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
    lines.forEach(line => {
      const bold = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^#\s+/.test(bold)) { closeList(); html += `<h4>${bold.replace(/^#\s+/, "")}</h4>`; return; }
      const cb = bold.match(/^\[( |x|X)?\]\s*(.*)$/);
      if (cb) { closeList(); html += `<div class="note-cb ${cb[1] && cb[1].toLowerCase() === "x" ? "checked" : ""}"><span class="note-cb-box"></span>${cb[2]}</div>`; return; }
      if (/^-\s+/.test(bold)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${bold.replace(/^-\s+/, "")}</li>`; return; }
      closeList();
      if (bold.trim() === "") { html += "<br>"; } else { html += `<p>${bold}</p>`; }
    });
    closeList();
    return html;
  }

  function fmtDate(ts) { return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }

  function matches(n) {
    if (activeTagFilter && !(n.tags || []).includes(activeTagFilter)) return false;
    if (searchQ && !((n.text || "") + (n.tags || []).join(" ")).toLowerCase().includes(searchQ)) return false;
    return true;
  }

  function noteCard(n) {
    return `<div class="note-card ${n.color ? "clr-" + n.color : ""} ${n.pinned ? "pinned" : ""}" data-id="${n.id}">
      <div class="note-card-top">
        <div class="note-tags">${(n.tags || []).map(t => `<span class="cp-badge">${esc(t)}</span>`).join("")}</div>
        <div class="note-card-actions">
          <button class="cp-icon-btn sm" data-pin="${n.id}" type="button" aria-label="Pin" title="${n.pinned ? "Unpin" : "Pin"}"><svg viewBox="0 0 24 24" fill="${n.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"><path d="M12 17v5M5 9l7-7 7 7-3 2v4H8v-4z"/></svg></button>
          <button class="cp-icon-btn sm" data-del="${n.id}" type="button" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
        </div>
      </div>
      <div class="note-view" data-view-note="${n.id}">${renderMD(n.text) || '<p class="cp-empty-sm">Click to write…</p>'}</div>
      <textarea class="note-textarea" data-edit="${n.id}" hidden>${esc(n.text)}</textarea>
      <div class="note-card-foot">
        <div class="note-colors">${COLORS.map(c => `<button class="note-color-dot ${c || "none"} ${n.color === c ? "on" : ""}" data-color="${n.id}" data-c="${c}" type="button" aria-label="${c || "No color"}"></button>`).join("")}</div>
        <span class="note-updated">${fmtDate(n.updatedAt)}</span>
      </div>
    </div>`;
  }

  function render() {
    const pinned = state.notes.filter(n => n.pinned && matches(n));
    const rest = state.notes.filter(n => !n.pinned && matches(n)).sort((a, b) => b.updatedAt - a.updatedAt);
    const allTags = Array.from(new Set(TAGS.concat(state.notes.flatMap(n => n.tags || []))));

    container.innerHTML = `
      <div class="notes-wrap">
        <header class="notes-head">
          <div><h1 class="cp-serif">Notes</h1><p class="notes-head-sub">Freeform, autosaved. "#" heading, "-" bullet, "[]" checkbox, **bold**.</p></div>
          <div class="notes-head-actions">
            <button class="cp-btn" id="notesHandover" type="button">Handover</button>
            <button class="cp-btn" id="notesCloseShift" type="button">Close Shift</button>
            <button class="cp-btn cp-btn-primary" id="notesNew" type="button">New note</button>
          </div>
        </header>

        <div class="notes-filters">
          <div class="chips">
            <button class="chip ${view === "list" ? "on" : ""}" data-view="list" type="button">List</button>
            <button class="chip ${view === "grid" ? "on" : ""}" data-view="grid" type="button">Grid</button>
          </div>
          <div class="chips" id="notesTagChips">
            <button class="chip ${!activeTagFilter ? "on" : ""}" data-tag="" type="button">All tags</button>
            ${allTags.map(t => `<button class="chip ${activeTagFilter === t ? "on" : ""}" data-tag="${esc(t)}" type="button">${esc(t)}</button>`).join("")}
          </div>
          <input class="cp-input notes-search" id="notesSearch" type="search" placeholder="Search notes" value="${esc(searchQ)}">
        </div>

        <div class="notes-list view-${view}">
          ${pinned.length ? `<div class="notes-pinned-label">Pinned</div>` : ""}
          ${pinned.map(noteCard).join("")}
          ${pinned.length ? `<div class="notes-pinned-sep"></div>` : ""}
          ${rest.map(noteCard).join("") || (pinned.length ? "" : '<p class="cp-empty-sm">No notes yet — start one above.</p>')}
        </div>
      </div>`;

    bind();
  }

  let saveTimer = null;
  function scheduleSave(n, el) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      n.updatedAt = Date.now();
      save();
      const foot = el.closest(".note-card").querySelector(".note-updated");
      if (foot) { foot.textContent = "Saved"; setTimeout(() => { foot.textContent = fmtDate(n.updatedAt); }, 1200); }
    }, 600);
  }

  function bind() {
    $("#notesNew", container).addEventListener("click", () => {
      const n = { id: uid(), text: "", tags: [], color: "", pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
      state.notes.unshift(n); save(); render();
      setTimeout(() => startEditing(n.id), 30);
    });
    $$("[data-view]", container).forEach(b => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
    $$("[data-tag]", container).forEach(b => b.addEventListener("click", () => { activeTagFilter = b.dataset.tag || null; render(); }));
    $("#notesSearch", container).addEventListener("input", (e) => { searchQ = e.target.value.toLowerCase(); render(); });

    $$("[data-view-note]", container).forEach(el => {
      el.addEventListener("click", () => startEditing(el.dataset.viewNote));
    });
    $$("[data-edit]", container).forEach(el => {
      el.addEventListener("blur", () => stopEditing(el));
      el.addEventListener("input", () => {
        const n = state.notes.find(x => x.id === el.dataset.edit);
        n.text = el.value;
        scheduleSave(n, el);
      });
    });
    $$("[data-pin]", container).forEach(b => b.addEventListener("click", () => { const n = state.notes.find(x => x.id === b.dataset.pin); n.pinned = !n.pinned; save(); render(); }));
    $$("[data-del]", container).forEach(b => b.addEventListener("click", () => {
      window.CPConfirm("Delete this note?", "This can't be undone.", "Delete", () => { state.notes = state.notes.filter(x => x.id !== b.dataset.del); save(); render(); });
    }));
    $$("[data-color]", container).forEach(b => b.addEventListener("click", () => { const n = state.notes.find(x => x.id === b.dataset.color); n.color = b.dataset.c; save(); render(); }));

    $("#notesHandover", container).addEventListener("click", openHandover);
    $("#notesCloseShift", container).addEventListener("click", openCloseShift);
  }

  function startEditing(id) {
    const card = container.querySelector(`.note-card[data-id="${id}"]`);
    if (!card) return;
    card.querySelector(".note-view").hidden = true;
    const ta = card.querySelector(".note-textarea");
    ta.hidden = false;
    ta.style.height = Math.max(60, ta.scrollHeight) + "px";
    ta.focus();
  }
  function stopEditing(ta) {
    const card = ta.closest(".note-card");
    ta.hidden = true;
    const n = state.notes.find(x => x.id === ta.dataset.edit);
    card.querySelector(".note-view").innerHTML = renderMD(n.text) || '<p class="cp-empty-sm">Click to write…</p>';
    card.querySelector(".note-view").hidden = false;
  }

  /* ---------- handover template ---------- */
  function openHandover() {
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:19px;">Handover</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="handover-form">
        <label><span class="cp-form-label">Issues</span><textarea class="cp-input" id="hoIssues" rows="3"></textarea></label>
        <label><span class="cp-form-label">Pending follow-ups</span><textarea class="cp-input" id="hoFollow" rows="3"></textarea></label>
        <label><span class="cp-form-label">Notes for next shift</span><textarea class="cp-input" id="hoNotes" rows="3"></textarea></label>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="cp-btn cp-btn-primary" id="hoCopy" type="button">Copy for WhatsApp</button>
        <button class="cp-btn" id="hoSave" type="button">Save as note</button>
      </div>`, (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      const build = () => {
        const issues = $("#hoIssues", el).value.trim() || "None";
        const follow = $("#hoFollow", el).value.trim() || "None";
        const notes = $("#hoNotes", el).value.trim() || "None";
        return `Handover — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}\n\nIssues:\n${issues}\n\nPending follow-ups:\n${follow}\n\nNotes for next shift:\n${notes}`;
      };
      $("#hoCopy", el).onclick = (e) => { window.CPCopy(build(), "Handover copied", e.currentTarget); };
      $("#hoSave", el).onclick = () => {
        state.notes.unshift({ id: uid(), text: build(), tags: ["Shift"], color: "", pinned: false, createdAt: Date.now(), updatedAt: Date.now() });
        save(); close(); render();
      };
    });
  }

  /* ---------- close shift / end of day export ---------- */
  function pruneArchive() {
    const days = (window.CPPrefs ? window.CPPrefs.get().archiveDays : 7) || 7;
    let arch = [];
    try { arch = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch (e) {}
    arch = arch.filter(a => Date.now() - a.date < days * 86400000);
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arch)); } catch (e) {}
    return arch;
  }

  function buildExportText() {
    const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    let remDone = [], remPending = [];
    if (window.CPReminders && window.CPReminders.exportData) {
      const d = window.CPReminders.exportData();
      remDone = d.done; remPending = d.pending;
    }
    let out = `${dateStr}\n\n`;
    out += `Reminders\n`;
    out += remPending.length ? remPending.map(r => `  [ ] ${r.title} — ${new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`).join("\n") + "\n" : "  None pending\n";
    out += remDone.length ? remDone.map(r => `  [x] ${r.title}`).join("\n") + "\n" : "";
    out += `\nNotes\n`;
    out += state.notes.length ? state.notes.map(n => "  - " + (n.text || "").split("\n")[0]).join("\n") : "  None";
    return out;
  }

  function openCloseShift() {
    window.CPSheet(`
      <div class="close-shift-anim" id="csAnim">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="cs-check"><path d="M5 13l4 4L19 7"/></svg>
        <p>Wrapping up the shift…</p>
      </div>`, (el) => {
      setTimeout(() => showExportOptions(el), window.CPMotionOK && window.CPMotionOK("subtle") ? 900 : 100);
    });
  }
  function showExportOptions(el) {
    pruneArchive();
    const text = buildExportText();
    el.innerHTML = `
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:19px;">Shift closed</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <pre class="cs-preview">${esc(text)}</pre>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
        <button class="cp-btn cp-btn-primary" id="csWhatsapp" type="button">Copy for WhatsApp</button>
        <button class="cp-btn" id="csText" type="button">Download .txt</button>
        <button class="cp-btn" id="csPdf" type="button">Save as PDF</button>
      </div>`;
    el.querySelector("[data-close]").onclick = window.CPCloseSheet;
    $("#csWhatsapp", el).onclick = (e) => window.CPCopy(text, "Copied for WhatsApp", e.currentTarget);
    $("#csText", el).onclick = () => {
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `checkpoint-shift-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
    };
    $("#csPdf", el).onclick = () => printExport(text);

    let archive = [];
    try { archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || []; } catch (e) {}
    archive.push({ date: Date.now(), text });
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)); } catch (e) {}
  }
  function printExport(text) {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>CheckPoint — Shift summary</title><style>body{font-family:Georgia,serif;white-space:pre-wrap;padding:40px;line-height:1.6;}</style></head><body>${esc(text)}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 200);
  }

  /* ---------- shell-wide read API ---------- */
  window.CPNotes = { getAll: () => load().notes };
  // Called by shared/scratchpad.js after it saves a note directly to the
  // same localStorage key, so an already-mounted Notes view (cached by the
  // router, not re-rendered on revisit) doesn't show stale content.
  window.CPNotesRefresh = function () { if (container) { state = load(); render(); } };

  window.CPMountNotes = function (mountContainer) {
    container = mountContainer;
    state = load();
    render();
  };
})();
