(function () {
  const REPO_OWNER = "CheckPointV2";
  const REPO_NAME = "checkpoint";
  const FILE_PATH = "email/templates.json";
  const BRANCH = "main";
  const TOKEN_KEY = "cp_gh_token";
  const CACHE_KEY = "cp_email_cache";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 9);
  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>';
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

  let data = null;
  let activeCatId = null;
  let activeTplId = null;
  let container = null;
  let dirty = false;
  let addingCat = false;
  let addingTpl = false;
  let renamingCat = null;

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

  async function loadData() {
    const res = await fetch("email/templates.json?_=" + Date.now());
    data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    if (data.categories.length) {
      activeCatId = data.categories[0].id;
      activeTplId = (data.categories[0].templates[0] || {}).id || null;
    }
  }

  async function fetchShaFromGitHub() {
    const token = getToken();
    if (!token) return null;
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${BRANCH}`;
    const res = await fetch(url, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error("Couldn't read the file from GitHub (status " + res.status + ")");
    const json = await res.json();
    return json.sha;
  }

  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function saveToGitHub() {
    const token = getToken();
    if (!token) { openSettings("You need a GitHub token to save. Paste one below."); return; }
    setStatus("Saving…");
    try {
      const currentSha = await fetchShaFromGitHub();
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
      const body = {
        message: "Update email templates",
        content: b64EncodeUnicode(JSON.stringify(data, null, 2)),
        sha: currentSha,
        branch: BRANCH
      };
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? "That token was rejected — check it's valid and has write access."
          : res.status === 409 ? "The file changed on GitHub since you loaded it — reload and try again."
          : "GitHub said: " + res.status);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      dirty = false;
      setStatus("Saved");
      updateUnsavedDot();
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus(err.message || "Save failed", true);
    }
  }

  function markDirty() { dirty = true; updateUnsavedDot(); }
  function updateUnsavedDot() {
    const dot = $("#emlUnsaved", container);
    if (dot) dot.style.display = dirty ? "block" : "none";
  }

  function setStatus(msg, isError) {
    const el = $("#emlStatus", container);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? "var(--danger)" : "var(--ink-soft)";
  }

  function openSettings(note) {
    const overlay = $("#emlSettingsOverlay", container);
    overlay.classList.add("show");
    $("#emlSettingsNote", container).textContent = note || "";
    $("#emlTokenInput", container).value = getToken();
  }
  function closeSettings() { $("#emlSettingsOverlay", container).classList.remove("show"); }

  function activeCategory() { return data.categories.find(c => c.id === activeCatId); }
  function activeTemplate() {
    const c = activeCategory();
    return c && c.templates.find(t => t.id === activeTplId);
  }

  function render() {
    const cats = data.categories;
    const cat = activeCategory();
    const tpl = activeTemplate();

    $("#emlCats", container).innerHTML = cats.map(c => {
      if (renamingCat === c.id) {
        return `<div class="eml-cat-row eml-cat-editing">
          <input class="cp-input eml-inline-input" id="emlRenameInput" value="${esc(c.name)}">
          <button class="eml-icon-btn eml-icon-ok" data-rename-save="${c.id}" title="Save">✓</button>
        </div>`;
      }
      return `<div class="eml-cat-row${c.id === activeCatId ? " active" : ""}" data-cat="${c.id}">
        <span class="eml-cat-name">${esc(c.name)}</span>
        <span class="eml-count">${c.templates.length}</span>
        <span class="eml-cat-actions">
          <button class="eml-icon-btn" data-rename="${c.id}" title="Rename category">${ICON_EDIT}</button>
          <button class="eml-icon-btn eml-icon-danger" data-delcat="${c.id}" title="Delete category">${ICON_TRASH}</button>
        </span>
      </div>`;
    }).join("") + (addingCat
      ? `<div class="eml-cat-row eml-cat-editing">
          <input class="cp-input eml-inline-input" id="emlNewCatInput" placeholder="Category name">
          <button class="eml-icon-btn eml-icon-ok" id="emlNewCatSave" title="Add">✓</button>
        </div>`
      : `<button class="cp-btn eml-add-btn" id="emlAddCat">+ Category</button>`);

    $("#emlList", container).innerHTML = (cat ? cat.templates.map(t =>
      `<div class="eml-item${t.id === activeTplId ? " active" : ""}" data-tpl="${t.id}">${esc(t.title) || "Untitled"}</div>`
    ).join("") : "") + (addingTpl
      ? `<div class="eml-cat-row eml-cat-editing">
          <input class="cp-input eml-inline-input" id="emlNewTplInput" placeholder="Template title">
          <button class="eml-icon-btn eml-icon-ok" id="emlNewTplSave" title="Add">✓</button>
        </div>`
      : (cat ? `<button class="cp-btn eml-add-btn" id="emlAddTpl">+ Template</button>` : ""));

    const editor = $("#emlEditor", container);
    if (!tpl) {
      editor.innerHTML = '<div class="cp-loading">Pick a template on the left, or add a new one.</div>';
    } else {
      editor.innerHTML = `
        <input class="cp-input eml-title" id="emlTitle" value="${esc(tpl.title)}" placeholder="Template title">
        <input class="cp-input" id="emlSubject" value="${esc(tpl.subject || "")}" placeholder="Subject (optional)" style="margin-top:10px;">
        <textarea class="cp-input eml-body" id="emlBody" rows="14" placeholder="Message body" style="margin-top:10px;">${esc(tpl.body)}</textarea>
        <div class="eml-editor-actions">
          <button class="cp-btn cp-btn-primary" id="emlSave">Save to GitHub</button>
          <button class="cp-btn" id="emlCopy">${ICON_COPY} Copy</button>
          <button class="cp-btn" id="emlDuplicate">Duplicate</button>
          <button class="cp-btn eml-danger-btn" id="emlDelete">Delete</button>
          <span id="emlStatus" class="eml-status"></span>
        </div>`;
      $("#emlTitle", container).addEventListener("input", e => { tpl.title = e.target.value; markDirty(); const li = $("#emlList", container).querySelector(`[data-tpl="${tpl.id}"]`); if (li) li.textContent = tpl.title || "Untitled"; });
      $("#emlSubject", container).addEventListener("input", e => { tpl.subject = e.target.value; markDirty(); });
      $("#emlBody", container).addEventListener("input", e => { tpl.body = e.target.value; markDirty(); });
      $("#emlSave", container).addEventListener("click", saveToGitHub);
      $("#emlCopy", container).addEventListener("click", () => {
        const text = (tpl.subject ? "Subject: " + tpl.subject + "\n\n" : "") + tpl.body;
        navigator.clipboard.writeText(text).then(() => { setStatus("Copied"); setTimeout(() => setStatus(""), 1500); });
      });
      $("#emlDuplicate", container).addEventListener("click", () => {
        const copy = { id: uid("tpl"), title: tpl.title + " (copy)", subject: tpl.subject, body: tpl.body };
        cat.templates.push(copy);
        activeTplId = copy.id; markDirty();
        render();
      });
      $("#emlDelete", container).addEventListener("click", () => {
        if (!confirm("Delete this template?")) return;
        cat.templates = cat.templates.filter(t => t.id !== tpl.id);
        activeTplId = (cat.templates[0] || {}).id || null;
        markDirty();
        render();
      });
    }

    // category selection / rename / delete
    $$(".eml-cat-row[data-cat]", container).forEach(el => el.addEventListener("click", (e) => {
      if (e.target.closest(".eml-cat-actions")) return;
      activeCatId = el.dataset.cat;
      const c = activeCategory();
      activeTplId = (c.templates[0] || {}).id || null;
      render();
    }));
    $$("[data-rename]", container).forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation(); renamingCat = el.dataset.rename; render();
      const input = $("#emlRenameInput", container); if (input) { input.focus(); input.select(); }
    }));
    $$("[data-delcat]", container).forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.delcat;
      const c = data.categories.find(c => c.id === id);
      if (!confirm(`Delete category "${c.name}" and its ${c.templates.length} template(s)?`)) return;
      data.categories = data.categories.filter(c => c.id !== id);
      if (activeCatId === id) {
        activeCatId = (data.categories[0] || {}).id || null;
        activeTplId = activeCatId ? ((activeCategory().templates[0] || {}).id || null) : null;
      }
      markDirty(); render();
    }));
    const renameSave = $("[data-rename-save]", container);
    if (renameSave) {
      const commitRename = () => {
        const c = data.categories.find(c => c.id === renamingCat);
        const val = $("#emlRenameInput", container).value.trim();
        if (c && val) { c.name = val; markDirty(); }
        renamingCat = null; render();
      };
      renameSave.addEventListener("click", commitRename);
      $("#emlRenameInput", container).addEventListener("keydown", e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { renamingCat = null; render(); } });
    }

    $$(".eml-item", container).forEach(el => el.addEventListener("click", () => { activeTplId = el.dataset.tpl; render(); }));

    const addCatBtn = $("#emlAddCat", container);
    if (addCatBtn) addCatBtn.addEventListener("click", () => { addingCat = true; render(); const i = $("#emlNewCatInput", container); if (i) i.focus(); });
    const newCatSave = $("#emlNewCatSave", container);
    if (newCatSave) {
      const commitNewCat = () => {
        const name = $("#emlNewCatInput", container).value.trim();
        addingCat = false;
        if (name) {
          const c = { id: uid("cat"), name, templates: [] };
          data.categories.push(c);
          activeCatId = c.id; activeTplId = null; markDirty();
        }
        render();
      };
      newCatSave.addEventListener("click", commitNewCat);
      $("#emlNewCatInput", container).addEventListener("keydown", e => { if (e.key === "Enter") commitNewCat(); if (e.key === "Escape") { addingCat = false; render(); } });
    }

    const addTplBtn = $("#emlAddTpl", container);
    if (addTplBtn) addTplBtn.addEventListener("click", () => { addingTpl = true; render(); const i = $("#emlNewTplInput", container); if (i) i.focus(); });
    const newTplSave = $("#emlNewTplSave", container);
    if (newTplSave) {
      const commitNewTpl = () => {
        const title = $("#emlNewTplInput", container).value.trim();
        addingTpl = false;
        if (title) {
          const t = { id: uid("tpl"), title, subject: "", body: "" };
          cat.templates.push(t);
          activeTplId = t.id; markDirty();
        }
        render();
      };
      newTplSave.addEventListener("click", commitNewTpl);
      $("#emlNewTplInput", container).addEventListener("keydown", e => { if (e.key === "Enter") commitNewTpl(); if (e.key === "Escape") { addingTpl = false; render(); } });
    }

    updateUnsavedDot();
  }

  function shell() {
    return `
      <div class="eml-wrap">
        <div class="eml-toolbar no-print">
          <input class="cp-input" id="emlSearch" placeholder="Filter templates…" style="max-width:260px;">
          <span style="margin-left:auto"></span>
          <button class="cp-icon-btn" id="emlSettingsBtn" title="GitHub sync settings" style="position:relative;">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
            <span id="emlUnsaved" style="display:none; position:absolute; top:4px; right:4px; width:7px; height:7px; border-radius:50%; background:var(--danger);"></span>
          </button>
        </div>
        <div class="eml-grid">
          <div class="cp-card eml-col" id="emlCats"></div>
          <div class="cp-card eml-col" id="emlList"></div>
          <div class="cp-card eml-col eml-editor" id="emlEditor"></div>
        </div>
      </div>

      <div class="cp-palette-overlay" id="emlSettingsOverlay">
        <div class="cp-palette" style="padding:22px;">
          <div class="cp-serif" style="font-size:17px; margin-bottom:6px;">GitHub sync</div>
          <p style="font-size:12.5px; color:var(--ink-soft); margin-top:0;" id="emlSettingsNote">
            Edits save by committing to ${REPO_OWNER}/${REPO_NAME}. Paste a fine-grained personal access token
            scoped to this repo only, with <strong>Contents: Read and write</strong>. It's stored in this browser's
            local storage only — never committed to the repo.
          </p>
          <input class="cp-input" id="emlTokenInput" placeholder="github_pat_…" style="margin-bottom:10px;">
          <div style="display:flex; gap:8px;">
            <button class="cp-btn cp-btn-primary" id="emlTokenSave">Save token</button>
            <button class="cp-btn" id="emlTokenClear">Clear</button>
            <button class="cp-btn" id="emlSettingsClose" style="margin-left:auto;">Close</button>
          </div>
        </div>
      </div>`;
  }

  window.CPMountEmail = async function (mountContainer) {
    container = mountContainer;
    container.innerHTML = '<div class="cp-loading">Loading templates…</div>';
    try {
      await loadData();
    } catch (err) {
      container.innerHTML = '<div class="cp-loading">Could not load templates.json</div>';
      return;
    }
    container.innerHTML = shell();
    render();

    $("#emlSearch", container).addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      $$(".eml-item", container).forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
    $("#emlSettingsBtn", container).addEventListener("click", () => openSettings());
    $("#emlSettingsClose", container).addEventListener("click", closeSettings);
    $("#emlTokenSave", container).addEventListener("click", () => { setToken($("#emlTokenInput", container).value.trim()); closeSettings(); });
    $("#emlTokenClear", container).addEventListener("click", () => { setToken(""); $("#emlTokenInput", container).value = ""; });
    $("#emlSettingsOverlay", container).addEventListener("click", (e) => { if (e.target.id === "emlSettingsOverlay") closeSettings(); });

    document.addEventListener("keydown", function emlSaveShortcut(e) {
      if (window.CPActiveTool !== "email") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveToGitHub(); }
    });
  };

  window.CPEmailGoTo = function (templateId) {
    if (!data) return;
    for (const c of data.categories) {
      const t = c.templates.find(t => t.id === templateId);
      if (t) { activeCatId = c.id; activeTplId = t.id; render(); return; }
    }
  };

  window.CPEmailCount = function () {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cache) return 0;
      return cache.categories.reduce((n, c) => n + c.templates.length, 0);
    } catch (e) { return 0; }
  };

  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
})();
