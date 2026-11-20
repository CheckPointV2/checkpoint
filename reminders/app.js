/* CheckPoint — Reminders. Quick-add with natural-language time parsing,
   shift presets, snooze, and the data the shell's next-up ticker reads. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = "cp_reminders_v1";
  const CATEGORIES = ["Shift Task", "Follow-up", "Personal"];
  const SNOOZE_REASONS = ["Waiting on HK", "No answer", "Custom"];
  let container = null;
  let notifyAsked = false;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  const DEFAULT_PRESETS = {
    morning: { label: "Morning",
      weekday: [{ title: "Check overnight handover notes", time: "07:00" }, { title: "Verify early check-in rooms ready", time: "07:30" }, { title: "Confirm breakfast room status", time: "08:00" }],
      weekend: [{ title: "Check overnight handover notes", time: "07:00" }, { title: "Verify early check-in rooms ready", time: "07:15" }, { title: "Confirm breakfast room status", time: "07:45" }, { title: "Prep for high check-in volume", time: "08:30" }] },
    evening: { label: "Evening",
      weekday: [{ title: "Review late checkouts", time: "17:00" }, { title: "Confirm VIP arrivals tonight", time: "18:00" }],
      weekend: [{ title: "Review late checkouts", time: "17:00" }, { title: "Confirm VIP arrivals tonight", time: "18:00" }, { title: "Double-check overbooking status", time: "19:00" }] },
    night: { label: "Night",
      weekday: [{ title: "Lock front doors check", time: "23:00" }, { title: "Prepare morning handover notes", time: "05:30" }],
      weekend: [{ title: "Lock front doors check", time: "23:30" }, { title: "Security walk-through", time: "01:00" }, { title: "Prepare morning handover notes", time: "05:30" }] }
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.reminders) { raw.presets = raw.presets || JSON.parse(JSON.stringify(DEFAULT_PRESETS)); return raw; }
    } catch (e) {}
    return { reminders: [], presets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)) };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} window.CPRefreshTicker && window.CPRefreshTicker(); window.CPUpdateRailBadges && window.CPUpdateRailBadges(); }
  let state = load();

  /* ---------- natural-language quick add ---------- */
  function parseQuickAdd(text) {
    const now = new Date();
    let m = text.match(/\bin\s+(\d+)\s*(minutes?|mins?|m\b|hours?|hrs?|h\b)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const isHour = /^h/i.test(m[2]);
      const at = now.getTime() + n * (isHour ? 3600000 : 60000);
      const title = text.replace(m[0], "").trim().replace(/\s{2,}/g, " ");
      return { title: title || text.trim(), at };
    }
    m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (m) {
      const hour = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const meridiem = m[3] ? m[3].toLowerCase() : null;
      let candidates;
      if (meridiem === "am") candidates = [hour % 12];
      else if (meridiem === "pm") candidates = [(hour % 12) + 12];
      else if (hour > 12) candidates = [hour];
      // "at 12" with no am/pm means noon, not midnight (hour % 12 === 0) —
      // the modulo trick only makes sense for the genuinely ambiguous 1–11.
      else if (hour === 12) candidates = [12];
      else candidates = [hour, hour + 12];
      let best = null;
      candidates.forEach(h => [0, 1].forEach(dayOffset => {
        const d = new Date(now); d.setDate(d.getDate() + dayOffset); d.setHours(h, min, 0, 0);
        if (d.getTime() >= now.getTime() - 60000 && (!best || d.getTime() < best.getTime())) best = d;
      }));
      const title = text.replace(m[0], "").trim().replace(/\s{2,}/g, " ");
      return { title: title || text.trim(), at: best.getTime() };
    }
    return null;
  }

  function addReminder(patch) {
    state.reminders.unshift(Object.assign({
      id: uid(), title: "", category: "Shift Task", priority: "normal",
      recurring: null, done: false, doneAt: null, snoozedUntil: null, snoozeReason: null,
      createdAt: Date.now(), notified: false
    }, patch));
    save();
  }

  /* ---------- countdown ring ---------- */
  function ringSvg(r, progress, urgent) {
    const R = 15, C = 2 * Math.PI * R;
    const off = C * (1 - Math.max(0, Math.min(1, progress)));
    return `<svg class="rem-ring ${urgent ? 'pulse' : ''}" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="${R}" class="rem-ring-bg"/>
      <circle cx="18" cy="18" r="${R}" class="rem-ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${off}"/>
    </svg>`;
  }

  function fmtWhen(at) {
    const d = new Date(at);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return sameDay ? time : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + time;
  }

  function card(r) {
    const now = Date.now();
    const overdue = !r.done && r.at < now;
    const remainMin = Math.round((r.at - now) / 60000);
    const urgent = !r.done && !overdue && remainMin <= 15;
    const total = Math.max(1, r.at - r.createdAt);
    const progress = r.done ? 1 : (now - r.createdAt) / total;
    return `<div class="rem-card pri-${r.priority} ${r.done ? 'done' : ''} ${overdue ? 'overdue' : ''}" data-id="${r.id}">
      ${ringSvg(r, progress, urgent)}
      <div class="rem-body">
        <div class="rem-title-row">
          <span class="rem-title">${esc(r.title)}</span>
          <span class="cp-badge">${esc(r.category)}</span>
          ${r.recurring ? '<span class="cp-badge tone-info">Recurring</span>' : ''}
        </div>
        <div class="rem-meta">${overdue ? 'Overdue · ' : ''}${fmtWhen(r.at)}${r.snoozeReason ? ' · Snoozed: ' + esc(r.snoozeReason) : ''}</div>
      </div>
      <div class="rem-actions">
        ${!r.done ? `
          <button class="cp-icon-btn sm" data-snooze="${r.id}" data-min="10" type="button" title="Snooze 10m">10m</button>
          <button class="cp-icon-btn sm" data-snooze="${r.id}" data-min="30" type="button" title="Snooze 30m">30m</button>
          <button class="cp-icon-btn sm" data-snooze="${r.id}" data-min="60" type="button" title="Snooze 1h">1h</button>
          <button class="cp-icon-btn" data-done="${r.id}" type="button" aria-label="Mark done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></button>
        <button class="cp-icon-btn" data-edit="${r.id}" type="button" aria-label="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        ` : ''}
        <button class="cp-icon-btn" data-del="${r.id}" type="button" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>
      </div>
    </div>`;
  }

  function render() {
    const now = Date.now();
    const active = state.reminders.filter(r => !r.done);
    const overdue = active.filter(r => r.at < now).sort((a, b) => a.at - b.at);
    const upcoming = active.filter(r => r.at >= now).sort((a, b) => a.at - b.at);
    const done = state.reminders.filter(r => r.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 20);

    container.innerHTML = `
      <div class="rem-wrap">
        <header class="rem-head"><h1 class="cp-serif">Reminders</h1><p class="rem-head-sub">Quick add, e.g. "late checkout 1204 at 12" or "call Anex in 45 min".</p></header>

        <div class="rem-quickadd cp-card">
          <input class="cp-input" id="remQuick" type="text" placeholder="Quick add…" autocomplete="off">
          <div class="chips" id="remChips">
            <button class="chip" data-chip="15" type="button">+15m</button>
            <button class="chip" data-chip="30" type="button">+30m</button>
            <button class="chip" data-chip="60" type="button">+1h</button>
            <button class="chip" data-chip="eos" type="button">End of shift</button>
          </div>
        </div>

        <div class="rem-presets">
          ${Object.keys(state.presets).map(k => `<button class="cp-btn" data-preset="${k}" type="button">${esc(state.presets[k].label)} checklist</button>`).join("")}
          <button class="cp-btn" id="remEditPresets" type="button">Edit presets</button>
        </div>

        ${overdue.length ? `<section class="rem-section"><h2 class="rem-overdue-h">Overdue<span class="cp-count-badge">${overdue.length}</span></h2><div class="rem-list">${overdue.map(card).join("")}</div></section>` : ""}

        <section class="rem-section"><h2>Upcoming<span class="cp-count-badge">${upcoming.length}</span></h2>
          <div class="rem-list">${upcoming.map(card).join("") || '<p class="cp-empty-sm">Nothing on the list. Quick-add something above.</p>'}</div>
        </section>

        ${done.length ? `<section class="rem-section"><h2>Done</h2><div class="rem-list rem-list-done">${done.map(card).join("")}</div></section>` : ""}
      </div>`;

    bind();
  }

  function bind() {
    const input = $("#remQuick", container);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const text = input.value.trim();
      if (!text) return;
      const parsed = parseQuickAdd(text);
      if (parsed) { addReminder(parsed); input.value = ""; render(); requestNotifyPermission(); }
      else openManualPicker(text);
    });
    $$("[data-chip]", container).forEach(b => b.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      let at;
      if (b.dataset.chip === "eos") {
        const d = new Date(); d.setHours(23, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        at = d.getTime();
      } else at = Date.now() + parseInt(b.dataset.chip, 10) * 60000;
      addReminder({ title: text, at });
      input.value = ""; render(); requestNotifyPermission();
    }));

    $$("[data-preset]", container).forEach(b => b.addEventListener("click", () => applyPreset(b.dataset.preset)));
    $("#remEditPresets", container).addEventListener("click", openPresetEditor);

    $$("[data-done]", container).forEach(b => b.addEventListener("click", (e) => {
      const cardEl = e.target.closest(".rem-card");
      cardEl.classList.add("rem-striking");
      setTimeout(() => {
        const r = state.reminders.find(x => x.id === b.dataset.done);
        r.done = true; r.doneAt = Date.now();
        if (r.recurring) scheduleNextRecurrence(r);
        save(); render();
      }, window.CPMotionOK && window.CPMotionOK("subtle") ? 650 : 0);
    }));
    $$("[data-del]", container).forEach(b => b.addEventListener("click", () => {
      state.reminders = state.reminders.filter(x => x.id !== b.dataset.del); save(); render();
    }));
    $$("[data-snooze]", container).forEach(b => b.addEventListener("click", () => openSnooze(b.dataset.snooze, parseInt(b.dataset.min, 10))));
    $$("[data-edit]", container).forEach(b => b.addEventListener("click", () => openEditReminder(state.reminders.find(x => x.id === b.dataset.edit))));
  }

  function openEditReminder(r) {
    const d = new Date(r.at);
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">Edit reminder</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
        <input class="cp-input" id="erTitle" value="${esc(r.title)}">
        <div style="display:flex;gap:10px;">
          <input class="cp-input" id="erDate" type="date" value="${dateStr}" style="flex:1;">
          <input class="cp-input" id="erTime" type="time" value="${timeStr}" style="flex:1;">
        </div>
        <select class="cp-input" id="erCategory">${CATEGORIES.map(c => `<option ${c === r.category ? "selected" : ""}>${c}</option>`).join("")}</select>
        <div>
          <p class="cp-form-label">Priority</p>
          <div class="chips">${["normal", "important", "urgent"].map(p => `<button class="chip pri-chip pri-${p} ${r.priority === p ? "on" : ""}" data-pri="${p}" type="button">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}</div>
        </div>
        <div>
          <label class="check-row" style="display:flex;align-items:center;gap:8px;font-size:13px;"><input type="checkbox" id="erRecurring" ${r.recurring ? "checked" : ""}> Recurring</label>
          <div id="erRecurringOpts" style="display:${r.recurring ? "" : "none"};margin-top:8px;">
            <div class="chips">
              <button class="chip rec-type ${!r.recurring || r.recurring.type === "daily" ? "on" : ""}" data-rec="daily" type="button">Daily</button>
              <button class="chip rec-type ${r.recurring && r.recurring.type === "weekly" ? "on" : ""}" data-rec="weekly" type="button">Specific weekdays</button>
            </div>
            <div id="erWeekdays" class="chips" style="margin-top:8px;display:${r.recurring && r.recurring.type === "weekly" ? "" : "none"};">
              ${weekdayNames.map((n, i) => `<button class="chip day-chip ${r.recurring && r.recurring.type === "weekly" && r.recurring.days.includes(i) ? "on" : ""}" data-day="${i}" type="button">${n}</button>`).join("")}
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;"><button class="cp-btn cp-btn-primary" id="erSave" type="button">Save</button></div>`,
    (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      let priority = r.priority;
      $$(".pri-chip", el).forEach(b => b.addEventListener("click", () => { priority = b.dataset.pri; $$(".pri-chip", el).forEach(x => x.classList.toggle("on", x === b)); }));
      let recType = r.recurring ? r.recurring.type : "daily";
      $$(".rec-type", el).forEach(b => b.addEventListener("click", () => {
        recType = b.dataset.rec;
        $$(".rec-type", el).forEach(x => x.classList.toggle("on", x === b));
        $("#erWeekdays", el).style.display = recType === "weekly" ? "" : "none";
      }));
      $("#erRecurring", el).addEventListener("change", (e) => { $("#erRecurringOpts", el).style.display = e.target.checked ? "" : "none"; });
      $$(".day-chip", el).forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
      $("#erSave", el).onclick = () => {
        r.title = $("#erTitle", el).value.trim() || r.title;
        r.category = $("#erCategory", el).value;
        r.priority = priority;
        const [y, mo, da] = $("#erDate", el).value.split("-").map(Number);
        const [h, mi] = $("#erTime", el).value.split(":").map(Number);
        r.at = new Date(y, mo - 1, da, h, mi, 0, 0).getTime();
        r.notified = r.at > Date.now() ? false : r.notified;
        if ($("#erRecurring", el).checked) {
          if (recType === "daily") r.recurring = { type: "daily" };
          else r.recurring = { type: "weekly", days: $$(".day-chip.on", el).map(b => parseInt(b.dataset.day, 10)) };
        } else r.recurring = null;
        save(); close(); render();
      };
    });
  }

  function openManualPicker(prefillTitle) {
    const def = new Date(Date.now() + 30 * 60000);
    const hh = String(def.getHours()).padStart(2, "0"), mm = String(def.getMinutes()).padStart(2, "0");
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">Couldn't read a time — pick one</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
        <input class="cp-input" id="mpTitle" value="${esc(prefillTitle || "")}" placeholder="What's the reminder?">
        <input class="cp-input" id="mpTime" type="time" value="${hh}:${mm}">
        <select class="cp-input" id="mpCategory">${CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select>
      </div>
      <div style="margin-top:14px;"><button class="cp-btn cp-btn-primary" id="mpSave" type="button">Add reminder</button></div>`,
    (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      $("#mpSave", el).onclick = () => {
        const title = $("#mpTitle", el).value.trim(); if (!title) return;
        const [h, m] = $("#mpTime", el).value.split(":").map(Number);
        const d = new Date(); d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        addReminder({ title, at: d.getTime(), category: $("#mpCategory", el).value });
        close(); render(); requestNotifyPermission();
      };
    });
  }

  function openSnooze(id, mins) {
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">Snooze ${mins} min</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <p style="font-size:12.5px;color:var(--ink-soft);margin:10px 0 6px;">Reason (optional)</p>
      <div class="chips" id="snoozeReasons">${SNOOZE_REASONS.map(r => `<button class="chip" data-reason="${esc(r)}" type="button">${esc(r)}</button>`).join("")}</div>
      <input class="cp-input" id="snoozeCustom" placeholder="Custom reason" style="margin-top:10px;display:none;">
      <div style="margin-top:14px;"><button class="cp-btn cp-btn-primary" id="snoozeGo" type="button">Snooze</button></div>`,
    (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      let reason = "";
      $$("[data-reason]", el).forEach(b => b.addEventListener("click", () => {
        $$("[data-reason]", el).forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        if (b.dataset.reason === "Custom") { $("#snoozeCustom", el).style.display = ""; $("#snoozeCustom", el).focus(); reason = ""; }
        else { $("#snoozeCustom", el).style.display = "none"; reason = b.dataset.reason; }
      }));
      $("#snoozeGo", el).onclick = () => {
        const custom = $("#snoozeCustom", el).value.trim();
        const r = state.reminders.find(x => x.id === id);
        r.at = Date.now() + mins * 60000;
        r.snoozeReason = custom || reason || null;
        save(); close(); render();
      };
    });
  }

  function scheduleNextRecurrence(r) {
    const next = Object.assign({}, r, { id: uid(), done: false, doneAt: null, notified: false, snoozeReason: null, createdAt: Date.now() });
    const d = new Date(r.at);
    if (r.recurring.type === "daily") d.setDate(d.getDate() + 1);
    else if (r.recurring.type === "weekly") {
      const days = r.recurring.days.slice().sort((a, b) => a - b);
      let added = false;
      for (let i = 1; i <= 7; i++) {
        const cand = new Date(r.at); cand.setDate(cand.getDate() + i);
        if (days.includes(cand.getDay())) { d.setTime(cand.getTime()); added = true; break; }
      }
      if (!added) return;
    }
    next.at = d.getTime();
    state.reminders.push(next);
  }

  function applyPreset(key) {
    const preset = state.presets[key];
    const dow = new Date().getDay(); // 0 Sun..6 Sat
    const isWeekday = dow >= 1 && dow <= 4; // Mon-Thu
    const items = isWeekday ? preset.weekday : preset.weekend;
    const now = Date.now();
    items.forEach(it => {
      const [h, m] = it.time.split(":").map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d.getTime() < now - 3 * 3600000) d.setDate(d.getDate() + 1);
      addReminder({ title: it.title, at: d.getTime(), category: "Shift Task" });
    });
    window.CPToast && window.CPToast(`${preset.label} checklist added (${isWeekday ? "weekday" : "weekend"})`);
    render();
  }

  function openPresetEditor() {
    const keys = Object.keys(state.presets);
    let activeKey = keys[0], activeVariant = "weekday";
    function body() {
      const list = state.presets[activeKey][activeVariant];
      return list.map(it => `${it.time} ${it.title}`).join("\n");
    }
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">Edit shift presets</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="chips" id="presetKeyChips" style="margin-top:10px;">${keys.map(k => `<button class="chip ${k === activeKey ? 'on' : ''}" data-k="${k}" type="button">${esc(state.presets[k].label)}</button>`).join("")}</div>
      <div class="chips" id="presetVariantChips" style="margin-top:6px;">
        <button class="chip on" data-v="weekday" type="button">Weekday (Mon–Thu)</button>
        <button class="chip" data-v="weekend" type="button">Weekend (Fri–Sun)</button>
      </div>
      <p style="font-size:12px;color:var(--ink-soft);margin:10px 0 4px;">One per line: <code>HH:MM Title</code></p>
      <textarea class="cp-input" id="presetBody" rows="8" style="font-family:monospace;font-size:12.5px;">${esc(body())}</textarea>
      <div style="margin-top:14px;"><button class="cp-btn cp-btn-primary" id="presetSave" type="button">Save</button></div>`,
    (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      const textarea = $("#presetBody", el);
      function refresh() { textarea.value = body(); }
      $$("[data-k]", el).forEach(b => b.addEventListener("click", () => {
        activeKey = b.dataset.k;
        $$("[data-k]", el).forEach(x => x.classList.toggle("on", x === b));
        refresh();
      }));
      $$("[data-v]", el).forEach(b => b.addEventListener("click", () => {
        activeVariant = b.dataset.v;
        $$("[data-v]", el).forEach(x => x.classList.toggle("on", x === b));
        refresh();
      }));
      $("#presetSave", el).onclick = () => {
        const lines = textarea.value.split("\n").map(l => l.trim()).filter(Boolean);
        const parsed = lines.map(l => {
          const m = l.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
          return m ? { time: m[1], title: m[2] } : null;
        }).filter(Boolean);
        state.presets[activeKey][activeVariant] = parsed;
        save();
      };
    });
  }

  /* ---------- notifications + chime, and ticking ---------- */
  function requestNotifyPermission() {
    if (notifyAsked || !("Notification" in window)) return;
    notifyAsked = true;
    if (Notification.permission === "default") Notification.requestPermission();
  }

  let lastTick = 0;
  function tick() {
    const now = Date.now();
    state.reminders.forEach(r => {
      if (r.done || r.notified) return;
      if (r.at <= now) {
        r.notified = true;
        window.CPPlaySound && window.CPPlaySound("chime");
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification("CheckPoint reminder", { body: r.title }); } catch (e) {}
        }
      }
    });
    save();
    if (container && document.getElementById("view-reminders") && document.getElementById("view-reminders").classList.contains("active")) render();
    window.CPRefreshTicker && window.CPRefreshTicker();
  }
  setInterval(tick, 20000);

  /* ---------- shell-wide read API (next-up ticker, rail badge) ---------- */
  window.CPReminders = {
    getNext() {
      const now = Date.now();
      const active = state.reminders.filter(r => !r.done).sort((a, b) => a.at - b.at);
      return active[0] || null;
    },
    overdueCount() {
      const now = Date.now();
      return state.reminders.filter(r => !r.done && r.at < now).length;
    },
    // Read by Notes' end-of-day export — the one deliberate cross-tool
    // link the brief itself asks for (section 7: "Export includes the
    // day's reminders... and notes").
    exportData() {
      return {
        done: state.reminders.filter(r => r.done),
        pending: state.reminders.filter(r => !r.done).sort((a, b) => a.at - b.at)
      };
    }
  };

  window.CPMountReminders = function (mountContainer) {
    container = mountContainer;
    state = load();
    render();
    setTimeout(() => { const i = $("#remQuick", container); if (i) i.focus(); }, 50);
  };
})();
