(function () {
  const PDFJS_SRC = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const XLSX_SRC = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
  const STATE_KEY = "checkpoint_alloc_v1";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let container = null;
  const slots = {
    confirmation: { label: "Confirmation / Reservation Export", accept: ".xls,.xlsx,.csv", kind: "excel", file: null, result: null },
    arrival: { label: "Arrival Report", accept: ".pdf", kind: "pdf", file: null, result: null },
    housekeeping: { label: "Housekeeping / Room Status Export", accept: ".xls,.xlsx,.csv", kind: "excel", file: null, result: null },
    alerts: { label: "Alerts Report", accept: ".pdf", kind: "pdf", file: null, result: null }
  };

  // ---------- persisted controller state (assignments, notes, dismissed flags) ----------
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function blankState() { return { day: todayStr(), manualAssign: {}, notes: {}, acknowledged: {} }; }
  let allocState;
  function loadState() {
    try { allocState = JSON.parse(localStorage.getItem(STATE_KEY)) || blankState(); } catch (e) { allocState = blankState(); }
    if (allocState.day !== todayStr()) allocState = blankState();
    const b = blankState();
    for (const k in b) if (allocState[k] === undefined) allocState[k] = b[k];
  }
  function saveState() { try { localStorage.setItem(STATE_KEY, JSON.stringify(allocState)); } catch (e) { /* storage full or blocked */ } }

  // ---------- library loading ----------
  let libLoadPromise = {};
  function loadLibOnce(key, src) {
    if (!libLoadPromise[key]) {
      libLoadPromise[key] = new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Couldn't load " + key + " from the CDN — check the connection."));
        document.body.appendChild(s);
      });
    }
    return libLoadPromise[key];
  }
  async function ensurePdfJs() {
    await loadLibOnce("pdfjs", PDFJS_SRC);
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  async function ensureXlsx() { await loadLibOnce("xlsx", XLSX_SRC); }

  // ---------- extraction ----------
  async function extractPdfText(file) {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
    let text = "";
    const lines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const rows = {};
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        (rows[y] = rows[y] || []).push(it);
      });
      const ys = Object.keys(rows).map(Number).sort((a, b) => b - a);
      const pageLines = ys.map(y => rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
      lines.push(...pageLines);
      text += `\n--- page ${i} ---\n` + pageLines.join("\n");
    }
    return { kind: "text", pages: pdf.numPages, text: text.trim(), lines };
  }

  function htmlTableToObjects(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;
    const trs = $$("tr", table);
    if (trs.length < 2) return null;
    const headers = $$("td,th", trs[0]).map(c => c.textContent.trim());
    const out = [];
    for (let i = 1; i < trs.length; i++) {
      const cells = $$("td,th", trs[i]);
      if (!cells.length) continue;
      const o = {};
      headers.forEach((h, idx) => { o[h] = cells[idx] ? cells[idx].textContent.trim() : ""; });
      out.push(o);
    }
    return out;
  }

  async function extractExcel(file) {
    // Opera's exports very often carry an .xls extension but are actually an HTML
    // table — sniff for that first so a real export never needs the XLSX CDN at all.
    const buf = await file.arrayBuffer();
    const head = new TextDecoder().decode(buf.slice(0, 800)).trim().toLowerCase();
    if (head.startsWith("<") || head.includes("<table") || head.includes("<html")) {
      const rows = htmlTableToObjects(new TextDecoder().decode(buf));
      if (rows && rows.length) return { kind: "rows", format: "html-table", rows };
      throw new Error("Found an HTML table in this file but couldn't read any rows from it.");
    }

    await ensureXlsx();
    const wb = window.XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
    if (rows.length) return { kind: "rows", format: "xlsx", sheet: sheetName, rows };
    throw new Error("Could not read this as a spreadsheet or an HTML table export.");
  }

  // ---------- header-flexible structured parsing (same approach as Departures) ----------
  const HEADERS_ARR = {
    conf: ["Confirmation Number", "Confirmation No", "Confirmation", "Conf No", "Conf", "Reservation Number", "Res No"],
    room: ["Room", "Room No", "Room Number", "Room #", "Assigned Room"],
    name: ["Name", "Guest Name", "Guest"],
    arrival: ["Arrival", "Arrival Date", "Arr Date", "Check In", "Check-In Date"],
    eta: ["ETA", "Arrival Time", "Time", "Exp Arrival Time"],
    departure: ["Departure", "Departure Date", "Dep Date", "Check Out", "Check-Out Date"],
    nights: ["Nights", "LOS", "Length Of Stay"],
    adults: ["Adults", "Adult", "Pax Adults"],
    children: ["Children", "Child", "Kids", "Pax Children"],
    roomType: ["Room Type", "Room Cat", "Room Category", "Booked Room Type"],
    rateCode: ["Rate Code", "Rate"],
    status: ["Reservation Status", "Status", "Res Status"],
    vip: ["VIP Code", "VIP"],
    memberType: ["Membership Type", "Loyalty Type"],
    memberLevel: ["Membership Level", "Loyalty Level", "Membership Tier"],
    ta: ["Travel Agent", "Agent", "TA"],
    company: ["Company", "Company Name"],
    notes: ["Remarks", "Comments", "Special Requests", "Guest Requests", "Notes", "Reservation Comments"]
  };
  const HEADERS_HK = {
    room: ["Room", "Room No", "Room Number", "Room #"],
    status: ["Housekeeping Status", "HK Status", "Room Status", "Status"],
    occ: ["Occupancy", "Occ Status", "Front Office Status", "Occupancy Status"],
    roomType: ["Room Type", "Room Cat"],
    notes: ["Remarks", "Comments", "Discrepancy", "Notes"]
  };

  function normalizeRows(objs, headersMap) {
    return objs.map(o => {
      const r = {};
      for (const k in headersMap) {
        const h = headersMap[k].find(h => Object.prototype.hasOwnProperty.call(o, h));
        r[k] = h ? String(o[h] ?? "").trim() : "";
      }
      if (r.room) r.room = r.room.replace(/\s+/g, "");
      return r;
    }).filter(r => r.room || r.name);
  }

  // A PDF report has no reliable column structure once extracted, so this doesn't
  // parse fields out of it — it just finds which lines mention which room number,
  // so any note on that line can be surfaced against the room as an unverified hint.
  const ROOM_NUM_RE = /(?<![\d:./])\d{4}(?![\d:/])/g;
  function scanRoomSnippets(lines) {
    const map = {};
    if (!lines) return map;
    lines.forEach(line => {
      const nums = line.match(ROOM_NUM_RE);
      if (!nums) return;
      nums.forEach(n => { (map[n] = map[n] || []).push(line); });
    });
    return map;
  }

  // ---------- housekeeping status classification ----------
  function classifyHK(raw) {
    const s = (raw || "").toUpperCase();
    if (!s) return "unknown";
    if (/OUT OF ORDER|OUT OF SERVICE|\bOOO\b|\bOOS\b/.test(s)) return "ooo";
    const occupied = /OCCUPIED|\bOCC\b|\bOD\b|\bOC\b/.test(s) && !/VACANT/.test(s);
    const dirty = /DIRTY|\bVD\b/.test(s) && !/CLEAN|INSPECT|READY/.test(s);
    const clean = /CLEAN|INSPECT|READY|\bVC\b|\bVR\b|\bCI\b/.test(s);
    if (occupied && dirty) return "occupied-dirty";
    if (occupied) return "occupied-clean";
    if (dirty) return "dirty";
    if (clean) return "clean";
    return "unknown";
  }
  const HK_LABEL = {
    clean: "Clean / inspected", "occupied-clean": "Occupied · clean", dirty: "Dirty",
    "occupied-dirty": "Occupied · dirty", ooo: "Out of order/service", unknown: "Status unknown"
  };

  // ---------- room inventory (from Room Guide's data, shared across the hub) ----------
  function buildInventoryIndex() {
    if (!window.RBAB_DATA) return null;
    const idx = {};
    window.RBAB_DATA.buildingOrder.forEach(bkey => {
      const b = window.RBAB_DATA.buildings[bkey];
      for (const num in b.rooms) idx[num] = Object.assign({ buildingKey: bkey, buildingLabel: b.label }, b.rooms[num]);
    });
    return idx;
  }

  // ---------- cross-check against today's Departures import ----------
  function departureConflict(room) {
    if (!room || !window.CP || !window.CP.state || !window.CP.dep) return null;
    const s = window.CP.state();
    if (!s.dueouts) return null;
    const row = s.dueouts.rows.find(r => r.room === room);
    if (!row) return null;
    const st = window.CP.roomStatus(row, s);
    if (st === "co" || st === "left") return null; // already cleared, no conflict
    return { name: row.name, status: window.CP.STATUS_LABEL[st] || st };
  }

  // ---------- suggestions for assigning a room ----------
  function suggestRooms(row, hkByRoom, inv, takenRooms) {
    if (!inv) return [];
    const wantType = (row.roomType || "").toUpperCase();
    let candidates = Object.keys(inv).filter(num => !wantType || (inv[num].type || "").toUpperCase() === wantType);
    if (takenRooms) candidates = candidates.filter(num => !takenRooms.has(num));
    const hasHK = Object.keys(hkByRoom).length > 0;
    if (hasHK) {
      const clean = candidates.filter(num => classifyHK((hkByRoom[num] || {}).status || (hkByRoom[num] || {}).occ) === "clean");
      if (clean.length) candidates = clean;
    }
    return candidates.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 10);
  }

  // ---------- building the board ----------
  const FLAG_META = {
    unassigned: { label: "Unassigned", cls: "warn" },
    notReady: { label: "Room not ready", cls: "danger" },
    ooo: { label: "Out of order", cls: "danger" },
    turnover: { label: "Turnover risk", cls: "warn" },
    typeMismatch: { label: "Type mismatch", cls: "warn" },
    vip: { label: "VIP", cls: "gold" },
    note: { label: "Note", cls: "neutral" }
  };

  function arrivalKey(row, idx) { return row.conf || (row.room ? "room:" + row.room : null) || "row:" + idx; }

  function buildBoard() {
    const confResult = slots.confirmation.result;
    const confRows = (confResult && confResult.kind === "rows") ? normalizeRows(confResult.rows, HEADERS_ARR) : [];
    const hkResult = slots.housekeeping.result;
    const hkRows = (hkResult && hkResult.kind === "rows") ? normalizeRows(hkResult.rows, HEADERS_HK) : [];
    const hkByRoom = {};
    hkRows.forEach(r => { if (r.room) hkByRoom[r.room] = r; });
    const arrivalSnips = (slots.arrival.result && slots.arrival.result.lines) ? scanRoomSnippets(slots.arrival.result.lines) : {};
    const alertSnips = (slots.alerts.result && slots.alerts.result.lines) ? scanRoomSnippets(slots.alerts.result.lines) : {};
    const inv = buildInventoryIndex();

    const arrivals = confRows.map((row, idx) => {
      const key = arrivalKey(row, idx);
      const room = row.room || allocState.manualAssign[key] || "";
      const isManual = !row.room && !!allocState.manualAssign[key];
      const invRoom = room && inv ? inv[room] : null;
      const hk = room ? hkByRoom[room] : null;
      const hkCat = room ? classifyHK((hk && hk.status) || (hk && hk.occ)) : "unknown";
      const conflict = room ? departureConflict(room) : null;
      const snips = room ? (alertSnips[room] || []).concat(arrivalSnips[room] || []) : [];
      const hasNote = snips.length > 0 || !!allocState.notes[key];
      const typeMismatch = !!(room && invRoom && row.roomType && invRoom.type && row.roomType.toUpperCase() !== invRoom.type.toUpperCase());

      const flags = [];
      if (!room) flags.push("unassigned");
      if (room && (hkCat === "dirty" || hkCat === "occupied-dirty")) flags.push("notReady");
      if (room && hkCat === "ooo") flags.push("ooo");
      if (conflict) flags.push("turnover");
      if (typeMismatch) flags.push("typeMismatch");
      if (row.vip || row.memberLevel) flags.push("vip");
      if (hasNote) flags.push("note");
      const activeFlags = flags.filter(f => !allocState.acknowledged[key + ":" + f]);

      return { key, row, room, isManual, invRoom, hk, hkCat, conflict, snips, hasNote, typeMismatch, flags, activeFlags };
    });

    return {
      arrivals, hkByRoom, inv,
      confAvailable: confRows.length > 0,
      hkAvailable: hkRows.length > 0,
      invAvailable: !!inv,
      depAvailable: !!(window.CP && window.CP.state && window.CP.state().dueouts)
    };
  }

  // ---------- rendering: upload slots ----------
  function renderSlot(key) {
    const slot = slots[key];
    const el = $(`#alloc-slot-${key}`, container);
    if (!slot.file) {
      el.innerHTML = `
        <div class="alloc-slot-label">${slot.label}</div>
        <div class="alloc-drop" data-key="${key}">
          <div class="alloc-drop-sub">Drop the ${slot.kind === "pdf" ? "PDF" : "export"} here, or choose the file</div>
          <input type="file" accept="${slot.accept}" id="alloc-input-${key}" hidden>
        </div>`;
      $(`.alloc-drop`, el).addEventListener("click", () => $(`#alloc-input-${key}`, el).click());
      $(`.alloc-drop`, el).addEventListener("dragover", e => { e.preventDefault(); el.querySelector(".alloc-drop").classList.add("over"); });
      $(`.alloc-drop`, el).addEventListener("dragleave", () => el.querySelector(".alloc-drop").classList.remove("over"));
      $(`.alloc-drop`, el).addEventListener("drop", e => {
        e.preventDefault(); el.querySelector(".alloc-drop").classList.remove("over");
        if (e.dataTransfer.files[0]) setFile(key, e.dataTransfer.files[0]);
      });
      $(`#alloc-input-${key}`, el).addEventListener("change", e => { if (e.target.files[0]) setFile(key, e.target.files[0]); });
    } else {
      const sizeKB = Math.round(slot.file.size / 1024);
      let statusLine = `<span class="alloc-file-status">Ready to extract</span>`;
      if (slot.result === "loading") statusLine = `<span class="alloc-file-status">Extracting…</span>`;
      else if (slot.result && slot.result.error) statusLine = `<span class="alloc-file-status err">${esc(slot.result.error)}</span>`;
      else if (slot.result && slot.result.kind === "text") statusLine = `<span class="alloc-file-status ok">${slot.result.pages} page(s) · ${slot.result.lines.length} line(s) extracted</span>`;
      else if (slot.result && slot.result.kind === "rows") statusLine = `<span class="alloc-file-status ok">${slot.result.rows.length} row(s) read (${slot.result.format})</span>`;

      el.innerHTML = `
        <div class="alloc-slot-label">${slot.label}</div>
        <div class="alloc-file">
          <div class="alloc-file-name">${esc(slot.file.name)} <span class="alloc-file-size">${sizeKB} KB</span></div>
          ${statusLine}
          <button class="alloc-icon-btn alloc-remove" data-key="${key}" title="Remove">✕</button>
        </div>
        ${slot.result && !slot.result.error ? `<button class="cp-btn alloc-preview-btn" data-preview="${key}">Show extracted preview</button><div class="alloc-preview" hidden><pre>${esc(previewText(slot.result))}</pre></div>` : ""}`;
      const removeBtn = $(".alloc-remove", el);
      if (removeBtn) removeBtn.addEventListener("click", () => { slot.file = null; slot.result = null; renderSlot(key); updateExtractBtn(); renderBoard(); });
      const previewBtn = $(`[data-preview="${key}"]`, el);
      if (previewBtn) previewBtn.addEventListener("click", () => {
        const pre = $(".alloc-preview", el);
        pre.hidden = !pre.hidden;
        previewBtn.textContent = pre.hidden ? "Show extracted preview" : "Hide extracted preview";
      });
    }
  }

  function previewText(result) {
    if (result.kind === "text") return result.lines.join("\n");
    if (result.kind === "rows") return result.rows.map(r => Object.values(r).join(" | ")).join("\n");
    return "";
  }

  function setFile(key, file) {
    slots[key].file = file;
    slots[key].result = null;
    renderSlot(key);
    updateExtractBtn();
  }

  function updateExtractBtn() {
    const btn = $("#allocExtractBtn", container);
    if (!btn) return;
    btn.disabled = !slots.confirmation.file;
  }

  async function runExtraction() {
    const btn = $("#allocExtractBtn", container);
    btn.disabled = true;
    for (const key of Object.keys(slots)) {
      const slot = slots[key];
      if (!slot.file) continue;
      slot.result = "loading";
      renderSlot(key);
      try {
        slot.result = slot.kind === "pdf" ? await extractPdfText(slot.file) : await extractExcel(slot.file);
      } catch (e) {
        slot.result = { error: e.message || "Extraction failed" };
      }
      renderSlot(key);
    }
    updateExtractBtn();
    renderBoard();
  }

  // ---------- rendering: the board ----------
  let filter = "all";
  let search = "";
  let lastBoard = null;

  function groupKey(a) {
    if (!a.room) return "Unassigned";
    if (a.invRoom) return a.invRoom.buildingLabel;
    return "Other";
  }
  const GROUP_ORDER = ["Unassigned", "Zumroud", "Amwaj", "Marmar", "Other"];

  function matchesFilter(a) {
    if (filter === "all") return true;
    if (filter === "unassigned") return !a.room;
    if (filter === "attention") return a.activeFlags.some(f => f !== "vip" && f !== "note");
    if (filter === "vip") return a.flags.includes("vip");
    return true;
  }
  function matchesSearch(a) {
    if (!search) return true;
    const q = search.toLowerCase();
    return [a.room, a.row.name, a.row.conf, a.row.ta, a.row.company].filter(Boolean).join(" ").toLowerCase().includes(q);
  }

  function arrivalCard(a) {
    const r = a.row;
    const badges = a.activeFlags.map(f => `<span class="alloc-flag f-${FLAG_META[f].cls}">${FLAG_META[f].label}</span>`).join("");
    const typeInfo = a.invRoom ? `${esc(a.invRoom.type)} — ${esc(a.invRoom.description)}` : (r.roomType ? esc(r.roomType) : "");
    const hkLine = a.room ? `<span class="alloc-hk h-${a.hkCat}">${HK_LABEL[a.hkCat]}</span>` : "";
    return `<button type="button" class="alloc-card" data-key="${esc(a.key)}">
      <div class="alloc-card-room ${a.isManual ? "manual" : ""}">${esc(a.room || "—")}</div>
      <div class="alloc-card-main">
        <div class="alloc-card-name">${esc(r.name || "Unnamed guest")}</div>
        <div class="alloc-card-meta">${[r.conf, r.arrival, r.nights ? r.nights + " nights" : "", [r.adults, r.children].filter(x => x !== "").join("+")].filter(Boolean).map(esc).join(" · ")}</div>
        ${typeInfo ? `<div class="alloc-card-type">${typeInfo}</div>` : ""}
      </div>
      <div class="alloc-card-side">${hkLine}<div class="alloc-flags">${badges}</div></div>
    </button>`;
  }

  function renderBoard() {
    const boardEl = $("#alloc-board", container);
    if (!boardEl) return;
    const board = buildBoard();
    lastBoard = board;

    if (!board.confAvailable) {
      boardEl.innerHTML = `<div class="alloc-banner cp-card">Upload and extract the Confirmation/Reservation export to build the arrivals board. Arrival Report, Alerts and Housekeeping exports enrich it but aren't required to start.</div>`;
      return;
    }

    const counts = { total: board.arrivals.length, unassigned: 0, attention: 0, vip: 0 };
    board.arrivals.forEach(a => {
      if (!a.room) counts.unassigned++;
      if (a.activeFlags.some(f => f !== "vip" && f !== "note")) counts.attention++;
      if (a.flags.includes("vip")) counts.vip++;
    });

    const shown = board.arrivals.filter(a => matchesFilter(a) && matchesSearch(a));
    const groups = {};
    shown.forEach(a => { const g = groupKey(a); (groups[g] = groups[g] || []).push(a); });
    const order = GROUP_ORDER.filter(g => groups[g]).concat(Object.keys(groups).filter(g => !GROUP_ORDER.includes(g)));

    let html = `<div class="alloc-summary">
      <div class="alloc-stat"><strong>${counts.total}</strong><span>Arrivals</span></div>
      <div class="alloc-stat ${counts.unassigned ? "warn" : ""}"><strong>${counts.unassigned}</strong><span>Unassigned</span></div>
      <div class="alloc-stat ${counts.attention ? "danger" : ""}"><strong>${counts.attention}</strong><span>Need attention</span></div>
      <div class="alloc-stat"><strong>${counts.vip}</strong><span>VIP / member</span></div>
    </div>`;
    if (!board.hkAvailable) html += `<div class="alloc-note-banner no-print">No housekeeping export uploaded — room-readiness and out-of-order flags can't be checked yet.</div>`;
    if (!board.depAvailable) html += `<div class="alloc-note-banner no-print">No Departures import loaded today — turnover conflicts against today's due-outs can't be checked yet.</div>`;

    html += `<div class="alloc-controls no-print">
      <div class="alloc-filters">
        ${[["all", "All"], ["unassigned", "Unassigned"], ["attention", "Needs attention"], ["vip", "VIP"]].map(([k, l]) =>
          `<button class="chip-alloc ${filter === k ? "on" : ""}" data-filter="${k}" type="button">${l}</button>`).join("")}
      </div>
      <input class="cp-input alloc-search" id="alloc-search" type="search" placeholder="Search room, guest, confirmation…" value="${esc(search)}">
    </div>`;

    html += `<div class="alloc-groups">` + order.map(g => `
      <div class="alloc-group">
        <h3 class="alloc-group-title">${esc(g)}<span>${groups[g].length}</span></h3>
        <div class="alloc-cards">${groups[g].map(arrivalCard).join("")}</div>
      </div>`).join("") + `</div>`;

    if (!shown.length) html += `<p class="alloc-empty">No arrivals match this filter.</p>`;

    boardEl.innerHTML = html;

    $$(".chip-alloc", boardEl).forEach(b => b.addEventListener("click", () => { filter = b.dataset.filter; renderBoard(); }));
    const searchInput = $("#alloc-search", boardEl);
    if (searchInput) searchInput.addEventListener("input", () => { search = searchInput.value; renderBoard(); });
    $$(".alloc-card", boardEl).forEach(c => c.addEventListener("click", () => openDetail(c.dataset.key)));
  }

  // ---------- detail sheet ----------
  function openDetail(key) {
    if (!lastBoard) return;
    const a = lastBoard.arrivals.find(x => x.key === key);
    if (!a) return;
    const r = a.row;
    const dlg = $("#alloc-sheet", container);
    const body = $("#alloc-sheet-body", container);

    const fields = [
      ["Guest", r.name], ["Confirmation", r.conf], ["Arrival", [r.arrival, r.eta].filter(Boolean).join(" ")],
      ["Nights", r.nights], ["Pax", [r.adults, r.children].filter(x => x !== "").join("+")],
      ["Room type requested", r.roomType], ["Rate code", r.rateCode], ["Reservation status", r.status],
      ["VIP", r.vip], ["Membership", [r.memberType, r.memberLevel].filter(Boolean).join(" ")],
      ["Travel agent", r.ta], ["Company", r.company], ["Confirmation notes", r.notes]
    ].filter(([, v]) => v);

    const invLine = a.invRoom ? `${esc(a.invRoom.type)} — ${esc(a.invRoom.description)}, floor ${esc(a.invRoom.floor)}${a.invRoom.connecting ? `, connects to ${esc(a.invRoom.connecting)}` : ""}` : "";
    const conflictLine = a.conflict ? `<div class="alloc-detail-alert">Currently occupied by ${esc(a.conflict.name || "a guest")} — departure status: ${esc(a.conflict.status)}. Confirm they've actually left before handing this room over.</div>` : "";
    const flagRow = a.activeFlags.length ? `<div class="alloc-detail-flags">${a.activeFlags.map(f => `<span class="alloc-flag f-${FLAG_META[f].cls}">${FLAG_META[f].label}<button data-ack="${f}" title="Dismiss">✕</button></span>`).join("")}</div>` : "";
    const snipsHtml = a.snips.length ? `<div class="alloc-detail-snips"><h4>Mentioned in Arrival/Alerts reports (unverified — check the source)</h4>${a.snips.slice(0, 6).map(s => `<p>${esc(s)}</p>`).join("")}</div>` : "";
    const takenRooms = new Set(lastBoard.arrivals.map(x => x.room).filter(Boolean));
    const suggestions = a.room ? [] : suggestRooms(r, lastBoard.hkByRoom, lastBoard.inv, takenRooms);

    body.innerHTML = `
      <div class="alloc-sheet-head">
        <div class="alloc-sheet-room">${esc(a.room || "Unassigned")}</div>
        <div><h2>${esc(r.name || "Unnamed guest")}</h2><p class="alloc-sheet-sub">${invLine || (r.roomType ? esc(r.roomType) : "")}</p></div>
        <button class="alloc-icon-btn" data-close type="button" aria-label="Close">✕</button>
      </div>
      ${conflictLine}
      ${flagRow}
      ${a.room ? `<div class="alloc-hk-line h-${a.hkCat}">${HK_LABEL[a.hkCat]}${a.hk && a.hk.status ? " — " + esc(a.hk.status) : ""}</div>` : ""}
      <dl class="alloc-facts">${fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      ${snipsHtml}
      <div class="alloc-assign">
        <label>${a.room ? "Reassign room" : "Assign room"}</label>
        <div class="alloc-assign-row">
          <input class="cp-input" id="alloc-assign-input" list="alloc-room-list" placeholder="Room number" value="${a.isManual ? esc(a.room) : ""}">
          <button class="cp-btn cp-btn-primary" id="alloc-assign-btn" type="button">${a.room ? "Update" : "Assign"}</button>
          ${a.isManual ? `<button class="cp-btn" id="alloc-unassign-btn" type="button">Clear</button>` : ""}
        </div>
        ${a.room && !a.isManual ? `<p class="alloc-hint">This room came from the Confirmation export — reassigning here is a working note only, it won't change Opera.</p>` : ""}
        ${suggestions.length ? `<datalist id="alloc-room-list">${suggestions.map(n => `<option value="${esc(n)}">`).join("")}</datalist><p class="alloc-hint">Suggested: ${suggestions.join(", ")}</p>` : ""}
      </div>
      <div class="alloc-note">
        <label for="alloc-note-input">Controller note</label>
        <textarea class="cp-input" id="alloc-note-input" rows="3">${esc(allocState.notes[key] || "")}</textarea>
        <button class="cp-btn" id="alloc-note-btn" type="button">Save note</button>
      </div>`;

    body.querySelector("[data-close]").onclick = () => closeSheet();
    $$("[data-ack]", body).forEach(b => b.onclick = () => {
      allocState.acknowledged[key + ":" + b.dataset.ack] = true;
      saveState();
      closeSheet();
      renderBoard();
    });
    $("#alloc-assign-btn", body).onclick = () => {
      const val = $("#alloc-assign-input", body).value.trim();
      if (val) allocState.manualAssign[key] = val; else delete allocState.manualAssign[key];
      saveState();
      closeSheet();
      renderBoard();
    };
    const unassignBtn = $("#alloc-unassign-btn", body);
    if (unassignBtn) unassignBtn.onclick = () => {
      delete allocState.manualAssign[key];
      saveState();
      closeSheet();
      renderBoard();
    };
    $("#alloc-note-btn", body).onclick = () => {
      const val = $("#alloc-note-input", body).value.trim();
      if (val) allocState.notes[key] = val; else delete allocState.notes[key];
      saveState();
      closeSheet();
      renderBoard();
    };

    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function closeSheet() {
    const dlg = $("#alloc-sheet", container);
    if (!dlg) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute("open");
  }

  // ---------- shell ----------
  function shell() {
    return `
      <div class="alloc-wrap">
        <div class="alloc-banner cp-card no-print">
          Upload today's exports to build the arrivals board: who's coming, which room they're in,
          whether that room is actually ready, and whether the current occupant has left yet.
          Anything pulled from a PDF report is shown as an unverified hint, never as fact — check it
          against the source before acting on it.
        </div>
        <div class="alloc-slots no-print">
          <div id="alloc-slot-confirmation"></div>
          <div id="alloc-slot-arrival"></div>
          <div id="alloc-slot-housekeeping"></div>
          <div id="alloc-slot-alerts"></div>
        </div>
        <div class="alloc-actions no-print">
          <button class="cp-btn cp-btn-primary" id="allocExtractBtn" disabled>Build board</button>
          <span class="alloc-hint">Confirmation/Reservation export is required to start.</span>
        </div>
        <div id="alloc-board"></div>
      </div>
      <dialog id="alloc-sheet"><div id="alloc-sheet-body"></div></dialog>`;
  }

  window.CPMountAllocation = function (mountContainer) {
    container = mountContainer;
    loadState();
    container.innerHTML = shell();
    Object.keys(slots).forEach(renderSlot);
    updateExtractBtn();
    renderBoard();
    $("#allocExtractBtn", container).addEventListener("click", runExtraction);
  };
})();
