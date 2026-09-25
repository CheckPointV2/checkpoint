/* CheckPoint — Settings. Deliberately small: the things used every few
   seconds (theme, lock) already live in the rail where they're one click
   away; this is for the handful of things used once a shift. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  let container = null;

  function confirmNewShift() {
    if (!(window.CP && window.CP.newShift)) { window.CPToastFallback && window.CPToastFallback("Still loading — try again in a moment"); return; }
    if (!confirm("Start a new shift? This clears Departures, the checkout log, balance tags and the day list. Your cutoff time and theme stay.")) return;
    const cut = window.CP.state().cutoff;
    window.CP.newShift();
    window.CP.update(s => { s.cutoff = cut; });
    if (window.CP.toast) window.CP.toast("New shift started");
    location.hash = "#/dashboard";
  }

  function render() {
    const theme = document.documentElement.dataset.theme === "dark" ? "Dark" : "Light";
    container.innerHTML = `
      <div class="set-wrap">
        <header class="set-head"><h1 class="cp-serif">Settings</h1><p class="set-head-sub">Configuration that doesn't change during a shift.</p></header>

        <section class="cp-card set-section">
          <h2>Appearance</h2>
          <div class="set-row">
            <div><div class="set-row-label">Theme</div><div class="set-row-sub">Currently ${theme.toLowerCase()} mode.</div></div>
            <button class="cp-btn" id="setThemeBtn" type="button">Switch to ${theme === "Dark" ? "light" : "dark"}</button>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Shift</h2>
          <div class="set-row">
            <div><div class="set-row-label">Start a new shift</div><div class="set-row-sub">Clears Departures, the checkout log, balance tags and the day list. Cutoff time and theme stay.</div></div>
            <button class="cp-btn" id="setShiftBtn" type="button">Start new shift</button>
          </div>
        </section>

        <section class="cp-card set-section">
          <h2>Security</h2>
          <div class="set-row">
            <div><div class="set-row-label">Lock CheckPoint</div><div class="set-row-sub">Returns to the password screen on this device.</div></div>
            <button class="cp-btn" id="setLockBtn" type="button">Lock now</button>
          </div>
          <p class="set-fine">The password is set in shared/app.js and shared by the whole hub — changing it means editing that file, not this screen.</p>
        </section>

        <section class="cp-card set-section">
          <h2>About</h2>
          <p class="set-fine">CheckPoint — Rooms Controller reference and workflow hub, Rixos Bab Al Bahr. Data stays on this device only.</p>
        </section>
      </div>`;

    $("#setThemeBtn", container).addEventListener("click", () => { if (window.CPSetTheme) window.CPSetTheme(); render(); });
    $("#setShiftBtn", container).addEventListener("click", confirmNewShift);
    $("#setLockBtn", container).addEventListener("click", () => window.CPLock && window.CPLock());
  }

  window.CPMountSettings = function (mountContainer) {
    container = mountContainer;
    render();
  };
})();
