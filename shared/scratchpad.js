/* CheckPoint — Scratchpad drawer. Reachable from any screen (a floating
   button in the shell chrome, plus Ctrl/Cmd+Shift+N), not just from Notes.
   Writes straight into Notes' own storage key so it's just a fast front
   door onto a real note, not a separate, parallel place to lose things. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = "cp_notes_v1";

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function ensureEl() {
    let el = document.getElementById("cpScratchpad");
    if (el) return el;
    el = document.createElement("div");
    el.id = "cpScratchpad";
    el.className = "scratchpad";
    el.innerHTML = `
      <div class="scratchpad-head"><span>Scratchpad</span><button class="cp-icon-btn sm" id="scratchClose" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <textarea id="scratchInput" placeholder="Jot something down…"></textarea>
      <p class="scratchpad-hint">Saves as a note in Notes when you close this.</p>`;
    document.body.appendChild(el);
    $("#scratchClose", el).addEventListener("click", close);
    return el;
  }

  function open() {
    const el = ensureEl();
    el.classList.add("open");
    setTimeout(() => $("#scratchInput", el).focus(), 200);
  }
  function close() {
    const el = document.getElementById("cpScratchpad");
    if (!el || !el.classList.contains("open")) return;
    const input = $("#scratchInput", el);
    const text = input.value.trim();
    if (text) {
      let s;
      try { s = JSON.parse(localStorage.getItem(KEY)) || { notes: [] }; } catch (e) { s = { notes: [] }; }
      s.notes = s.notes || [];
      s.notes.unshift({ id: uid(), text, tags: [], color: "", pinned: false, createdAt: Date.now(), updatedAt: Date.now() });
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      window.CPNotesRefresh && window.CPNotesRefresh();
      window.CPToast && window.CPToast("Saved to Notes");
    }
    input.value = "";
    el.classList.remove("open");
  }

  window.CPOpenScratchpad = open;

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
      const el = document.getElementById("cpScratchpad");
      e.preventDefault();
      if (el && el.classList.contains("open")) close(); else open();
    }
  });

  function bindFloatingButton() {
    const btn = document.getElementById("scratchpadFab");
    if (btn) btn.addEventListener("click", open);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindFloatingButton);
  else bindFloatingButton();
})();
