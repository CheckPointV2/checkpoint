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
      if (slot.result === "loading") statusLine = `<span class="alloc-file-status">Extracting…</span>`;
      else if (slot.result && slot.result.error) statusLine = `<span class="alloc-file-status err">${esc(slot.result.error)}</span>`;
      else if (slot.result && slot.result.kind === "text") statusLine = `<span class="alloc-file-status ok">${slot.result.pages} page(s) · ${slot.result.text.length.toLocaleString()} characters extracted</span>`;
      else if (slot.result && slot.result.kind === "rows") statusLine = `<span class="alloc-file-status ok">${slot.result.rows.length} row(s) read (${slot.result.format})</span>`;

      el.innerHTML = `
        <div class="alloc-slot-label">${slot.label}</div>
        <div class="alloc-file">
          <div class="alloc-file-name">${esc(slot.file.name)} <span class="alloc-file-size">${sizeKB} KB</span></div>
          ${statusLine}
          <button class="eml-icon-btn alloc-remove" data-key="${key}" title="Remove">✕</button>
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
    runAnalysis();
    renderAnalysis();
  }

  // ---------- analysis: normalize -> validate -> apply rules -> match rooms ----------
  function runAnalysis() {
    const confResult = slots.confirmation.result;
    if (!confResult || confResult === "loading" || confResult.error || confResult.kind !== "rows") {
      analysis = null;
      return;
    }
    const normalized = window.CPAllocParse.normalizeArrivals(confResult.rows);
    if (!normalized.length) {
      analysis = { flagged: [], warnings: ["No arrival rows were found in the Confirmation export — check it's the right file."], totalArrivals: 0 };
      return;
    }
    const { valid, warnings } = window.CPAllocParse.validateArrivals(normalized);

    const arrivalText = slots.arrival.result && slots.arrival.result.kind === "text" ? slots.arrival.result.text : "";
    const alertsText = slots.alerts.result && slots.alerts.result.kind === "text" ? slots.alerts.result.text : "";
    const ctx = {
      arrivalSignals: window.CPAllocParse.extractArrivalSignals(arrivalText),
      alertSignals: window.CPAllocParse.extractAlertSignals(alertsText)
    };

    const flagged = [];
    valid.forEach(record => {
      const { tier, reasons } = window.CPAllocRules.applyRules(record, ctx);
      if (!tier) return;
      const match = record.roomType
        ? window.CPAllocMatch.findCandidates(record, { preferConnecting: record.needsRoom && !!record.linked })
        : null;
      flagged.push({ record, tier, reasons, match });
    });
    flagged.sort((a, b) => (a.tier === "high" ? 0 : 1) - (b.tier === "high" ? 0 : 1));

    analysis = { flagged, warnings, totalArrivals: valid.length };
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

  function renderArrivalCard({ record, tier, reasons, match }) {
    const roomLabel = record.room ? `Room ${esc(record.room)}` : "No room assigned yet";
    return `<div class="alloc-arrival tier-${tier}">
      <div class="alloc-arrival-head">
        <div>
          <div class="alloc-arrival-name">${esc(record.name || "Unnamed guest")}</div>
          <div class="alloc-arrival-meta">${roomLabel}${record.roomType ? " · " + esc(record.roomType) : ""}${record.arrival ? " · Arriving " + esc(record.arrival) : ""}${record.conf ? " · Conf " + esc(record.conf) : ""}</div>
        </div>
        <span class="alloc-tier-pill tier-${tier}">${tier === "high" ? "High priority" : "Medium priority"}</span>
      </div>
      <div class="alloc-reasons">${reasons.map(r => `<span class="alloc-reason-chip${r.hard ? " hard" : ""}">${esc(r.text)}</span>`).join("")}</div>
      ${renderMatch(record, match)}
    </div>`;
  }

  function renderTierGroup(label, tier, items) {
    return `<div class="alloc-tier-group">
      <h3 class="alloc-tier-heading tier-${tier}">${label}<span>${items.length}</span></h3>
      ${items.map(renderArrivalCard).join("")}
    </div>`;
  }

  function renderAnalysis() {
    const el = $("#alloc-results", container);
    if (!el) return;
    if (!analysis) { el.innerHTML = ""; return; }
    const { flagged, warnings, totalArrivals } = analysis;
    const high = flagged.filter(f => f.tier === "high");
    const medium = flagged.filter(f => f.tier === "medium");

    el.innerHTML = `
      ${warnings.length ? `<div class="alloc-warnings cp-card">
        <div class="alloc-warnings-head">Check before relying on this — ${plural(warnings.length, "issue")} found</div>
        <ul>${warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
      </div>` : ""}
      ${totalArrivals ? `<div class="alloc-section-head">
        <h2>Arrivals needing attention</h2>
        <span class="alloc-section-meta">${flagged.length} of ${plural(totalArrivals, "arrival")} flagged</span>
      </div>
      ${flagged.length ? "" : `<p class="alloc-empty">No arrivals matched a priority rule in this import — nothing here needs special attention beyond the normal check-in flow.</p>`}
      ${high.length ? renderTierGroup("High priority", "high", high) : ""}
      ${medium.length ? renderTierGroup("Medium priority", "medium", medium) : ""}` : ""}
    `;
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
        <div id="alloc-results"></div>
      </div>`;
  }

  window.CPMountAllocation = function (mountContainer) {
    container = mountContainer;
    container.innerHTML = shell();
    Object.keys(slots).forEach(renderSlot);
    updateExtractBtn();
    renderAnalysis();
    $("#allocExtractBtn", container).addEventListener("click", runExtraction);
  };
})();
