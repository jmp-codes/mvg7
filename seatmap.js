/* ============================================================
 * seatmap.js  -  Renders the vessel seat plan from config.sections
 * render(container, map, { mode, selected, onSeat, section })
 *   mode:    'book'  -> available seats are selectable
 *            'admin' -> available/blocked seats toggle (office)
 *            'view'  -> read-only
 *   section: optional section id ('front'|'mid'|'aft'|'upper') to
 *            show only that deck (used by the booking wizard)
 * Every cell is placed on an 8-column grid with explicit row/column.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.seatmap = (function () {
  const { esc } = G7.u;

  const LEGEND = [
    ['available', 'Available'],
    ['selected', 'Selected'],
    ['booked', 'Taken'],
    ['blocked', 'Blocked'],
    ['oos', 'Out of service'],
  ];

  function seatNumbers(sec) {
    const out = [];
    sec.rows.forEach(r => r.forEach(c => { if (typeof c === 'number') out.push(c); }));
    return out;
  }

  function sectionHTML(sec, map, sel, mode, withTitle) {
    let cells = '';
    sec.rows.forEach((row, ri) => {
      let col = 1;
      row.forEach(c => {
        const span = c && typeof c === 'object' ? c.span : 1;
        const pos = `grid-row:${ri + 1};grid-column:${col}` + (span > 1 ? ` / span ${span}` : '');
        if (c === null) {
          /* empty cell: nothing to draw */
        } else if (typeof c === 'object') {
          cells += `<div class="cell label" style="${pos}">${esc(c.label)}</div>`;
        } else {
          const info = map[c] || { state: 'available' };
          let state = info.state;
          if (sel.has(c) && (state === 'available' || (mode === 'admin' && state !== 'booked'))) state = 'selected';
          const clickable =
            mode === 'book' ? (state === 'available' || state === 'selected')
            : mode === 'admin' ? state !== 'booked'
            : false;
          let title = 'Seat ' + c;
          if (state === 'booked' && mode === 'admin') title += ' - ' + (info.name || '') + ' (' + (info.ref || '') + ')';
          else if (state === 'booked') title += ' - taken';
          else if (state === 'oos') title += ' - out of service';
          else if (state === 'blocked') title += ' - blocked';
          cells += `<button type="button" class="seat ${state}" style="${pos}" data-seat="${c}" title="${esc(title)}" ${clickable ? '' : 'disabled'}>${state === 'oos' ? '<span class="wrench">🔧</span>' : ''}${c}</button>`;
        }
        col += span;
      });
    });
    if (sec.aisle) {
      cells += `<div class="aisle" style="grid-column:${sec.aisle.col};grid-row:${sec.aisle.from} / ${sec.aisle.to + 1}"><i>↑</i><span>AISLE</span><i>↓</i></div>`;
    }
    return `<section class="sm-section">${withTitle ? `<h3>${esc(sec.name)}</h3>` : ''}<div class="sm-grid">${cells}</div></section>`;
  }

  function render(container, map, opts) {
    opts = opts || {};
    const mode = opts.mode || 'book';
    const sel = new Set(opts.selected || []);
    const secs = opts.section ? G7.config.sections.filter(s => s.id === opts.section) : G7.config.sections;

    let html = `<div class="seatmap ${opts.section ? 'single' : ''}">` + secs.map(s => sectionHTML(s, map, sel, mode, !opts.section)).join('') + '</div>';
    if (opts.stern !== false && (!opts.section || opts.section === 'upper')) html += '<div class="sm-stern">↓ STERN (Back)</div>';
    if (opts.legend !== false) html += '<div class="legend">' + LEGEND.map(([k, t]) => `<span><i class="seat-chip ${k}"></i>${t}</span>`).join('') + '</div>';

    container.innerHTML = html;
    container.onclick = function (e) {
      const b = e.target.closest('.seat');
      if (b && !b.disabled && opts.onSeat) opts.onSeat(Number(b.dataset.seat));
    };
  }

  return { render, seatNumbers };
})();
