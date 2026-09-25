(function () {
  const PDFJS_SRC = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const XLSX_SRC = "https://cdn.sheetjs.com/xlsx-0.18.7/package/dist/xlsx.full.min.js";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  // String(s ?? "") rather than (s || ""): Room Guide's room numbers are
  // stored as actual numbers (1041, not "1041"), and a bare `s || ""` leaves
  // a truthy number as a number, whose .replace() doesn't exist and throws.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  let container = null;
  const slots = {
    arrival: { label: "Arrival Report", accept: ".pdf", kind: "pdf", file: null, result: null },
    confirmation: { label: "Confirmation / Reservation Export", accept: ".xls,.xlsx,.csv", kind: "excel", file: null, result: null },
    alerts: { label: "Alerts Report", accept: ".pdf", kind: "pdf", file: null, result: null }
  };
  let analysis = null; // set by runAnalysis() once a Confirmation export has been extracted

  // ---------- Arrivals list: filters + search ----------
  // Independent toggles, AND-combined — "VIP" + "Connecting" shows arrivals
  // that are both, matching Room Guide's own filter-chip convention so the
  // app has one filtering idiom, not two.
  const ARR_FILTER_DEFS = [
    { key: "high", label: "High priority", test: (it) => it.tier === "high" },
    { key: "vip", label: "VIP", test: (it) => !!it.record.vip },
    { key: "needsRoom", label: "Needs allocation", test: (it) => !!it.record.needsRoom },
    { key: "special", label: "Special request", test: (it) => it.reasons.some(r => r.id === "occasion" || r.id === "view-request" || r.id === "floor-preference") },
    { key: "connecting", label: "Connecting", test: (it) => it.reasons.some(r => r.id === "connecting-requested") },
    { key: "early", label: "Early arrival", test: (it) => it.reasons.some(r => r.id === "early-arrival") },
    { key: "roomReady", label: "Room ready", test: (it) => arrivalRoomState(it.record) === "ready" },
    { key: "roomNotReady", label: "Room not ready", test: (it) => arrivalRoomState(it.record) === "not-ready" }
  ];
  let arrFilters = new Set();
  let arrSearch = "";

  // Whether an arrival's already-assigned room is actually free per today's
  // live due-out signal from Departures — "ready" only when Departures has
  // positive confirmation, never assumed from silence.
  function arrivalRoomState(record) {
    if (!record.room) return "unassigned";
    const CP = window.CP;
    if (!CP || !CP.state) return "unknown";
    const s = CP.state();
    if (!s.dueouts) return "unknown";
    const row = CP.rowByRoom(record.room, s);
    if (!row) return "unknown";
    const st = CP.roomStatus(row, s);
    return (st === "co" || st === "left") ? "ready" : "not-ready";
  }

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
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }
  }
  async function ensureXlsx() {
    await loadLibOnce("xlsx", XLSX_SRC);
  }

  async function extractPdfText(file) {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += `\n--- page ${i} ---\n` + content.items.map(it => it.str).join(" ");
    }
    if (!text.trim()) throw new Error("No text could be read from this PDF — if it's a scanned image rather than a text report, this can't read it.");
    return { kind: "text", pages: pdf.numPages, text: text.trim() };
  }

  // Header row -> objects keyed by header, the same shape departures/js/departures.js's
  // own parseHTMLText() produces, so the rest of the pipeline (normalizeArrivals)
  // doesn't need to care whether a row came from a real .xlsx or an HTML table
  // Opera happened to save with an .xls extension.
  function htmlTableToObjects(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;
    const rows = $$("tr", table);
    if (rows.length < 2) return null;
    const headers = $$("th,td", rows[0]).map(c => c.textContent.trim());
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = $$("td", rows[i]);
      if (!cells.length) continue;
      const o = {};
      headers.forEach((h, idx) => { o[h] = cells[idx] ? cells[idx].textContent.trim() : ""; });
      out.push(o);
    }
    return out;
  }

  async function extractExcel(file) {
    // Opera's exports sometimes carry an .xls extension but are actually an HTML table.
    // Try a real spreadsheet parse first; fall back to treating it as HTML — including
    // when the fallback is needed because the CDN itself couldn't be reached, not just
    // when the file turns out not to be a real spreadsheet. The HTML path needs no
    // network at all, so a flaky connection shouldn't take it down too.
    const buf = await file.arrayBuffer();
    try {
      await ensureXlsx();
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
      if (rows.length) return { kind: "rows", format: "xlsx", sheet: sheetName, rows };
    } catch (e) { /* fall through to the dependency-free HTML attempt */ }

    const text = new TextDecoder().decode(buf);
    const rows = htmlTableToObjects(text);
    if (rows && rows.length) return { kind: "rows", format: "html-table", rows };

    throw new Error("Could not read this as a spreadsheet or an HTML table export.");
  }

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
      if (slot.result === "loading") statusLine = `<span class="alloc-file-status"><span class="cp-spinner" aria-hidden="true"></span> Extracting…</span>`;
      else if (slot.result && slot.result.error) statusLine = `<span class="alloc-file-status err">${esc(slot.result.error)}</span>`;
      else if (slot.result && slot.result.kind === "text") statusLine = `<span class="alloc-file-status ok">${slot.result.pages} page(s) · ${slot.result.text.length.toLocaleString()} characters extracted</span>`;
      else if (slot.result && slot.result.kind === "rows") statusLine = `<span class="alloc-file-status ok">${slot.result.rows.length} row(s) read (${slot.result.format})</span>`;

      el.innerHTML = `
        <div class="alloc-slot-label">${slot.label}</div>
        <div class="alloc-file">
          <div class="alloc-file-name">${esc(slot.file.name)} <span class="alloc-file-size">${sizeKB} KB</span></div>
          ${statusLine}
          <button class="alloc-remove" data-key="${key}" title="Remove" aria-label="Remove file" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        ${slot.result && !slot.result.error ? `<details class="alloc-raw"><summary>Raw extracted text</summary><div class="alloc-preview"><pre>${esc(previewText(slot.result))}</pre></div><button class="cp-btn" data-copy="${key}" type="button">Copy extracted text</button></details>` : ""}`;
      const removeBtn = $(".alloc-remove", el);
      if (removeBtn) removeBtn.addEventListener("click", () => {
        slots[key] = { ...slots[key], file: null, result: null };
        renderSlot(key); updateExtractBtn();
        runAnalysis(); renderAnalysis();
      });
      const copyBtn = $(`[data-copy="${key}"]`, el);
      if (copyBtn) copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(previewText(slot.result)).then(() => { copyBtn.textContent = "Copied"; setTimeout(() => copyBtn.textContent = "Copy extracted text", 1500); });
      });
    }
  }

  function previewText(result) {
    if (result.kind === "text") return result.text;
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
    // Any one file is enough to extract — Confirmation export alone is a
    // complete, useful run; Arrival Report and Alerts are extra signal, not
    // a hard requirement of each other.
    btn.disabled = !Object.values(slots).some(s => s.file);
  }

  async function runExtraction() {
    const btn = $("#allocExtractBtn", container);
    btn.disabled = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<span class="cp-spinner" aria-hidden="true"></span> Extracting…';
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
    btn.innerHTML = originalLabel;
    updateExtractBtn();
    runAnalysis();
    renderAnalysis();
  }

  // ---------- analysis: normalize -> validate -> apply rules -> match rooms ----------
  // Brief/compare panel state — module-level since it's UI interaction state,
  // not analysis output. Only one brief open at a time (keeps re-renders
  // simple and matches how a controller actually works: look at one guest,
  // decide, move on).
  let openIdx = null;
  const compareState = {}; // idx -> { input: string, result: {checks,verdict,reason} | null }

  // Dashboard and Arrivals both need to read the current analysis before
  // (or without ever) mounting this module's own UI — e.g. a shift that
  // opens on Dashboard first. Exposed read-only-by-convention: nothing
  // outside this file writes `analysis`, this just lets other screens see
  // the same object module.js already holds.
  const analysisListeners = [];
  function notifyAnalysisChange() { analysisListeners.forEach(fn => { try { fn(analysis); } catch (e) { console.error(e); } }); }

  function runAnalysis() {
    analysis = computeAnalysis();
    openIdx = null;
    notifyAnalysisChange();
  }

  function computeAnalysis() {
    const confResult = slots.confirmation.result;
    if (!confResult || confResult === "loading" || confResult.error || confResult.kind !== "rows") {
      return null;
    }
    const normalized = window.CPAllocParse.normalizeArrivals(confResult.rows);
    if (!normalized.length) {
      return { items: [], warnings: ["No arrival rows were found in the Confirmation export — check it's the right file."], totalArrivals: 0, groups: [], ctx: null };
    }
    const { valid, warnings } = window.CPAllocParse.validateArrivals(normalized);

    const arrivalText = slots.arrival.result && slots.arrival.result.kind === "text" ? slots.arrival.result.text : "";
    const alertsText = slots.alerts.result && slots.alerts.result.kind === "text" ? slots.alerts.result.text : "";
    const ctx = {
      arrivalSignals: window.CPAllocParse.extractArrivalSignals(arrivalText),
      alertSignals: window.CPAllocParse.extractAlertSignals(alertsText)
    };

    const items = valid.map((record, idx) => {
      const { tier, reasons } = window.CPAllocRules.applyRules(record, ctx);
      const match = record.roomType
        ? window.CPAllocMatch.findCandidates(record, { preferConnecting: record.needsRoom && !!record.linked })
        : null;
      return { idx, record, tier, reasons, match };
    });

    const groups = window.CPAllocGroup.groupLinkedArrivals(valid).map(g => {
      const connectivity = window.CPAllocGroup.checkGroupConnectivity(g, (roomNum) => window.CPAllocMatch.getRoom(roomNum));
      return Object.assign({}, g, { connectivity });
    });

    return { items, warnings, totalArrivals: valid.length, groups, ctx };
  }

  const STATUS_LABEL = { free: "Free now", check: "Checking out", later: "Departs later", ext: "Extension", unknown: "Not in due-outs" };

  function featureLabels(codes) {
    const glossary = (window.RBAB_DATA && window.RBAB_DATA.glossary) || {};
    return (codes || []).map(c => glossary[c] ? glossary[c].label : null).filter(Boolean);
  }

  function renderCandidate(c) {
    const feats = featureLabels(c.codes).slice(0, 2);
    return `<div class="alloc-candidate">
      <div class="alloc-candidate-room">${esc(c.room)}</div>
      <div class="alloc-candidate-type">${esc(c.description || c.type)}${c.connecting ? " · connects to " + esc(c.connecting) : ""}${feats.length ? " · " + feats.map(esc).join(", ") : ""}</div>
      <span class="alloc-candidate-status st-${c.status}">${STATUS_LABEL[c.status]}</span>
    </div>`;
  }

  function renderMatch(record, match) {
    if (!match) return "";
    if (record.room) {
      return `<div class="alloc-match alloc-match-assigned">
        <p class="alloc-match-note">Room ${esc(record.room)} is already assigned.${match.warnings.length ? " " + esc(match.warnings.join(" ")) : ""}</p>
      </div>`;
    }
    const list = match.candidates.length ? match.candidates : match.alternatives;
    if (!list.length) {
      return `<div class="alloc-match"><p class="alloc-match-note">${esc(match.warnings.join(" ")) || "No room type to match on this reservation."}</p></div>`;
    }
    const isAlt = !match.candidates.length;
    return `<div class="alloc-match">
      <div class="alloc-match-label">${isAlt ? `No exact ${esc(match.requestedType)} match — closest alternatives` : "Suggested rooms (Opera has the final say)"}</div>
      <div class="alloc-candidates">${list.map(renderCandidate).join("")}</div>
      ${match.warnings.length ? `<p class="alloc-match-warn">${esc(match.warnings.join(" "))}</p>` : ""}
    </div>`;
  }

  // ---------- Allocation Brief + Candidate Room Comparison ----------
  const TIER_LABEL = { high: "High priority", medium: "Medium priority" };
  const VERDICT_LABEL = { MATCH: "Match", COMPROMISE: "Compromise", CONFLICT: "Conflict", UNKNOWN: "Unknown" };
  // A drawn icon per check status, not emoji — same stroke weight and size
  // as every other icon in the app, so the comparison reads as part of the
  // product rather than a different rendering layer bolted on top of it.
  const CHECK_ICON_SVG = {
    pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  function renderCompareResult(result) {
    return `<div class="alloc-compare-result">
      ${result.checks.length ? `<ul class="alloc-compare-checks">${result.checks.map(c => `<li class="check-${c.status}"><span class="check-icon">${CHECK_ICON_SVG[c.status]}</span>${esc(c.label)}</li>`).join("")}</ul>` : ""}
      <div class="alloc-verdict verdict-${result.verdict.toLowerCase()}">${VERDICT_LABEL[result.verdict]}</div>
      <p class="alloc-verdict-reason">${esc(result.reason)}</p>
    </div>`;
  }

  // The structured brief: GUEST / BOOKED / REQUIREMENTS / PRIORITY / WHY /
  // CHECK IN OPERA, plus the room-comparison tool. This is the single
  // rendering path for both an always-expanded flagged card and a
  // click-to-expand row in the full arrivals list — same content either way.
  function renderBrief(item) {
    const { idx, record, tier, reasons, match } = item;
    const req = window.CPAllocCompare.extractRequirements(record, analysis.ctx);
    const reqChips = [];
    if (record.needsRoom) reqChips.push("Room type: " + (record.roomType || "not specified in export"));
    if (req.viewLabel) reqChips.push(req.viewLabel);
    if (req.floorPreference) reqChips.push(req.floorPreference);
    if (req.connecting) reqChips.push("Connecting room");
    req.occasions.forEach(o => reqChips.push(o));
    const cs = compareState[idx] || { input: "", result: null };

    return `<div class="alloc-brief cp-enter">
      <div class="alloc-brief-row">
        <div class="alloc-brief-col">
          <div class="alloc-brief-label">Guest</div>
          <div class="alloc-brief-body">${esc(record.name || "Unnamed guest")}${record.conf ? " · Conf " + esc(record.conf) : ""}${record.vip ? " · VIP " + esc(record.vip) : ""}${record.eta ? " · Arrival " + esc(record.eta) : ""}</div>
        </div>
        <div class="alloc-brief-col">
          <div class="alloc-brief-label">Booked</div>
          <div class="alloc-brief-body">${esc(record.roomType || "Room type not in export")} · Rate ${record.rate ? esc(record.rate) : "not in this export"} · Source ${esc(record.source || record.ta || record.company) || "not in this export"}</div>
        </div>
      </div>
      ${reqChips.length ? `<div class="alloc-brief-section">
        <div class="alloc-brief-label">Requirements</div>
        <div class="alloc-reasons">${reqChips.map(c => `<span class="alloc-reason-chip">${esc(c)}</span>`).join("")}</div>
      </div>` : ""}
      <div class="alloc-brief-row">
        <div class="alloc-brief-col">
          <div class="alloc-brief-label">Priority</div>
          <span class="alloc-tier-pill tier-${tier || "normal"}">${TIER_LABEL[tier] || "Normal"}</span>
        </div>
        ${reasons.length ? `<div class="alloc-brief-col alloc-brief-col-wide">
          <div class="alloc-brief-label">Why</div>
          <div class="alloc-reasons">${reasons.map(r => `<span class="alloc-reason-chip${r.hard ? " hard" : ""}">${esc(r.text)}</span>`).join("")}</div>
        </div>` : ""}
      </div>
      ${renderMatch(record, match)}
      <div class="alloc-brief-section">
        <div class="alloc-brief-label">Check in Opera</div>
        <ul class="alloc-checklist">
          <li>Verify available rooms for ${esc(record.roomType || "the booked type")}</li>
          <li>Verify the current room status of any candidate room</li>
          <li>Verify room readiness (housekeeping status)</li>
          <li>Verify room features match what's requested</li>
          <li>Verify connecting rooms, if required</li>
          <li>Verify any operational restrictions (Out of Order/Service, sell limits)</li>
        </ul>
      </div>
      <div class="alloc-brief-section">
        <div class="alloc-brief-label">Compare a candidate room you found in Opera</div>
        <div class="alloc-compare-form">
          <input type="text" inputmode="numeric" maxlength="4" placeholder="Room number, e.g. 3132" value="${esc(cs.input)}" data-compare-input="${idx}">
          <button class="cp-btn cp-btn-primary" type="button" data-compare-btn="${idx}">Compare</button>
        </div>
        ${cs.result ? renderCompareResult(cs.result) : ""}
      </div>
    </div>`;
  }

  // ---------- Arrivals: scannable list row ----------
  const ROOM_STATE_LABEL = { unassigned: "No room", unknown: "Not checked", ready: "Room ready", "not-ready": "Not ready" };
  const ROOM_STATE_TONE = { unassigned: "", unknown: "", ready: "tone-ok", "not-ready": "tone-warn" };

  function matchesArrFilters(item) {
    for (const key of arrFilters) {
      const def = ARR_FILTER_DEFS.find(d => d.key === key);
      if (def && !def.test(item)) return false;
    }
    if (arrSearch) {
      const q = arrSearch.toLowerCase();
      const hay = [item.record.name, item.record.room, item.record.conf, item.record.roomType].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderArrRow(item, i) {
    const { idx, record, tier, reasons } = item;
    const roomState = arrivalRoomState(record);
    const important = reasons.slice(0, 2);
    const isSelected = openIdx === idx;
    const enterClass = Number.isInteger(i) ? ` cp-enter cp-enter-${Math.min(i, 4) + 1}` : "";
    const when = record.eta || record.arrival || "No time given";
    const what = record.roomType || "No room type";
    return `<button class="arr-row${isSelected ? " is-selected" : ""}${enterClass}" type="button" data-arr-open="${idx}">
      <span class="arr-row-tier tier-${tier || "normal"}" aria-hidden="true"></span>
      <span class="arr-row-who">
        <span class="arr-row-name">${esc(record.name || "Unnamed guest")}</span>
        <span class="arr-row-sub">${record.conf ? "Conf " + esc(record.conf) : (record.room ? "Room " + esc(record.room) : "No confirmation number")}</span>
      </span>
      <span class="cp-badge ${ROOM_STATE_TONE[roomState]}">${ROOM_STATE_LABEL[roomState]}</span>
      <span class="arr-row-meta"><span class="arr-row-when">${esc(when)}</span><span class="arr-row-dot">·</span><span class="arr-row-what">${esc(what)}</span></span>
      <span class="arr-row-important">${important.length ? important.map(r => `<span class="arr-tag${r.hard ? " hard" : ""}">${esc(r.text)}</span>`).join("") : ""}</span>
    </button>`;
  }

  function renderArrFilterBar(items) {
    const counts = {};
    ARR_FILTER_DEFS.forEach(d => { counts[d.key] = items.filter(d.test).length; });
    return `<div class="arr-filters" role="group" aria-label="Filter arrivals">
      <button class="arr-filter-chip ${arrFilters.size ? "" : "on"}" type="button" data-arr-filter-all>All<b>${items.length}</b></button>
      ${ARR_FILTER_DEFS.map(d => `<button class="arr-filter-chip ${arrFilters.has(d.key) ? "on" : ""}" type="button" data-arr-filter="${d.key}">${d.label}<b>${counts[d.key]}</b></button>`).join("")}
    </div>`;
  }

  // ---------- Group / linked reservation intelligence ----------
  function renderGroup(g, i) {
    const enterClass = Number.isInteger(i) ? ` cp-enter cp-enter-${Math.min(i, 4) + 1}` : "";
    const conn = g.connectivity;
    let connNote = "";
    if (conn.checked) {
      connNote = conn.allConnected
        ? `<p class="alloc-group-conn ok">All assigned rooms in this group connect to at least one other member's room.</p>`
        : `<p class="alloc-group-conn warn">Room(s) ${g.connectivity.isolated.map(esc).join(", ")} don't connect to any other member's room in this group — check whether that's intended.</p>`;
    }
    const requirementSet = new Set();
    g.members.forEach(m => {
      const req = window.CPAllocCompare.extractRequirements(m, analysis.ctx);
      if (req.viewLabel) requirementSet.add(req.viewLabel);
      if (req.connecting) requirementSet.add("Connecting room");
    });
    return `<div class="alloc-group cp-card${enterClass}">
      <div class="alloc-group-head">
        <div class="alloc-group-lead">${esc(g.leadName || "Linked group")}</div>
        <span class="alloc-group-count">${plural(g.members.length, "member")}</span>
      </div>
      ${requirementSet.size ? `<div class="alloc-reasons">${[...requirementSet].map(r => `<span class="alloc-reason-chip">${esc(r)}</span>`).join("")}</div>` : ""}
      <div class="alloc-group-members">
        ${g.members.map(m => `<div class="alloc-group-member">
          <span class="alloc-group-member-name">${esc(m.name || "Unnamed guest")}</span>
          <span class="alloc-group-member-room">${m.room ? "Room " + esc(m.room) : "No room yet"}${m.roomType ? " · " + esc(m.roomType) : ""}</span>
        </div>`).join("")}
      </div>
      ${connNote}
    </div>`;
  }

  function renderGroups(groups) {
    if (!groups.length) return "";
    return `<div class="alloc-section-head">
      <h2>Linked reservation groups</h2>
      <span class="alloc-section-meta">${plural(groups.length, "group")}</span>
    </div>
    ${groups.map((g, i) => renderGroup(g, i)).join("")}`;
  }

  // Context + details + action together: the list and the selected
  // arrival's brief sit side by side (stacked on narrow screens), never a
  // navigate-away-and-back round trip to compare two arrivals.
  function renderAnalysis() {
    const el = $("#alloc-results", container);
    if (!el) return;
    if (!analysis) { el.innerHTML = ""; return; }
    const { items, warnings, totalArrivals, groups } = analysis;
    const sorted = items.slice().sort((a, b) => {
      const rank = { high: 0, medium: 1 };
      return (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2) || String(a.record.name).localeCompare(String(b.record.name));
    });
    const filtered = sorted.filter(matchesArrFilters);
    const selected = items.find(i => i.idx === openIdx) || null;

    el.innerHTML = `
      ${warnings.length ? `<div class="alloc-warnings cp-card">
        <div class="alloc-warnings-head">Check before relying on this — ${plural(warnings.length, "issue")} found</div>
        <ul>${warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
      </div>` : ""}
      ${totalArrivals ? `
      ${renderGroups(groups)}
      <div class="arr-split">
        <div class="arr-list-col">
          <div class="arr-list-head">
            <h2>Arrivals</h2>
            <span class="alloc-section-meta">${plural(totalArrivals, "arrival")}</span>
          </div>
          ${renderArrFilterBar(items)}
          <input class="arr-search" type="search" placeholder="Search guest, room, confirmation" value="${esc(arrSearch)}" data-arr-search>
          <div class="arr-list" role="list">
            ${filtered.length ? filtered.map(renderArrRow).join("") : `<p class="alloc-empty">No arrivals match these filters.</p>`}
          </div>
        </div>
        <div class="arr-detail-col">
          ${selected ? renderBrief(selected) : `<div class="cp-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <div class="cp-state-title">Select an arrival</div>
            <div class="cp-state-sub">Its full brief — requirements, priority, candidate rooms and comparison — opens here.</div></div>`}
        </div>
      </div>
      ` : ""}
    `;
  }

  function runCompare(idx) {
    const item = analysis && analysis.items.find(i => i.idx === idx);
    if (!item) return;
    const cs = compareState[idx] || (compareState[idx] = { input: "", result: null });
    const roomNum = (cs.input || "").trim();
    if (!roomNum) return;
    const room = window.CPAllocMatch.getRoom(roomNum);
    const req = window.CPAllocCompare.extractRequirements(item.record, analysis.ctx);
    cs.result = window.CPAllocCompare.compareRoom(req, room);
    renderAnalysis();
  }

  function shell() {
    return `
      <div class="alloc-wrap">
        <div class="alloc-banner cp-card">
          The Confirmation export drives the analysis below — room type, VIP, party size and balance
          come straight from it. Arrival Report and Alerts PDFs add extra signals (special-occasion
          mentions, flagged rooms) from a best-effort text scan, since PDF layouts vary and can't be
          read as reliably as a real table. Every room shown is a suggestion to review — nothing here
          is written back to Opera, and you always make the final call there.
        </div>
        <div class="alloc-slots">
          <div id="alloc-slot-arrival"></div>
          <div id="alloc-slot-confirmation"></div>
          <div id="alloc-slot-alerts"></div>
        </div>
        <button class="cp-btn cp-btn-primary" id="allocExtractBtn" disabled>Extract &amp; analyze</button>
        <div class="alloc-hint">Any one file is enough to start. Add the Confirmation export for arrival priorities and room suggestions.</div>
        <div id="alloc-results" aria-live="polite"></div>
      </div>`;
  }

  window.CPMountAllocation = function (mountContainer) {
    container = mountContainer;
    container.innerHTML = shell();
    Object.keys(slots).forEach(renderSlot);
    updateExtractBtn();
    renderAnalysis();
    $("#allocExtractBtn", container).addEventListener("click", runExtraction);

    // Delegated on #alloc-results itself (stable across renderAnalysis()
    // rebuilding its innerHTML) rather than on individual cards, which get
    // discarded and recreated on every render.
    const results = $("#alloc-results", container);
    results.addEventListener("click", e => {
      const row = e.target.closest("[data-arr-open]");
      if (row) {
        const idx = +row.dataset.arrOpen;
        openIdx = openIdx === idx ? null : idx;
        renderAnalysis();
        return;
      }
      const allBtn = e.target.closest("[data-arr-filter-all]");
      if (allBtn) { arrFilters.clear(); renderAnalysis(); return; }
      const filterBtn = e.target.closest("[data-arr-filter]");
      if (filterBtn) {
        const key = filterBtn.dataset.arrFilter;
        if (arrFilters.has(key)) arrFilters.delete(key); else arrFilters.add(key);
        renderAnalysis();
        return;
      }
      const compareBtn = e.target.closest("[data-compare-btn]");
      if (compareBtn) { runCompare(+compareBtn.dataset.compareBtn); return; }
    });
    results.addEventListener("input", e => {
      const search = e.target.closest("[data-arr-search]");
      if (search) {
        arrSearch = search.value;
        const cursor = search.selectionStart;
        renderAnalysis();
        const fresh = $("[data-arr-search]", results);
        if (fresh) { fresh.focus(); fresh.setSelectionRange(cursor, cursor); }
        return;
      }
      const input = e.target.closest("[data-compare-input]");
      if (!input) return;
      const idx = +input.dataset.compareInput;
      if (!compareState[idx]) compareState[idx] = { input: "", result: null };
      compareState[idx].input = input.value;
    });
    results.addEventListener("keydown", e => {
      const input = e.target.closest("[data-compare-input]");
      if (input && e.key === "Enter") { e.preventDefault(); runCompare(+input.dataset.compareInput); }
    });
  };

  // Read-only view onto this module's analysis, for Dashboard and any other
  // screen that needs to know what's flagged without mounting the full
  // upload-and-review UI itself.
  window.CPAlloc = {
    getAnalysis: () => analysis,
    onChange: (fn) => { analysisListeners.push(fn); }
  };
})();
