(function () {
  const PDFJS_SRC = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const XLSX_SRC = "https://cdn.sheetjs.com/xlsx-0.18.7/package/dist/xlsx.full.min.js";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let container = null;
  const slots = {
    arrival: { label: "Arrival Report", accept: ".pdf", kind: "pdf", file: null, result: null },
    confirmation: { label: "Confirmation / Reservation Export", accept: ".xls,.xlsx,.csv", kind: "excel", file: null, result: null },
    alerts: { label: "Alerts Report", accept: ".pdf", kind: "pdf", file: null, result: null }
  };

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
    return { kind: "text", pages: pdf.numPages, text: text.trim() };
  }

  function htmlTableToRows(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;
    return $$("tr", table).map(tr => $$("td,th", tr).map(td => td.textContent.trim()));
  }

  async function extractExcel(file) {
    // Opera's exports sometimes carry an .xls extension but are actually an HTML table.
    // Try a real spreadsheet parse first; fall back to treating it as HTML.
    const buf = await file.arrayBuffer();
    await ensureXlsx();
    try {
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false });
      if (rows.length) return { kind: "rows", format: "xlsx", sheet: sheetName, rows };
    } catch (e) { /* fall through to HTML attempt */ }

    const text = new TextDecoder().decode(buf);
    const rows = htmlTableToRows(text);
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
        ${slot.result && !slot.result.error ? `<div class="alloc-preview"><pre>${esc(previewText(slot.result))}</pre></div><button class="cp-btn" data-copy="${key}">Copy extracted text</button>` : ""}`;
      const removeBtn = $(".alloc-remove", el);
      if (removeBtn) removeBtn.addEventListener("click", () => { slot.file = null; slot.result = null; renderSlot(key); updateExtractBtn(); });
      const copyBtn = $(`[data-copy="${key}"]`, el);
      if (copyBtn) copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(previewText(slot.result)).then(() => { copyBtn.textContent = "Copied"; setTimeout(() => copyBtn.textContent = "Copy extracted text", 1500); });
      });
    }
  }

  function previewText(result) {
    if (result.kind === "text") return result.text;
    if (result.kind === "rows") return result.rows.map(r => r.join(" | ")).join("\n");
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
    btn.disabled = !slots.arrival.file;
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
  }

  function shell() {
    return `
      <div class="alloc-wrap">
        <div class="alloc-banner cp-card">
          This step only pulls the raw text and rows out of your files — it isn't matching arrivals or
          flagging attention items yet. Once this looks right against your real exports, the actual
          matching and attention logic gets built next.
        </div>
        <div class="alloc-slots">
          <div id="alloc-slot-arrival"></div>
          <div id="alloc-slot-confirmation"></div>
          <div id="alloc-slot-alerts"></div>
        </div>
        <button class="cp-btn cp-btn-primary" id="allocExtractBtn" disabled>Extract</button>
        <div class="alloc-hint">Arrival Report is required to start; Confirmation export and Alerts are optional for this test.</div>
      </div>`;
  }

  window.CPMountAllocation = function (mountContainer) {
    container = mountContainer;
    container.innerHTML = shell();
    Object.keys(slots).forEach(renderSlot);
    updateExtractBtn();
    $("#allocExtractBtn", container).addEventListener("click", runExtraction);
  };
})();
