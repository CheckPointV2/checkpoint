/* CheckPoint — Dashboard.
   Answers one question: what needs attention right now? Reads Departures'
   and Allocation's already-exposed state (CP.*, window.CPAlloc) rather than
   tracking anything of its own — this screen has no state, only a view. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let container = null;

  const ICONS = {
    overdue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    arrival: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M14 20c0-3 2-5 5-5"/></svg>',
    room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    vip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>'
  };

  function go(hash) { location.hash = hash; }

  function item(tone, icon, title, meta, hash) {
    return `<button class="dash-item tone-${tone}" type="button" data-go="${esc(hash)}">
      <span class="dash-item-icon">${ICONS[icon] || ""}</span>
      <span class="dash-item-body"><span class="dash-item-title">${esc(title)}</span><span class="dash-item-meta">${esc(meta)}</span></span>
      <span class="dash-item-arrow">→</span>
    </button>`;
  }

  function lane(key, label, sub, items, emptyText) {
    return `<section class="dash-lane tone-${key}">
      <header class="dash-lane-head">
        <h2>${esc(label)}</h2>
        ${items.length ? `<span class="dash-lane-count">${items.length}</span>` : ""}
      </header>
      <p class="dash-lane-sub">${esc(sub)}</p>
      ${items.length ? `<div class="dash-lane-list">${items.join("")}</div>` : `<p class="dash-lane-empty">${esc(emptyText)}</p>`}
    </section>`;
  }

  function build() {
    const hasCP = window.CP && window.CP.state && window.CP.dep;
    const hasAlloc = !!window.CPAlloc;
    const s = hasCP ? window.CP.state() : null;
    const rows = hasCP && s.dueouts ? window.CP.dep.activeRows(s) : [];
    const analysis = hasAlloc ? window.CPAlloc.getAnalysis() : null;

    const urgent = [], today = [], watch = [];
    let clearedRooms = 0, processedCheckouts = 0;

    if (hasCP && s.dueouts) {
      rows.forEach(r => {
        const st = window.CP.roomStatus(r, s);
        if (st === "check") {
          const u = window.CP.dep.checkUrgency(r);
          if (u === "overdue") {
            urgent.push(item("danger", "overdue", "Room " + r.room, "Overdue for physical check" + (r.etd ? " — ETD " + r.etd : ""), "#/departures"));
          } else if (u === "soon") {
            watch.push(item("warn", "overdue", "Room " + r.room, "Due for check within 15 min", "#/departures"));
          }
        } else if (st === "co" || st === "left") {
          clearedRooms++;
        }
      });
      const toCheck = window.CP.dep.checkRooms(s).length;
      if (toCheck) today.push(item("ink", "room", toCheck + " room" + (toCheck === 1 ? "" : "s") + " to check", "Physical check still open today", "#/departures"));
      const vips = window.CP.dep.vipRows(s);
      if (vips.length) today.push(item("ink", "vip", vips.length + " VIP/member departure" + (vips.length === 1 ? "" : "s"), "Worth a personal check-out today", "#/departures"));

      window.CP.dep.linkedGroups(s).filter(g => g.staying.length).forEach(g => {
        watch.push(item("warn", "group", g.leadName || "Linked group", "Lead reservation not on today's due-outs — rest of the group may be staying on", "#/departures"));
      });
    }
    if (hasCP && window.CP.unprocessedCheckouts) {
      const unproc = window.CP.unprocessedCheckouts().length;
      if (unproc) today.push(item("ink", "check", unproc + " checkout" + (unproc === 1 ? "" : "s") + " to process in Opera", "Logged in Formatting, not yet marked processed", "#/departures"));
      processedCheckouts = (s && s.co) ? Object.keys(s.co.processed || {}).length : 0;
    }

    if (analysis) {
      analysis.items.forEach(it => {
        if (it.tier === "high") {
          const reasonText = (it.reasons[0] && it.reasons[0].text) || "Flagged high priority";
          urgent.push(item("danger", "arrival", it.record.name || "Unnamed guest", reasonText, "#/arrivals"));
        } else if (it.tier === "medium") {
          const reasonText = (it.reasons[0] && it.reasons[0].text) || "Flagged for review";
          watch.push(item("warn", "arrival", it.record.name || "Unnamed guest", reasonText, "#/arrivals"));
        }
      });
      if (analysis.totalArrivals) today.push(item("ink", "arrival", analysis.totalArrivals + " arrival" + (analysis.totalArrivals === 1 ? "" : "s") + " imported today", (analysis.items.length - analysis.items.filter(i => !i.tier).length) + " flagged for review", "#/arrivals"));
      analysis.groups.filter(g => g.connectivity.checked && !g.connectivity.allConnected).forEach(g => {
        watch.push(item("warn", "group", g.leadName || "Linked group", "Not every assigned room connects to another member's room", "#/arrivals"));
      });
    }

    const sections = [
      lane("danger", "Urgent", "Needs action before anything else this shift.", urgent,
        hasCP || hasAlloc ? "Nothing urgent right now." : "Import a due-out export or an arrivals file to see what's urgent."),
      lane("ink", "Today", "The shape of today's shift.", today, "Nothing imported yet today."),
      lane("warn", "Watch", "Not urgent yet — keep an eye on these.", watch, "Nothing to watch."),
    ];

    const clearHtml = `<section class="dash-lane tone-ok dash-lane-clear">
      <header class="dash-lane-head"><h2>Clear</h2></header>
      <div class="dash-clear-row">
        <div class="dash-clear-stat"><strong>${clearedRooms}</strong><span>rooms cleared</span></div>
        <div class="dash-clear-stat"><strong>${processedCheckouts}</strong><span>checkouts processed</span></div>
      </div>
    </section>`;

    return sections.join("") + clearHtml;
  }

  function render() {
    const hh = new Date();
    const greeting = hh.getHours() < 12 ? "Good morning" : hh.getHours() < 18 ? "Good afternoon" : "Good evening";
    container.innerHTML = `
      <div class="dash-wrap">
        <header class="dash-head">
          <div>
            <h1 class="cp-serif">${greeting}</h1>
            <p class="dash-head-sub">Here's what your shift looks like right now.</p>
          </div>
          <div class="dash-clock" id="dashClock"></div>
        </header>
        <div class="dash-lanes">${build()}</div>
      </div>`;
    container.addEventListener("click", e => {
      const btn = e.target.closest("[data-go]");
      if (btn) location.hash = btn.dataset.go;
    });
    tickClock();
  }

  function tickClock() {
    const el = $("#dashClock", container);
    if (!el) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
    el.innerHTML = `<span class="dash-clock-time">${hh}:${mm}</span><span class="dash-clock-date">${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>`;
  }

  let tickHandle = null;
  window.CPMountDashboard = function (mountContainer) {
    container = mountContainer;
    render();
    if (window.CP && window.CP.onChange) window.CP.onChange(render);
    if (window.CPAlloc) window.CPAlloc.onChange(render);
    if (!tickHandle) tickHandle = setInterval(() => { if ($("#dashClock", container)) tickClock(); }, 15000);
  };
})();
