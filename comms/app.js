/* CheckPoint — Templates (Communication). Messaging colleagues, not
   guests: lean, fast, one-click copy formatted for the channel. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = "cp_comms_v1";
  const CATEGORIES = ["Handover", "HK Request", "Maintenance Request", "Room Move", "VIP Heads-up", "Late Checkout", "Follow-up", "General"];
  let container = null;
  let filterChannel = "all";
  let filterCategory = "all";
  let searchQ = "";

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function seed() {
    return {
      templates: [
        { id: uid(), title: "Shift handover", category: "Handover", channel: "whatsapp", subject: "", body: "Handover for {time}:\n- Room {room}: {name}\n- Status: ", favorite: true, createdAt: Date.now() },
        { id: uid(), title: "Housekeeping — please service", category: "HK Request", channel: "whatsapp", subject: "", body: "HK please service room {room} — guest {name} requested it for {time}.", favorite: false, createdAt: Date.now() },
        { id: uid(), title: "Maintenance issue", category: "Maintenance Request", channel: "both", subject: "Maintenance needed — Room {room}", body: "Room {room} needs maintenance: {issue}. Guest {name} is aware. Please advise ETA.", favorite: false, createdAt: Date.now() },
        { id: uid(), title: "Room move request", category: "Room Move", channel: "whatsapp", subject: "", body: "Please move {name} from room {room} to {newroom}. Reason: {reason}.", favorite: false, createdAt: Date.now() },
        { id: uid(), title: "VIP arrival heads-up", category: "VIP Heads-up", channel: "both", subject: "VIP arriving — {name}, Room {room}", body: "Heads-up: {name} (VIP) arriving {time}, room {room}. Please prepare amenities.", favorite: true, createdAt: Date.now() },
        { id: uid(), title: "Late checkout confirmed", category: "Late Checkout", channel: "whatsapp", subject: "", body: "Late checkout confirmed for room {room} until {time}.", favorite: false, createdAt: Date.now() },
        { id: uid(), title: "Following up", category: "Follow-up", channel: "whatsapp", subject: "", body: "Following up on room {room} — {name}. Any update?", favorite: false, createdAt: Date.now() },
        { id: uid(), title: "General note to team", category: "General", channel: "whatsapp", subject: "", body: "Note: ", favorite: false, createdAt: Date.now() }
      ],
      snippets: [
        { id: uid(), text: "On it, checking now.", favorite: true },
        { id: uid(), text: "Confirmed, thank you.", favorite: false },
        { id: uid(), text: "Can you confirm room number?", favorite: false }
      ],
      recent: []
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.templates) return raw;
    } catch (e) {}
    const s = seed();
    save(s);
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  let state = load();

  function placeholdersIn(t) {
    const set = new Set();
    (t.subject + " " + t.body).replace(/\{(\w+)\}/g, (m, p1) => { set.add(p1); return m; });
    return Array.from(set);
  }
  function fill(text, values) {
    return text.replace(/\{(\w+)\}/g, (m, p1) => (values[p1] != null && values[p1] !== "") ? values[p1] : m);
  }

  function touchRecent(id) {
    state.recent = [{ id, at: Date.now() }].concat(state.recent.filter(r => r.id !== id)).slice(0, 8);
    save(state);
  }

  function emailText(t, values) {
    const subj = fill(t.subject || t.title, values);
    const body = fill(t.body, values);
    return `Subject: ${subj}\n\n${body}`;
  }
  function waText(t, values) { return fill(t.body, values); }

  function doCopy(t, channel, values, btn) {
    const text = channel === "email" ? emailText(t, values) : waText(t, values);
    window.CPCopy(text, `Copied for ${channel === "email" ? "Email" : "WhatsApp"}`, btn);
    touchRecent(t.id);
    render();
  }
  function doOpen(t, channel, values) {
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(waText(t, values))}`, "_blank");
    } else {
      const subj = encodeURIComponent(fill(t.subject || t.title, values));
      const body = encodeURIComponent(fill(t.body, values));
      location.href = `mailto:?subject=${subj}&body=${body}`;
    }
    touchRecent(t.id);
    render();
  }

  // Templates with {placeholders} need values first — a tiny inline form,
  // not a full page, since this has to stay fast for something used
  // constantly mid-shift.
  function withValues(t, then) {
    const ph = placeholdersIn(t);
    if (!ph.length) { then({}); return; }
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div><h2 style="margin:0 0 4px;font-family:var(--font-display);font-size:19px;">${CP_esc(t.title)}</h2><p style="margin:0;font-size:12.5px;color:var(--ink-soft);">Fill in the details, then copy or open.</p></div>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="tpl-form" style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
        ${ph.map(p => `<label style="display:block;"><span style="display:block;font-size:12px;color:var(--ink-soft);margin-bottom:4px;text-transform:capitalize;">${CP_esc(p)}</span><input class="cp-input" data-ph="${CP_esc(p)}" autocomplete="off"></label>`).join("")}
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
        <button class="cp-btn cp-btn-primary" data-go type="button">Continue</button>
      </div>`, (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      const inputs = $$("[data-ph]", el);
      if (inputs[0]) setTimeout(() => inputs[0].focus(), 30);
      el.querySelector("[data-go]").onclick = () => {
        const values = {};
        inputs.forEach(i => { values[i.dataset.ph] = i.value.trim(); });
        close();
        then(values);
      };
    });
  }

  function CP_esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function channelBadges(ch) {
    if (ch === "both") return '<span class="cp-badge tone-info">Email</span><span class="cp-badge tone-ok">WhatsApp</span>';
    if (ch === "email") return '<span class="cp-badge tone-info">Email</span>';
    return '<span class="cp-badge tone-ok">WhatsApp</span>';
  }

  function templateCard(t) {
    const ph = placeholdersIn(t);
    return `<div class="tpl-card cp-card" data-id="${t.id}">
      <div class="tpl-card-head">
        <div class="tpl-card-title-wrap">
          <button class="tpl-star ${t.favorite ? "on" : ""}" data-star="${t.id}" type="button" aria-label="${t.favorite ? "Unfavorite" : "Favorite"}">
            <svg viewBox="0 0 24 24" fill="${t.favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18l-5.9 3.3 1.2-6.6-4.8-4.7 6.6-.9z"/></svg>
          </button>
          <h3 class="tpl-title">${CP_esc(t.title)}</h3>
        </div>
        <span class="cp-badge">${CP_esc(t.category)}</span>
      </div>
      <div class="tpl-badges">${channelBadges(t.channel)}${ph.length ? `<span class="cp-badge tone-warn">${ph.length} field${ph.length > 1 ? "s" : ""}</span>` : ""}</div>
      <p class="tpl-preview">${CP_esc(t.body).slice(0, 140)}${t.body.length > 140 ? "…" : ""}</p>
      <div class="tpl-actions">
        ${t.channel !== "email" ? `<button class="cp-btn cp-btn-primary" data-copy="${t.id}" data-ch="whatsapp" type="button">Copy</button>` : `<button class="cp-btn cp-btn-primary" data-copy="${t.id}" data-ch="email" type="button">Copy</button>`}
        ${t.channel === "both" ? `<button class="cp-btn" data-copy="${t.id}" data-ch="email" type="button">Copy (Email)</button>` : ""}
        ${t.channel !== "email" ? `<button class="cp-btn" data-open="${t.id}" data-ch="whatsapp" type="button">Open in WhatsApp</button>` : ""}
        ${t.channel !== "whatsapp" ? `<button class="cp-btn" data-open="${t.id}" data-ch="email" type="button">Open in Email</button>` : ""}
        <div class="tpl-actions-sep"></div>
        <button class="cp-icon-btn" data-edit="${t.id}" type="button" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        <button class="cp-icon-btn" data-dup="${t.id}" type="button" aria-label="Duplicate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="cp-icon-btn" data-del="${t.id}" type="button" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
      </div>
    </div>`;
  }

  function snippetRow(s) {
    return `<div class="tpl-snippet" data-id="${s.id}">
      <button class="tpl-star sm ${s.favorite ? "on" : ""}" data-snip-star="${s.id}" type="button" aria-label="Favorite"><svg viewBox="0 0 24 24" fill="${s.favorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18l-5.9 3.3 1.2-6.6-4.8-4.7 6.6-.9z"/></svg></button>
      <span class="tpl-snippet-text">${CP_esc(s.text)}</span>
      <button class="cp-icon-btn sm" data-snip-copy="${s.id}" type="button" aria-label="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      <button class="cp-icon-btn sm" data-snip-del="${s.id}" type="button" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
    </div>`;
  }

  function matchesFilter(t) {
    if (filterChannel !== "all" && t.channel !== "all" && !(t.channel === filterChannel || t.channel === "both")) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (searchQ && !(t.title + t.body + t.category).toLowerCase().includes(searchQ)) return false;
    return true;
  }

  function topFavorites() { return state.templates.filter(t => t.favorite).slice(0, 9); }

  function render() {
    const cats = Array.from(new Set(CATEGORIES.concat(state.templates.map(t => t.category))));
    const favs = state.templates.filter(t => t.favorite);
    const recentTemplates = state.recent.map(r => state.templates.find(t => t.id === r.id)).filter(Boolean);
    const shown = state.templates.filter(matchesFilter);

    container.innerHTML = `
      <div class="tpl-wrap">
        <header class="tpl-head">
          <div><h1 class="cp-serif">Templates</h1><p class="tpl-head-sub">One-click messages for colleagues — not guests. Keys 1–9 copy your top favorites.</p></div>
          <button class="cp-btn cp-btn-primary" id="tplNew" type="button">New template</button>
        </header>

        <div class="tpl-filters">
          <div class="chips" id="tplChannelChips">
            ${["all", "email", "whatsapp"].map(c => `<button class="chip ${filterChannel === c ? "on" : ""}" data-channel="${c}" type="button">${c === "all" ? "All" : c === "email" ? "Email" : "WhatsApp"}</button>`).join("")}
          </div>
          <select class="cp-input tpl-cat-select" id="tplCatSelect" style="width:auto;">
            <option value="all">All categories</option>
            ${cats.map(c => `<option value="${CP_esc(c)}" ${filterCategory === c ? "selected" : ""}>${CP_esc(c)}</option>`).join("")}
          </select>
          <input class="cp-input tpl-search" id="tplSearch" type="search" placeholder="Search templates" value="${CP_esc(searchQ)}">
        </div>

        ${favs.length ? `<section class="tpl-section"><h2>Favorites</h2><div class="tpl-grid">${favs.map(templateCard).join("")}</div></section>` : ""}
        ${recentTemplates.length ? `<section class="tpl-section"><h2>Recently used</h2><div class="tpl-grid">${recentTemplates.map(templateCard).join("")}</div></section>` : ""}

        <section class="tpl-section">
          <h2>Quick snippets</h2>
          <div class="tpl-snippets" id="tplSnippets">${state.snippets.map(snippetRow).join("") || '<p class="cp-empty-sm">No snippets yet.</p>'}</div>
          <button class="cp-btn" id="tplAddSnippet" type="button">Add snippet</button>
        </section>

        <section class="tpl-section">
          <h2>All templates<span class="cp-count-badge">${shown.length}</span></h2>
          <div class="tpl-grid">${shown.map(templateCard).join("") || '<p class="cp-empty-sm">No templates match.</p>'}</div>
        </section>
      </div>`;

    bind();
  }

  function openEditor(existing) {
    const t = existing || { id: null, title: "", category: CATEGORIES[0], channel: "whatsapp", subject: "", body: "", favorite: false };
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:19px;">${existing ? "Edit template" : "New template"}</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="tpl-form" style="margin-top:14px;display:flex;flex-direction:column;gap:12px;">
        <label><span class="cp-form-label">Title</span><input class="cp-input" id="fTitle" value="${CP_esc(t.title)}"></label>
        <div style="display:flex;gap:12px;">
          <label style="flex:1;"><span class="cp-form-label">Category</span>
            <input class="cp-input" id="fCategory" list="fCategoryList" value="${CP_esc(t.category)}">
            <datalist id="fCategoryList">${CATEGORIES.map(c => `<option value="${CP_esc(c)}">`).join("")}</datalist>
          </label>
          <label style="flex:1;"><span class="cp-form-label">Channel</span>
            <select class="cp-input" id="fChannel">
              <option value="whatsapp" ${t.channel === "whatsapp" ? "selected" : ""}>WhatsApp</option>
              <option value="email" ${t.channel === "email" ? "selected" : ""}>Email</option>
              <option value="both" ${t.channel === "both" ? "selected" : ""}>Both</option>
            </select>
          </label>
        </div>
        <label id="fSubjectWrap" style="${t.channel === "whatsapp" ? "display:none;" : ""}"><span class="cp-form-label">Email subject</span><input class="cp-input" id="fSubject" value="${CP_esc(t.subject)}"></label>
        <label><span class="cp-form-label">Body — use {name}, {room}, {time} etc. for placeholders</span><textarea class="cp-input" id="fBody" rows="6">${CP_esc(t.body)}</textarea></label>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button class="cp-btn cp-btn-primary" id="fSave" type="button">Save</button>
        <button class="cp-btn" data-close type="button">Cancel</button>
      </div>`, (el, close) => {
      el.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
      const chSel = $("#fChannel", el);
      chSel.addEventListener("change", () => { $("#fSubjectWrap", el).style.display = chSel.value === "whatsapp" ? "none" : ""; });
      $("#fSave", el).onclick = () => {
        const title = $("#fTitle", el).value.trim();
        if (!title) { $("#fTitle", el).focus(); return; }
        const patch = {
          title, category: $("#fCategory", el).value.trim() || "General",
          channel: chSel.value, subject: $("#fSubject", el).value.trim(), body: $("#fBody", el).value
        };
        if (existing) Object.assign(existing, patch);
        else state.templates.unshift(Object.assign({ id: uid(), favorite: false, createdAt: Date.now() }, patch));
        save(state); close(); render();
      };
    });
  }

  function bind() {
    $("#tplNew", container).addEventListener("click", () => openEditor(null));
    $$("[data-channel]", container).forEach(b => b.addEventListener("click", () => { filterChannel = b.dataset.channel; render(); }));
    $("#tplCatSelect", container).addEventListener("change", (e) => { filterCategory = e.target.value; render(); });
    $("#tplSearch", container).addEventListener("input", (e) => { searchQ = e.target.value.toLowerCase(); render(); });

    $$("[data-star]", container).forEach(b => b.addEventListener("click", () => {
      const t = state.templates.find(x => x.id === b.dataset.star); t.favorite = !t.favorite; save(state); render();
    }));
    $$("[data-copy]", container).forEach(b => b.addEventListener("click", () => {
      const t = state.templates.find(x => x.id === b.dataset.copy);
      withValues(t, (values) => doCopy(t, b.dataset.ch, values, b));
    }));
    $$("[data-open]", container).forEach(b => b.addEventListener("click", () => {
      const t = state.templates.find(x => x.id === b.dataset.open);
      withValues(t, (values) => doOpen(t, b.dataset.ch, values));
    }));
    $$("[data-edit]", container).forEach(b => b.addEventListener("click", () => openEditor(state.templates.find(x => x.id === b.dataset.edit))));
    $$("[data-dup]", container).forEach(b => b.addEventListener("click", () => {
      const t = state.templates.find(x => x.id === b.dataset.dup);
      state.templates.unshift(Object.assign({}, t, { id: uid(), title: t.title + " (copy)", favorite: false, createdAt: Date.now() }));
      save(state); render();
    }));
    $$("[data-del]", container).forEach(b => b.addEventListener("click", () => {
      const t = state.templates.find(x => x.id === b.dataset.del);
      window.CPConfirm("Delete this template?", `"${CP_esc(t.title)}" will be removed for good.`, "Delete", () => {
        state.templates = state.templates.filter(x => x.id !== t.id); save(state); render();
      });
    }));

    $("#tplAddSnippet", container).addEventListener("click", () => {
      window.CPSheet(`
        <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">Add snippet</h2>
          <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        <textarea class="cp-input" id="snipText" rows="3" style="margin-top:12px;" placeholder="Short one-liner"></textarea>
        <div style="display:flex;gap:10px;margin-top:14px;"><button class="cp-btn cp-btn-primary" id="snipSave" type="button">Add</button></div>`,
      (el, close) => {
        el.querySelector("[data-close]").onclick = close;
        setTimeout(() => $("#snipText", el).focus(), 30);
        $("#snipSave", el).onclick = () => {
          const v = $("#snipText", el).value.trim();
          if (!v) return;
          state.snippets.unshift({ id: uid(), text: v, favorite: false });
          save(state); close(); render();
        };
      });
    });
    $$("[data-snip-copy]", container).forEach(b => b.addEventListener("click", () => {
      const s = state.snippets.find(x => x.id === b.dataset.snipCopy);
      window.CPCopy(s.text, "Snippet copied", b);
    }));
    $$("[data-snip-star]", container).forEach(b => b.addEventListener("click", () => {
      const s = state.snippets.find(x => x.id === b.dataset.snipStar); s.favorite = !s.favorite; save(state); render();
    }));
    $$("[data-snip-del]", container).forEach(b => b.addEventListener("click", () => {
      state.snippets = state.snippets.filter(x => x.id !== b.dataset.snipDel); save(state); render();
    }));
  }

  document.addEventListener("keydown", (e) => {
    if (window.CPActiveTool !== "comms") return;
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    if (document.querySelector(".cp-modal-overlay.show")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const favs = topFavorites();
      const t = favs[n - 1];
      if (t) { e.preventDefault(); withValues(t, (values) => doCopy(t, t.channel === "email" ? "email" : "whatsapp", values)); }
    }
  });

  window.CPMountComms = function (mountContainer) {
    container = mountContainer;
    state = load();
    render();
  };
})();
