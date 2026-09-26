/* CheckPoint — shared preferences store.
   One small JSON blob in localStorage, read by Home (greeting/Arabic),
   Settings (the one screen that edits all of this), Reminders (sounds),
   and anything else that needs a cross-tool setting. Keeping every tool's
   ad-hoc localStorage key out of this would just recreate the same
   scattering Settings is supposed to solve. */
(function () {
  const KEY = "cp_prefs";
  const DEFAULTS = {
    name: "Sherif",
    arabicGreeting: false,
    animationLevel: "full",   // full | subtle | off
    soundsEnabled: false,
    autoLockMinutes: 0,       // 0 = off
    pin: null,
    archiveDays: 7,
    lastWhatsNewVersion: null,
    lastBackupAt: null
  };
  let cache = null;
  const listeners = [];

  function load() {
    if (cache) return cache;
    try { cache = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { cache = Object.assign({}, DEFAULTS); }
    return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
    listeners.forEach(fn => { try { fn(cache); } catch (e) { console.error(e); } });
  }

  window.CPPrefs = {
    get: () => Object.assign({}, load()),
    set: (patch) => { load(); Object.assign(cache, patch); save(); },
    onChange: (fn) => listeners.push(fn),
    DEFAULTS
  };

  // Reduced-motion is an OS-level override no animation-level setting
  // should fight — anything reading "should I animate" checks this too.
  window.CPMotionOK = function (need = "full") {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const level = load().animationLevel;
    if (level === "off") return false;
    if (level === "subtle" && need === "full") return false;
    return true;
  };
})();
