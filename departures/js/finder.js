(function (CP) {
  const $ = (id) => document.getElementById(id);
  let type = 'all';
  let bld = 'all';
  let seaView = false;

  // how close a departing room is to being free, lower is sooner
  const CODE_RANK = { '12:05': 0, '12:02': 1, '12:01': 2, '12:04': 3 };
  const LANES = [
    { key: 'free', title: 'Free now', note: 'Guest has checked out. Room is with housekeeping, put it on Q.' },
    { key: 'going', title: 'Leaving now', note: 'Due out before your cutoff. Physical check pending.' },
    { key: 'later', title: 'Leaving later', note: 'Due out after your cutoff, earliest first.' }
  ];

  const baseType = (t) => t.replace(/OV$/, '');
  const isSea = (t) => /OV$/.test(t);

  // ---------- named waiting guests, from Allocation ----------
  // finder.js's own model has always been room-type-driven, not guest-driven
  // — a controller picks a type, not a name. That undersells what's actually
  // known once a Confirmation export has been read in Arrivals: which named
  // guests have no room yet. This cross-references that (window.CPAlloc)
  // against the exact same candidate-ranking Arrivals itself uses
  // (window.CPAllocMatch), so "who is waiting" means an actual guest with a
  // name and a priority, not just an empty room-type bucket.
  function waitingGuests() {
    if (!window.CPAlloc || !window.CPAllocMatch) return null;
    const analysis = window.CPAlloc.getAnalysis();
    if (!analysis) return null;
    return analysis.items
      .filter(it => it.record.needsRoom && it.record.roomType)
      .sort((a, b) => {
        const rank = { high: 0, medium: 1 };
        return (rank[a.tier] ?? 2) - (rank[b.tier] ?? 2);
      });
  }

  function renderWaitingGuests(box) {
    if (!window.RBAB_DATA && CP.loadScript) {
      CP.loadScript('roomguide/data.js').then(render).catch(() => {});
    }
    const items = waitingGuests();
    if (items === null) return '';
    if (!items.length) {
      return `<section class="fd-waiting"><h2>Waiting for a room</h2><p class="fd-waiting-empty">No named arrival is waiting on a room right now, per the last Arrivals import.</p></section>`;
    }
    return `<section class="fd-waiting">
      <h2>Waiting for a room<span class="fd-waiting-count">${items.length}</span></h2>
      <div class="fd-waiting-list">
        ${items.map(it => {
          const r = it.record;
          const match = window.CPAllocMatch.findCandidates(r, { preferConnecting: !!r.linked });
          const candidates = (match.candidates.length ? match.candidates : match.alternatives).slice(0, 3);
          return `<div class="fd-waiting-card">
            <div class="fd-waiting-head">
              <div>
                <div class="fd-waiting-name">${CP.esc(r.name || 'Unnamed guest')}</div>
                <div class="fd-waiting-meta">${CP.esc(r.roomType)}${r.eta ? ' · Arriving ' + CP.esc(r.eta) : ''}${r.vip ? ' · VIP' : ''}</div>
              </div>
              ${it.tier ? `<span class="cp-badge tone-${it.tier === 'high' ? 'danger' : 'warn'}">${it.tier === 'high' ? 'High priority' : 'Medium priority'}</span>` : ''}
            </div>
            ${candidates.length ? `<div class="fd-waiting-candidates">
              ${candidates.map(c => `<button class="fd-waiting-room" data-room="${CP.esc(c.room)}" type="button">
                <span class="fd-num">${CP.esc(c.room)}</span>
                <span class="cp-badge ${c.status === 'free' ? 'tone-ok' : c.status === 'check' ? 'tone-warn' : ''}">${c.status === 'free' ? 'Free now' : c.status === 'check' ? 'Checking out' : c.status === 'later' ? 'Later' : 'No signal'}</span>
              </button>`).join('')}
            </div>` : `<p class="fd-waiting-nomatch">${CP.esc(match.warnings[0] || 'No candidate rooms found.')}</p>`}
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }

  function lane(r, s) {
    const st = CP.roomStatus(r, s);
    if (st === 'co' || st === 'left') return 'free';
    if (st === 'check') return 'going';
    if (st === 'later') return 'later';
    if (st === 'ext') return 'ext';
    return null;
  }

  function rank(r, s) {
    const st = CP.roomStatus(r, s);
    if (st === 'co') return -1;                       // Concierge confirmed out
    if (r.etd in CODE_RANK) return CODE_RANK[r.etd];
    const m = CP.toMinutes(r.etd);
    return m === null ? 5 : 10 + m;
  }

  function describe(r, s) {
    const st = CP.roomStatus(r, s);
    if (st === 'co') return 'Checked out';
    if (st === 'left') return 'Guest left';
    if (CP.ETD_CODES[r.etd]) return CP.ETD_CODES[r.etd];
    if (st === 'later') return r.etd ? 'Due ' + r.etd : 'No time';
    return r.etd ? 'ETD ' + r.etd : 'No time given';
  }

  function render() {
    const s = CP.state();
    const box = $('fd-body');
    if (!box) return;
    const waitingBox = $('fd-waiting');
    if (waitingBox) waitingBox.innerHTML = renderWaitingGuests(waitingBox);
    if (!s.dueouts) {
      $('fd-controls').innerHTML = '';
      box.innerHTML = `<div class="panel fd-empty">
        <h2>Import today's due-out export first</h2>
        <p class="meta">Once it's in, pick the room type a waiting guest needs and every matching departing room is ranked by how soon it frees up.</p>
        <button class="btn primary" data-fd="import" type="button">Import export</button>
      </div>`;
      return;
    }

    const rows = CP.dep.activeRows(s).filter(r => r.roomType && r.roomType !== 'PM');
    // type chips grouped by base type so KGA and KGAOV sit together
    const types = {};
    rows.forEach(r => { types[r.roomType] = (types[r.roomType] || 0) + 1; });
    const typeKeys = Object.keys(types).sort((a, b) => baseType(a).localeCompare(baseType(b)) || (isSea(a) - isSea(b)));

    const match = rows.filter(r =>
      (type === 'all' || (seaView ? r.roomType === type : baseType(r.roomType) === baseType(type))) &&
      (bld === 'all' || CP.building(r.room) === bld));

    const groups = { free: [], going: [], later: [], ext: [] };
    match.forEach(r => { const l = lane(r, s); if (l) groups[l].push(r); });
    Object.values(groups).forEach(g => g.sort((a, b) => (rank(a, s) - rank(b, s)) || a.room.localeCompare(b.room, undefined, { numeric: true })));

    $('fd-controls').innerHTML = `
      <div class="fd-row">
        <span class="fd-label">Room type</span>
        <div class="chips">
          <button class="chip ${type === 'all' ? 'on' : ''}" data-type="all" type="button">All<b>${rows.length}</b></button>
          ${typeKeys.map(t => `<button class="chip ${type === t ? 'on' : ''} ${isSea(t) ? 'sea' : ''}" data-type="${CP.esc(t)}" type="button">${CP.esc(t)}<b>${types[t]}</b></button>`).join('')}
        </div>
      </div>
      <div class="fd-row">
        <span class="fd-label">Building</span>
        <div class="chips">
          ${['all'].concat(CP.BUILDINGS.map(b => b.name)).map(b => `<button class="chip ${bld === b ? 'on' : ''}" data-bld="${b}" type="button">${b === 'all' ? 'All buildings' : b}</button>`).join('')}
        </div>
        ${type !== 'all' ? `<label class="check-row fd-exact"><input type="checkbox" id="fd-exact" ${seaView ? 'checked' : ''}> Exact type only${isSea(type) ? '' : ' (hide sea view)'}</label>` : ''}
      </div>`;

    const total = groups.free.length + groups.going.length + groups.later.length;
    const label = type === 'all' ? 'any type' : (seaView ? type : baseType(type) + (typeKeys.some(t => isSea(t) && baseType(t) === baseType(type)) ? ' incl. sea view' : ''));

    box.innerHTML = `
      <div class="fd-summary">
        <div class="fd-big"><strong>${groups.free.length}</strong><span>free now</span></div>
        <div class="fd-big"><strong>${groups.going.length}</strong><span>leaving now</span></div>
        <div class="fd-big"><strong>${groups.later.length}</strong><span>leaving later</span></div>
        <p class="meta">${CP.plural(total, 'departing room')} for ${CP.esc(label)}${bld !== 'all' ? ' in ' + bld : ''}${groups.ext.length ? `. ${CP.plural(groups.ext.length, 'extension')} not counted` : ''}.</p>
      </div>
      <div class="fd-lanes">${LANES.map(L => `
        <section class="fd-lane lane-${L.key}">
          <header><h2>${L.title}</h2><b>${groups[L.key].length}</b></header>
          <p class="fd-note">${L.note}</p>
          ${groups[L.key].length ? `<ol class="fd-list">${groups[L.key].map((r, i) => `
            <li>
              <button class="fd-room" data-room="${CP.esc(r.room)}" type="button">
                <span class="fd-rank">${i + 1}</span>
                <span class="fd-num">${CP.esc(r.room)}</span>
                <span class="fd-type">${CP.esc(r.roomType)}</span>
                <span class="fd-bld b-${CP.building(r.room).toLowerCase()}">${CP.building(r.room)}</span>
                <span class="fd-when">${CP.esc(describe(r, s))}</span>
              </button>
            </li>`).join('')}</ol>` : `<p class="empty">None</p>`}
        </section>`).join('')}
      </div>
      <p class="fine">Only rooms checking out today are in the due-out export. Rooms that were already vacant this morning won't show here.</p>`;
  }

  function bind() {
    const view = $('dv-finder');
    view.addEventListener('click', e => {
      const t = e.target.closest('[data-type]');
      if (t) { type = t.dataset.type; if (type === 'all') seaView = false; render(); return; }
      const b = e.target.closest('[data-bld]');
      if (b) { bld = b.dataset.bld; render(); return; }
      if (e.target.closest('[data-fd=import]')) { CP.go('departures'); $('dep-file').click(); return; }
      const r = e.target.closest('[data-room]');
      if (r) CP.openRoom(r.dataset.room);
    });
    view.addEventListener('change', e => {
      if (e.target.id === 'fd-exact') { seaView = e.target.checked; render(); }
    });
  }

  CP.renderFinder = render;
  CP.bindFinder = bind;
})(window.CP);
