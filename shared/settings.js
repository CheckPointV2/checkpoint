/* CheckPoint — Settings. Every cross-tool preference lives here, backed
   by shared/prefs.js's one localStorage blob, plus backup/restore for the
   data tools themselves (Templates, Reminders, Notes). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const APP_VERSION = "1.0.0";
  const CHANGELOG = [
    "Rebuilt around Home, Templates, Reminders and Notes.",
    "New command palette (Ctrl/Cmd+K), focus mode (F), and a scratchpad you can open from anywhere.",
    "Backup & restore, idle auto-lock with a screensaver, and full offline support."
  ];
  let container = null;

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function confirmNewShift() {
    if (!(window.CP && window.CP.newShift)) { window.CPToast && window.CPToast("Still loading — try again in a moment"); return; }
    window.CPConfirm("Start a new shift?", "This clears Departures, the checkout log, balance tags and the day list. Your cutoff time and theme stay.", "Clear and start fresh", () => {
      const cut = window.CP.state().cutoff;
      window.CP.newShift();
      window.CP.update(s => { s.cutoff = cut; });
      if (window.CP.toast) window.CP.toast("New shift started");
      location.hash = "#/departures";
    });
  }

  /* ---------- backup / restore ---------- */
  const BACKUP_KEYS = ["cp_comms_v1", "cp_reminders_v1", "cp_notes_v1", "cp_prefs"];
  function exportBackup() {
    const data = { version: APP_VERSION, exportedAt: Date.now(), data: {} };
    BACKUP_KEYS.forEach(k => { try { data.data[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { data.data[k] = null; } });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `checkpoint-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.CPPrefs.set({ lastBackupAt: Date.now() });
    window.CPToast && window.CPToast("Backup downloaded");
    render();
  }
  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !parsed.data) throw new Error("bad shape");
        BACKUP_KEYS.forEach(k => { if (parsed.data[k] !== undefined && parsed.data[k] !== null) localStorage.setItem(k, JSON.stringify(parsed.data[k])); });
        window.CPToast && window.CPToast("Backup restored — reloading…");
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        window.CPToast && window.CPToast("That file doesn't look like a CheckPoint backup.");
      }
    };
    reader.readAsText(file);
  }

  function render() {
    const theme = document.documentElement.dataset.theme === "dark" ? "Dark" : "Light";
    const prefs = window.CPPrefs.get();
    const daysSinceBackup = prefs.lastBackupAt ? Math.floor((Date.now() - prefs.lastBackupAt) / 86400000) : null;
    const needsBackupNudge = daysSinceBackup === null || daysSinceBackup >= 7;

    container.innerHTML = `
      <div class="set-wrap">
        <header class="set-head"><h1 class="cp-serif">Settings</h1><p class="set-head-sub">Configuration that doesn't change during a shift.</p></header>

        <section class="cp-card set-section">
          <h2>Appearance</h2>
          <div class="set-row">
            <div><div class="set-row-label">Theme</div><div class="set-row-sub">Currently ${theme.toLowerCase()} mode.</div></div>
            <button class="cp-btn" id="setThemeBtn" type="button">Switch to ${theme === "Dark" ? "light" : "dark"}</button>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Animations</div><div class="set-row-sub">Full, subtle, or off. Off also disables particles and shimmer.</div></div>
            <div class="chips">
              ${["full", "subtle", "off"].map(l => `<button class="chip ${prefs.animationLevel === l ? "on" : ""}" data-anim="${l}" type="button">${l[0].toUpperCase() + l.slice(1)}</button>`).join("")}
            </div>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Sounds</div><div class="set-row-sub">Soft click and chime on actions and reminders. Muted by default.</div></div>
            <button class="cp-btn" id="setSoundBtn" type="button">${prefs.soundsEnabled ? "Mute" : "Unmute"}</button>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Greeting</h2>
          <div class="set-row">
            <div><div class="set-row-label">Name</div><div class="set-row-sub">Used on the Home greeting.</div></div>
            <input class="cp-input" id="setName" value="${esc(prefs.name)}" style="max-width:160px;">
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Arabic greeting</div><div class="set-row-sub">صباح الخير / مساء الخير instead of English.</div></div>
            <button class="cp-btn" id="setArabicBtn" type="button">${prefs.arabicGreeting ? "On" : "Off"}</button>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Security</h2>
          <div class="set-row">
            <div><div class="set-row-label">Auto-lock after idle</div><div class="set-row-sub">Fades into a screensaver, then (if a PIN is set) requires it to continue.</div></div>
            <select class="cp-input" id="setAutoLock" style="max-width:140px;">
              ${[0, 2, 5, 10, 15, 30].map(m => `<option value="${m}" ${prefs.autoLockMinutes === m ? "selected" : ""}>${m === 0 ? "Off" : m + " min"}</option>`).join("")}
            </select>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">PIN</div><div class="set-row-sub">${prefs.pin ? "A PIN is set." : "No PIN set — the screensaver dismisses on any tap."}</div></div>
            <button class="cp-btn" id="setPinBtn" type="button">${prefs.pin ? "Change / clear" : "Set a PIN"}</button>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Lock CheckPoint</div><div class="set-row-sub">Returns to the password screen on this device.</div></div>
            <button class="cp-btn" id="setLockBtn" type="button">Lock now</button>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Shift</h2>
          <div class="set-row">
            <div><div class="set-row-label">Start a new shift</div><div class="set-row-sub">Clears Departures, the checkout log, balance tags and the day list. Cutoff time and theme stay.</div></div>
            <button class="cp-btn" id="setShiftBtn" type="button">Start new shift</button>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Archive length</div><div class="set-row-sub">How many days of Close Shift exports to keep before auto-clearing.</div></div>
            <select class="cp-input" id="setArchiveDays" style="max-width:120px;">
              ${[3, 7, 14, 30].map(d => `<option value="${d}" ${prefs.archiveDays === d ? "selected" : ""}>${d} days</option>`).join("")}
            </select>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Backup &amp; restore</h2>
          ${needsBackupNudge ? `<p class="set-nudge">${daysSinceBackup === null ? "You haven't backed up yet." : `It's been ${daysSinceBackup} days since your last backup.`} Consider exporting one.</p>` : ""}
          <div class="set-row">
            <div><div class="set-row-label">Export everything</div><div class="set-row-sub">Templates, snippets, reminders, presets, notes and settings as one file.</div></div>
            <button class="cp-btn cp-btn-primary" id="setBackupExport" type="button">Download backup</button>
          </div>
          <div class="set-row">
            <div><div class="set-row-label">Restore from a file</div><div class="set-row-sub">Replaces the above with what's in the file. Reloads the page.</div></div>
            <button class="cp-btn" id="setBackupImportBtn" type="button">Choose file</button>
            <input type="file" id="setBackupImportFile" accept=".json" hidden>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>About</h2>
          <p class="set-fine">CheckPoint — personal hub, Rixos Bab Al Bahr. Data stays on this device only. Version ${APP_VERSION}.</p>
          <button class="cp-btn" id="setWhatsNewBtn" type="button">What's new</button>
        </section>
      </div>`;

    $("#setThemeBtn", container).addEventListener("click", () => { if (window.CPSetTheme) window.CPSetTheme(); render(); });
    $$("[data-anim]", container).forEach(b => b.addEventListener("click", () => { window.CPPrefs.set({ animationLevel: b.dataset.anim }); render(); }));
    $("#setSoundBtn", container).addEventListener("click", () => { window.CPPrefs.set({ soundsEnabled: !prefs.soundsEnabled }); if (!prefs.soundsEnabled) window.CPPlaySound && window.CPPlaySound("chime"); render(); });
    $("#setName", container).addEventListener("change", (e) => window.CPPrefs.set({ name: e.target.value.trim() || "there" }));
    $("#setArabicBtn", container).addEventListener("click", () => { window.CPPrefs.set({ arabicGreeting: !prefs.arabicGreeting }); render(); });
    $("#setAutoLock", container).addEventListener("change", (e) => window.CPPrefs.set({ autoLockMinutes: parseInt(e.target.value, 10) }));
    $("#setArchiveDays", container).addEventListener("change", (e) => window.CPPrefs.set({ archiveDays: parseInt(e.target.value, 10) }));
    $("#setPinBtn", container).addEventListener("click", openPinEditor);
    $("#setShiftBtn", container).addEventListener("click", confirmNewShift);
    $("#setLockBtn", container).addEventListener("click", () => window.CPLock && window.CPLock());
    $("#setBackupExport", container).addEventListener("click", exportBackup);
    $("#setBackupImportBtn", container).addEventListener("click", () => $("#setBackupImportFile", container).click());
    $("#setBackupImportFile", container).addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); });
    $("#setWhatsNewBtn", container).addEventListener("click", () => showWhatsNew(true));
  }

  function $$(s, r) { return Array.from(r.querySelectorAll(s)); }

  function openPinEditor() {
    const hasPin = !!window.CPPrefs.get().pin;
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:18px;">${hasPin ? "Change or clear PIN" : "Set a PIN"}</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <p style="font-size:12.5px;color:var(--ink-soft);margin:8px 0 12px;">A privacy screen, not real security — stored on this device only.</p>
      <input class="cp-input" id="pinInput" type="password" inputmode="numeric" placeholder="New 4–6 digit PIN" maxlength="6" style="text-align:center;letter-spacing:.3em;">
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="cp-btn cp-btn-primary" id="pinSave" type="button">Save</button>
        ${hasPin ? `<button class="cp-btn" id="pinClear" type="button">Clear PIN</button>` : ""}
      </div>`, (el, close) => {
      el.querySelector("[data-close]").onclick = close;
      el.querySelector("#pinSave").onclick = () => {
        const v = el.querySelector("#pinInput").value.trim();
        if (!/^\d{4,6}$/.test(v)) { el.querySelector("#pinInput").focus(); return; }
        window.CPPrefs.set({ pin: v }); close(); render();
      };
      if (hasPin) el.querySelector("#pinClear").onclick = () => { window.CPPrefs.set({ pin: null }); close(); render(); };
    });
  }

  function showWhatsNew(force) {
    const prefs = window.CPPrefs.get();
    if (!force && prefs.lastWhatsNewVersion === APP_VERSION) return;
    window.CPSheet(`
      <div class="sheet-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <h2 style="margin:0;font-family:var(--font-display);font-size:19px;">What's new — v${APP_VERSION}</h2>
        <button class="cp-icon-btn" data-close type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <ul class="whatsnew-list">${CHANGELOG.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
      <div style="margin-top:14px;"><button class="cp-btn cp-btn-primary" data-close type="button">Got it</button></div>`,
    (el, close) => {
      el.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { window.CPPrefs.set({ lastWhatsNewVersion: APP_VERSION }); close(); });
    });
  }
  window.CPShowWhatsNewIfNeeded = () => showWhatsNew(false);

  window.CPMountSettings = function (mountContainer) {
    container = mountContainer;
    render();
  };
})();
