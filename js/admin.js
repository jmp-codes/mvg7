/* ============================================================
 * admin.js  -  Ticket Office (staff area)
 * Tabs: Dashboard, Bookings, Manifest, Trips & Seats, Fares, Data
 * ============================================================ */
window.G7 = window.G7 || {};

(function () {
  const { u, config, trips, store, seatmap, ticket, icon } = G7;
  const { esc, $, $$ } = u;

  const TABS = [
    ['dashboard', 'Dashboard', 'chart'],
    ['bookings', 'Bookings', 'calendar'],
    ['manifest', 'Manifest', 'people'],
    ['trips', 'Trips & Seats', 'ship'],
    ['fares', 'Fares', 'tag'],
    ['data', 'Data', 'file'],
  ];

  let root = null;
  let tab = 'dashboard';
  const F = {
    date: u.today(), routeId: config.routes[0].id,
    q: '', fdate: '', status: 'all', page: 1, size: 10, sort: { key: 'created', dir: -1 },
    tdate: '', troute: 'all', tstatus: 'all', tq: '', tpage: 1, mq: '',
  };

  const authed = () => sessionStorage.getItem('g7.admin') === '1';

  function render(container) {
    root = container;
    authed() ? draw() : login();
  }

  function login() {
    root.innerHTML = `<div class="of-login"><div class="of-login-card">
      <header><div><h2>Ticket Office</h2><p>Staff only. Enter the office PIN to continue.</p></div><span class="of-login-ic">${icon('ticket')}</span></header>
      <form id="login"><label>PIN
        <div class="of-input">${icon('lock')}<input type="password" id="pin" placeholder="Enter office PIN" autocomplete="off" required></div></label>
        <button class="of-btn teal">${icon('login')} Sign in</button></form>
      <div class="of-divider">${icon('shield')}</div>
      <div class="of-info">${icon('info')}<p>This area is restricted to authorized ticket office staff only. Please keep your PIN confidential.</p></div>
    </div></div>`;
    $('#login', root).addEventListener('submit', e => {
      e.preventDefault();
      if ($('#pin').value === config.adminPin) { sessionStorage.setItem('g7.admin', '1'); draw(); }
      else u.toast('Wrong PIN.', 'err');
    });
  }

  function draw() {
    root.innerHTML = `<div class="of no-print-wrap"><div class="of-bar no-print">
      <nav class="of-tabs">${TABS.map(([k, t, ic]) => `<button class="of-tab ${k === tab ? 'on' : ''}" data-tab="${k}">${icon(ic)}${t}</button>`).join('')}</nav>
      <div class="of-account"><span class="of-avatar">${icon('user')}</span><div><b>Staff Account</b><small>Ticket Office</small></div>
      <button class="of-btn ghost" id="logout">Sign out ${icon('logout')}</button></div></div>
      <div id="tab-body"></div></div>`;
    $$('[data-tab]', root).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
    $('#logout', root).addEventListener('click', () => { sessionStorage.removeItem('g7.admin'); login(); });
    ({ dashboard, bookings, manifest, trips: tripsTab, fares, data })[tab]($('#tab-body', root));
  }

  // ---- shared bits --------------------------------------------------------
  const routeOptions = (sel, withTime) => config.routes.map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(trips.routeLabel(r))}${withTime ? ' (' + u.fmtTime(trips.get(F.date, r.id).departs) + ')' : ''}</option>`).join('');
  const confirmedFor = tid => store.bookings().filter(b => b.tripId === tid && b.status === 'confirmed');
  const paxCount = list => list.reduce((n, b) => n + b.passengers.length, 0);
  const head = (ic, title, sub, right) => `<header class="of-head">${icon(ic, 'of-head-ic')}<div><h2>${title}</h2><p>${sub}</p></div>${right ? `<div class="of-head-r">${right}</div>` : ''}</header>`;
  const dateInput = (id, val, min) => `<div class="of-input">${icon('calendar')}<input type="date" id="${id}" value="${val}"></div>`;

  function pager(total, page, size, prefix) {
    const pages = Math.max(1, Math.ceil(total / size));
    const from = total ? (page - 1) * size + 1 : 0;
    const to = Math.min(total, page * size);
    let nums = '';
    for (let p = 1; p <= pages; p++) nums += `<button class="of-pg ${p === page ? 'on' : ''}" data-pg="${p}">${p}</button>`;
    return `<div class="of-pager"><span>Showing ${from} to ${to} of ${total} ${prefix}</span><div>
      <button class="of-pg" data-pg="${Math.max(1, page - 1)}" aria-label="Previous">${icon('chevleft')}</button>${nums}
      <button class="of-pg" data-pg="${Math.min(pages, page + 1)}" aria-label="Next">${icon('chevright')}</button></div></div>`;
  }

  // ---- dashboard ---------------------------------------------------------
  function dashboard(el) {
    el.innerHTML = `${head('chart', 'Dashboard', 'Welcome! Here\'s an overview of today\'s operations.')}
      <div class="of-filters slim"><label class="of-lab">${icon('calendar')} Date</label>${dateInput('d', F.date)}
      <span class="sp"></span><button class="of-btn ghost" id="refresh">${icon('refresh')} Refresh</button></div>
      <div id="stats"></div>`;
    $('#d', el).addEventListener('change', e => { F.date = e.target.value || u.today(); dashboard(el); });
    $('#refresh', el).addEventListener('click', () => dashboard(el));

    let rev = 0, paid = 0, pax = 0;
    const cards = config.routes.map((r, idx) => {
      const t = trips.get(F.date, r.id);
      const list = confirmedFor(t.id);
      const cap = trips.sellableCount(t);
      const sold = cap - trips.availableCount(t);
      const total = list.reduce((n, b) => n + b.total, 0);
      const paidAmt = list.filter(b => b.payment.status === 'paid').reduce((n, b) => n + b.total, 0);
      rev += total; paid += paidAmt; pax += paxCount(list);
      const pct = cap ? Math.round((sold / cap) * 100) : 0;
      const badge = t.cancelled ? '<span class="of-badge bad">CANCELLED</span>' : `<span class="of-badge ${idx % 2 ? 'ok' : ''}">${idx % 2 ? 'RETURNING' : 'DEPARTING'}</span>`;
      return `<article class="of-trip ${idx % 2 ? 'alt' : ''}">
        <header><span class="of-circ">${icon('ship')}</span><div><h3>${esc(trips.routeLabel(r))}</h3><p>Departs at ${u.fmtTime(t.departs)}</p></div>${badge}</header>
        <div class="of-prog"><i style="width:${pct}%"></i></div>
        <div class="of-prog-t"><b>${sold} / ${cap} seats occupied</b><span>${paxCount(list)} passengers · ${list.length} bookings</span></div>
        <div class="of-tiles">
          <div>${icon('seat')}<small>Total Seats</small><b>${cap}</b></div>
          <div>${icon('people')}<small>Passengers</small><b>${paxCount(list)}</b></div>
          <div>${icon('doc')}<small>Bookings</small><b>${list.length}</b></div>
        </div>
        <footer><span>Sales <b>${u.money(total)}</b> (collected ${u.money(paidAmt)})</span>
        <button class="of-btn outline" data-view="${r.id}">View Details ${icon('arrow')}</button></footer></article>`;
    }).join('');

    $('#stats', el).innerHTML = `<section class="of-band">
        <div><span class="of-circ blue">${icon('coins')}</span><div><small>Total Sales</small><strong>${u.money(rev)}</strong><em>${u.fmtDate(F.date)}</em></div></div>
        <div><span class="of-circ green">${icon('card')}</span><div><small>Collected</small><b>${u.money(paid)}</b></div></div>
        <div><span class="of-circ gold">${icon('clock')}</span><div><small>Outstanding</small><b>${u.money(rev - paid)}</b></div></div>
        <div><span class="of-circ pale">${icon('people')}</span><div><small>Total Passengers</small><b>${pax}</b></div></div>
      </section>
      <header class="of-sec">${icon('ship', 'of-head-ic sm')}<div><h3>Today's Trips</h3><p>Overview of trips, seat availability, and bookings for the selected date.</p></div></header>
      <div class="of-grid2">${cards}</div>`;

    $$('[data-view]', el).forEach(b => b.addEventListener('click', () => {
      F.tdate = F.date; F.troute = b.dataset.view; F.tpage = 1; tab = 'trips'; draw();
    }));
  }

  // ---- bookings ----------------------------------------------------------
  const SORTS = {
    ref: b => b.ref, trip: b => b.date + b.departs, contact: b => b.contact.name.toLowerCase(), pax: b => b.passengers.length,
    seats: b => Math.min.apply(null, b.passengers.map(p => p.seat || 999)), total: b => b.total,
    payment: b => b.payment.status, status: b => b.status, created: b => b.createdAt,
  };

  function bookings(el) {
    el.innerHTML = `${head('calendar', 'Bookings', 'Manage and monitor all booking records.')}
      <div class="of-filters">
        <label>Search<div class="of-input">${icon('search')}<input id="q" value="${esc(F.q)}" placeholder="Reference no., name or phone"></div></label>
        <label>Travel date${dateInput('fd', F.fdate)}</label>
        <label>Status<div class="of-input"><select id="st">${[['all', 'All'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled'], ['unpaid', 'Unpaid']].map(([v, t]) => `<option value="${v}" ${F.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></label>
        <button class="of-btn ghost" id="clr">${icon('filter')} Clear</button><span class="sp"></span>
        <button class="of-btn navy" id="newb">${icon('plus')} New Booking</button></div>
      <div class="of-panel" id="list"></div>`;
    const bind = (id, key, ev) => $(id, el).addEventListener(ev || 'input', e => { F[key] = e.target.value; F.page = 1; list(); });
    bind('#q', 'q'); bind('#fd', 'fdate', 'change'); bind('#st', 'status', 'change');
    $('#clr', el).addEventListener('click', () => { F.q = ''; F.fdate = ''; F.status = 'all'; F.page = 1; bookings(el); });
    $('#newb', el).addEventListener('click', () => { G7.booking.prefill({}); location.hash = '#/book'; });

    function list() {
      const q = F.q.trim().toLowerCase();
      const rows = store.bookings().filter(b => {
        if (F.fdate && b.date !== F.fdate) return false;
        if (F.status === 'confirmed' && b.status !== 'confirmed') return false;
        if (F.status === 'cancelled' && b.status !== 'cancelled') return false;
        if (F.status === 'unpaid' && !(b.status === 'confirmed' && b.payment.status !== 'paid')) return false;
        if (!q) return true;
        return [b.ref, b.contact.name, b.contact.phone].concat(b.passengers.map(p => p.name)).join(' ').toLowerCase().includes(q);
      });
      const kf = SORTS[F.sort.key] || SORTS.created;
      rows.sort((a, b) => (kf(a) > kf(b) ? 1 : kf(a) < kf(b) ? -1 : 0) * F.sort.dir);
      const pages = Math.max(1, Math.ceil(rows.length / F.size));
      if (F.page > pages) F.page = pages;
      const view = rows.slice((F.page - 1) * F.size, F.page * F.size);
      const th = (k, t, cls) => `<th class="${cls || ''}" data-sort="${k}">${t}<span class="srt ${F.sort.key === k ? 'on' : ''}">${icon('sort')}</span></th>`;

      $('#list', el).innerHTML = `<div class="of-listbar"><span>${rows.length} booking(s) found</span>
        <label class="inl">Show <div class="of-input sm"><select id="size">${[10, 25, 50].map(n => `<option ${F.size === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div> entries</label></div>
        ${view.length ? `<div class="of-scroll"><table class="of-tbl"><thead><tr>${th('ref', 'Ref')}${th('trip', 'Trip')}${th('contact', 'Contact')}${th('pax', 'Pax')}${th('seats', 'Seats')}${th('total', 'Total')}${th('payment', 'Payment')}${th('status', 'Status')}<th>Actions</th></tr></thead><tbody>
        ${view.map(b => `<tr class="${b.status === 'cancelled' ? 'dim' : ''}">
          <td><b>${esc(b.ref)}</b></td>
          <td>${u.fmtDate(b.date)}<small>${esc(trips.routeLabel(trips.route(b.routeId)))}</small></td>
          <td>${esc(b.contact.name)}<small>${esc(b.contact.phone)}</small></td>
          <td>${b.passengers.length}</td>
          <td>${esc(b.passengers.map(p => p.seat).filter(Boolean).join(', ') || '—')}</td>
          <td><b>${u.money(b.total)}</b></td>
          <td>${b.payment.status === 'paid' ? `<span class="of-pill ok">${icon('checkcircle')}Paid</span>` : `<span class="of-pill warn">${icon('clock')}Unpaid</span>`}</td>
          <td>${b.status === 'cancelled' ? `<span class="of-pill bad">${icon('xcircle')}Cancelled</span>` : `<span class="of-pill ok">${icon('checkcircle')}Confirmed</span>`}</td>
          <td class="acts">
            <button class="of-btn outline sm" data-act="view" data-ref="${b.ref}">${icon('ticket')} Tickets</button>
            ${b.status === 'confirmed' && b.payment.status !== 'paid' ? `<button class="of-btn outline sm" data-act="pay" data-ref="${b.ref}">${icon('check')} Mark paid</button>` : ''}
            ${b.status === 'confirmed' ? `<button class="of-btn danger sm" data-act="cancel" data-ref="${b.ref}">${icon('trash')} Cancel</button>` : ''}
          </td></tr>`).join('')}
        </tbody></table></div>` : '<p class="of-empty">No bookings match.</p>'}
        ${pager(rows.length, F.page, F.size, 'entries')}`;
    }
    list();

    $('#list', el).addEventListener('change', e => { if (e.target.id === 'size') { F.size = Number(e.target.value); F.page = 1; list(); } });
    $('#list', el).addEventListener('click', e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) { F.page = Number(pg.dataset.pg); return list(); }
      const sh = e.target.closest('[data-sort]');
      if (sh) { const k = sh.dataset.sort; F.sort = { key: k, dir: F.sort.key === k ? -F.sort.dir : 1 }; return list(); }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const ref = btn.dataset.ref;
      if (btn.dataset.act === 'view') ticket.show(store.getBooking(ref));
      if (btn.dataset.act === 'pay') { store.updateBooking(ref, b => (b.payment.status = 'paid')); u.toast('Marked as paid.', 'ok'); list(); }
      if (btn.dataset.act === 'cancel') {
        if (!confirm('Cancel booking ' + ref + '? Its seats will be released.')) return;
        store.updateBooking(ref, b => { b.status = 'cancelled'; b.cancelledAt = new Date().toISOString(); });
        u.toast('Booking cancelled.', 'ok');
        list();
      }
    });
  }

  // ---- manifest ----------------------------------------------------------
  function manifest(el) {
    const t = trips.get(F.date, F.routeId);
    const rows = [];
    confirmedFor(t.id).forEach(b => b.passengers.forEach((p, i) => rows.push({ b, p, i })));
    rows.sort((a, b) => (a.p.seat || 999) - (b.p.seat || 999));
    const cap = trips.sellableCount(t);

    el.innerHTML = `${head('people', 'Passenger Manifest', 'View and print the list of passengers for a selected trip.')}
      <div class="of-filters no-print"><label class="inl">Travel date${dateInput('d', F.date)}</label>
        <label class="inl">Trip<div class="of-input"><select id="r">${routeOptions(F.routeId, true)}</select></div></label><span class="sp"></span>
        <button class="of-btn navy" id="print">${icon('print')} Print Manifest</button></div>
      <div class="printable">
      <section class="of-summary">
        <div class="of-circ big">${icon('ship')}</div>
        <div class="main"><h3>${esc(trips.routeLabel(t.route))}</h3><p>${u.fmtDate(t.date)} · ${u.fmtTime(t.departs)}${t.cancelled ? ' · <b class="bad">CANCELLED</b>' : ''}</p><small>${esc(config.vessel)}</small></div>
        <div class="kpi">${icon('seat')}<small>Total Seats</small><b>${cap}</b></div>
        <div class="kpi">${icon('people')}<small>Booked Passengers</small><b>${rows.length}</b></div>
        <div class="kpi">${icon('user')}<small>Available Seats</small><b>${trips.availableCount(t)}</b></div>
      </section>
      <div class="of-panel"><div class="of-listbar"><div><h3>Passenger List</h3><span>${rows.length} passengers booked for this trip. <b id="bcount">${rows.filter(r => r.p.boarded).length}</b> boarded.</span></div>
        <div class="of-input wide no-print">${icon('search')}<input id="mq" value="${esc(F.mq)}" placeholder="Search by name or reference number"></div></div>
      <div id="mlist"></div></div></div>`;
    $('#d', el).addEventListener('change', e => { F.date = e.target.value || u.today(); manifest(el); });
    $('#r', el).addEventListener('change', e => { F.routeId = e.target.value; manifest(el); });
    $('#print', el).addEventListener('click', () => window.print());

    function list() {
      const q = F.mq.trim().toLowerCase();
      const v = rows.filter(r => !q || (r.p.name + ' ' + r.b.ref).toLowerCase().includes(q));
      $('#mlist', el).innerHTML = `<div class="of-scroll"><table class="of-tbl flat"><thead><tr><th>#</th><th>Booking Reference</th><th>Passenger Name</th><th>Contact Number</th><th>Category / Fare</th><th>Seat No.</th><th>Booking Status</th><th>Payment Status</th><th class="c">Boarded</th></tr></thead>
        <tbody>${v.length ? v.map((r, n) => `<tr><td>${n + 1}</td><td><b>${esc(r.b.ref)}</b></td><td>${esc(r.p.name)}</td><td>${esc(r.b.contact.phone)}</td><td>${esc(config.fares[r.p.fareType].label)}</td><td>${r.p.seat || 'Lap'}</td>
          <td><span class="of-pill ok">Confirmed</span></td>
          <td>${r.b.payment.status === 'paid' ? '<span class="of-pill ok">Paid</span>' : '<span class="of-pill warn">Unpaid</span>'}</td>
          <td class="c"><input type="checkbox" data-ref="${r.b.ref}" data-i="${r.i}" ${r.p.boarded ? 'checked' : ''}></td></tr>`).join('') : ''}</tbody></table></div>
        ${v.length ? '' : `<div class="of-emptybox"><span class="of-circ big pale">${icon('people')}</span><b>No passengers booked for this trip.</b><p>Once passengers are booked, they will appear here.</p></div>`}`;
    }
    list();
    $('#mq', el).addEventListener('input', e => { F.mq = e.target.value; list(); });
    $('#mlist', el).addEventListener('change', e => {
      const cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      store.updateBooking(cb.dataset.ref, b => (b.passengers[cb.dataset.i].boarded = cb.checked));
      const r = rows.find(x => x.b.ref === cb.dataset.ref && String(x.i) === cb.dataset.i);
      if (r) r.p.boarded = cb.checked;
      $('#bcount', el).textContent = rows.filter(x => x.p.boarded).length;
    });
  }

  // ---- trips & seats -----------------------------------------------------
  const TRIPS_PER_PAGE = 8;

  function tripList() {
    const start = F.tdate || u.today();
    const days = F.tdate ? 1 : 14;
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = u.addDays(start, i);
      config.routes.forEach(r => out.push(trips.get(d, r.id)));
    }
    const q = F.tq.trim().toLowerCase();
    return out.filter(t => {
      if (F.troute !== 'all' && t.routeId !== F.troute) return false;
      if (F.tstatus === 'active' && t.cancelled) return false;
      if (F.tstatus === 'cancelled' && !t.cancelled) return false;
      if (!q) return true;
      return (config.vessel + ' ' + trips.routeLabel(t.route) + ' ' + t.id).toLowerCase().includes(q);
    });
  }

  function tripsTab(el) {
    el.innerHTML = `${head('ship', 'Trips & Seats', 'View trips, check seat availability, and manage trip schedules.')}
      <div class="of-filters">
        <label>Date${dateInput('td', F.tdate)}</label>
        <label>Route<div class="of-input"><select id="tr"><option value="all">All routes</option>${routeOptions(F.troute)}</select></div></label>
        <label>Status<div class="of-input"><select id="ts">${[['all', 'All'], ['active', 'Active'], ['cancelled', 'Cancelled']].map(([v, t]) => `<option value="${v}" ${F.tstatus === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></label>
        <label class="grow">Search<div class="of-input">${icon('search')}<input id="tq" value="${esc(F.tq)}" placeholder="Search by vessel, route or trip ID"></div></label>
        <button class="of-btn ghost" id="clr">${icon('refresh')} Clear</button></div>
      <p class="of-hint">Leave the date empty to list the next 14 days.</p>
      <div id="tl"></div>`;
    $('#td', el).addEventListener('change', e => { F.tdate = e.target.value; F.tpage = 1; list(); });
    $('#tr', el).addEventListener('change', e => { F.troute = e.target.value; F.tpage = 1; list(); });
    $('#ts', el).addEventListener('change', e => { F.tstatus = e.target.value; F.tpage = 1; list(); });
    $('#tq', el).addEventListener('input', e => { F.tq = e.target.value; F.tpage = 1; list(); });
    $('#clr', el).addEventListener('click', () => { F.tdate = ''; F.troute = 'all'; F.tstatus = 'all'; F.tq = ''; F.tpage = 1; tripsTab(el); });

    function list() {
      const all = tripList();
      const pages = Math.max(1, Math.ceil(all.length / TRIPS_PER_PAGE));
      if (F.tpage > pages) F.tpage = pages;
      const view = all.slice((F.tpage - 1) * TRIPS_PER_PAGE, F.tpage * TRIPS_PER_PAGE);
      $('#tl', el).innerHTML = (view.length ? view.map(t => {
        const cap = trips.sellableCount(t), av = trips.availableCount(t);
        const dd = new Date(t.date + 'T00:00:00');
        const fromP = config.ports[t.route.from], toP = config.ports[t.route.to];
        return `<div class="of-trow">
          <div class="d"><small>${dd.toLocaleDateString('en-PH', { weekday: 'short' })}</small><b>${dd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</b></div>
          <div class="r"><b>${esc(trips.routeLabel(t.route))}</b><small>${esc(fromP.area)} → ${esc(toP.area)}</small></div>
          <div><small>Departure</small><b>${u.fmtTime(t.departs)}</b></div>
          <div class="v"><small>Vessel</small><span>${esc(config.vessel)}</span></div>
          <div><small>Total Seats</small><b>${cap}</b></div><div><small>Booked</small><b>${cap - av}</b></div><div><small>Available</small><b>${av}</b></div>
          <div><small>Status</small>${t.cancelled ? '<span class="of-pill bad">● Cancelled</span>' : '<span class="of-pill ok">● Active</span>'}</div>
          <div class="acts"><button class="of-btn outline sm" data-seats="${t.id}">${icon('eye')} View Seats</button><button class="of-kebab" data-manage="${t.id}" aria-label="Trip actions">${icon('dots')}</button></div>
        </div>`;
      }).join('') : '<p class="of-empty">No trips match.</p>') + pager(all.length, F.tpage, TRIPS_PER_PAGE, 'trips');
    }
    list();
    $('#tl', el).addEventListener('click', e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) { F.tpage = Number(pg.dataset.pg); return list(); }
      const s = e.target.closest('[data-seats]'), m = e.target.closest('[data-manage]');
      const id = (s || m) && (s || m).dataset[s ? 'seats' : 'manage'];
      if (!id) return;
      const [date, routeId] = id.split('|');
      openTrip(date, routeId, !!s, list);
    });
  }

  // Modal to manage one trip: time, cancel, note and (optionally) the seat plan
  function openTrip(date, routeId, withSeats, onChange) {
    const m = u.modal('', 'wide');
    function paint() {
      const t = trips.get(date, routeId);
      m.el.innerHTML = `<div class="of-modal"><h3>${esc(trips.routeLabel(t.route))} · ${u.fmtDate(t.date)}</h3>
        <div class="of-filters slim">
          <label>Departure time<div class="of-input"><input type="time" id="time" value="${t.departs}"></div></label>
          <button class="of-btn outline" id="save-time">Save time</button>
          <button class="of-btn ${t.cancelled ? 'navy' : 'danger'}" id="toggle-cancel">${t.cancelled ? 'Restore trip' : 'Cancel trip'}</button></div>
        <div class="of-filters slim"><label class="grow">Note<div class="of-input"><input id="note" value="${esc(t.note)}" placeholder="e.g. Delayed due to weather"></div></label>
          <button class="of-btn outline" id="save-note">Save note</button></div>
        <p class="of-hint">Cancelling a trip stops new bookings; existing bookings stay on file so you can contact passengers.${withSeats ? ' Click a free seat to block it, or a blocked seat to release it.' : ''}</p>
        ${withSeats ? '<div id="map"></div>' : ''}</div>`;
      $('#save-time', m.el).addEventListener('click', () => { store.setTripOverride(t.id, { departs: $('#time', m.el).value || t.route.departs }); u.toast('Departure time saved.', 'ok'); paint(); onChange && onChange(); });
      $('#toggle-cancel', m.el).addEventListener('click', () => {
        if (!t.cancelled && !confirm('Cancel this trip?')) return;
        store.setTripOverride(t.id, { cancelled: !t.cancelled });
        paint(); onChange && onChange();
      });
      $('#save-note', m.el).addEventListener('click', () => { store.setTripOverride(t.id, { note: $('#note', m.el).value.trim() }); u.toast('Note saved.', 'ok'); });
      if (withSeats) paintMap();
    }
    function paintMap() {
      const cur = trips.get(date, routeId);
      seatmap.render($('#map', m.el), trips.seatMap(cur), {
        mode: 'admin',
        onSeat(n) {
          const blocked = cur.blocked.indexOf(n) >= 0 ? cur.blocked.filter(x => x !== n) : cur.blocked.concat(n);
          store.setTripOverride(cur.id, { blocked });
          paintMap(); onChange && onChange();
        },
      });
    }
    paint();
  }

  // ---- fares -------------------------------------------------------------
  const FARE_ART = { regular: ['people', 'blue'], student: ['cap', 'green'], senior_pwd: ['user', 'orange'], child: ['child', 'purple'], infant: ['infant', 'pink'] };

  function fares(el) {
    const f = store.fares();
    el.innerHTML = `${head('tag', 'Fares', 'Manage ticket fares for all passenger categories.')}
      <div class="of-cols">
        <div class="of-panel pad">${config.fareOrder.map(id => `<div class="of-fare">
          <span class="of-circ ${FARE_ART[id] ? FARE_ART[id][1] : 'blue'}">${icon(FARE_ART[id] ? FARE_ART[id][0] : 'tag')}</span>
          <div class="n"><b>${esc(f[id].label)}</b><small>${esc(f[id].note || (f[id].seat ? 'Standard fare for all passengers.' : 'Rides on an adult\'s lap.'))}</small></div>
          <strong>${config.currency}${Number(f[id].price).toLocaleString('en-PH')}</strong>
          <button class="of-btn outline" data-edit="${id}">${icon('pencil')} Edit</button></div>`).join('')}</div>
        <aside class="of-side">
          <div class="of-panel pad blue"><h4>${icon('info', 'of-circ-ic')} Fare Information</h4><ul>
            <li>These fares apply to all trips and routes.</li><li>New fares will apply to future bookings.</li>
            <li>Existing tickets will keep the fare they were sold at.</li><li>Make sure to update schedules if there are fare changes.</li></ul></div>
          <div class="of-panel pad gold"><h4>${icon('doc', 'of-circ-ic')} Passenger Categories</h4>
            ${config.fareOrder.map(id => `<div class="of-kv"><span>${esc(f[id].label)}</span><b>${config.currency}${Number(f[id].price).toLocaleString('en-PH')}</b></div>`).join('')}</div>
        </aside></div>`;
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.edit;
      const m = u.modal(`<div class="of-modal"><h3>Edit fare: ${esc(f[id].label)}</h3>
        <form id="ff"><label>Price (${config.currency})<div class="of-input"><input type="number" min="0" step="0.01" id="price" value="${f[id].price}" required></div></label>
        <p class="of-hint">Applies to future bookings only.</p>
        <div class="of-filters slim"><button class="of-btn navy">Save fare</button></div></form></div>`);
      $('#ff', m.el).addEventListener('submit', e => {
        e.preventDefault();
        const map = {};
        config.fareOrder.forEach(k => (map[k] = f[k].price));
        map[id] = Number($('#price', m.el).value) || 0;
        store.setFarePrices(map);
        u.toast('Fare saved.', 'ok');
        m.close();
        fares(el);
      });
    }));
  }

  // ---- data --------------------------------------------------------------
  function data(el) {
    el.innerHTML = `${head('database', 'Data Management', 'Export, import, and manage booking data. All data is stored locally on this computer.')}
      <div class="of-data">
        <div class="of-dcard blue"><span class="of-circ blue">${icon('file')}</span><h3>Export Bookings (CSV)</h3><p>Download all booking records in CSV format. You can open this file in Excel or other spreadsheet software.</p><button class="of-btn solid blue" id="csv">${icon('download')} Export as CSV</button></div>
        <div class="of-dcard green"><span class="of-circ green">${icon('doc')}</span><h3>Download Full Backup (JSON)</h3><p>Download a complete backup of all system data (bookings, trips, fares, etc.) in JSON format.</p><button class="of-btn solid green" id="json">${icon('download')} Download Backup</button></div>
        <div class="of-dcard purple"><span class="of-circ purple">${icon('upload')}</span><h3>Load Sample Bookings (Testing)</h3><p>Import sample booking records for testing and demonstration purposes. They are added to your current data.</p><button class="of-btn solid purple" id="sample">${icon('upload')} Load Sample Data</button></div>
        <div class="of-dcard red"><span class="of-circ red">${icon('trash')}</span><h3>Erase All Data</h3><p>Permanently delete all bookings, trips, fares, and other data stored in this computer. This action cannot be undone.</p><button class="of-btn solid red" id="reset">${icon('trash')} Erase All Data</button></div>
        <aside class="of-dcard info"><h4>${icon('info', 'of-circ-ic')} Data Information</h4><ul>
          <li>All data is stored locally in this browser (computer) using localStorage.</li><li>Back up your data regularly to prevent accidental loss.</li>
          <li>Sample data is for testing only and can be removed anytime.</li><li>The erase option will permanently delete all data. Make sure to create a backup before proceeding.</li></ul></aside>
      </div>`;

    $('#csv', el).addEventListener('click', () => {
      const headRow = ['Ref', 'Date', 'Route', 'Departs', 'Passenger', 'Fare type', 'Seat', 'Amount', 'Contact', 'Phone', 'Payment', 'Status', 'Boarded'];
      const lines = [headRow.join(',')];
      store.bookings().forEach(b => b.passengers.forEach(p => lines.push([
        b.ref, b.date, trips.routeLabel(trips.route(b.routeId)), trips.get(b.date, b.routeId).departs, p.name, p.fareType, p.seat || '', p.fare,
        b.contact.name, b.contact.phone, b.payment.status, b.status, p.boarded ? 'yes' : 'no',
      ].map(u.csvCell).join(','))));
      u.download('g7-bookings.csv', lines.join('\n'), 'text/csv');
    });
    $('#json', el).addEventListener('click', () => u.download('g7-backup.json', JSON.stringify(store.exportAll(), null, 2), 'application/json'));
    $('#sample', el).addEventListener('click', () => { const n = sampleData(); u.toast(n + ' sample bookings added.', 'ok'); });
    $('#reset', el).addEventListener('click', () => {
      if (confirm('Erase ALL bookings, trip changes and fare changes? This cannot be undone.')) { store.resetAll(); u.toast('All data erased.', 'ok'); }
    });
  }

  // Creates a few random bookings for today and tomorrow (testing only)
  function sampleData() {
    const names = ['Juan Dela Cruz', 'Maria Santos', 'Jose Reyes', 'Ana Garcia', 'Pedro Ramos', 'Liza Mendoza', 'Carlo Bautista', 'Rosa Aquino'];
    let made = 0;
    [u.today(), u.addDays(u.today(), 1)].forEach(date => config.routes.forEach(r => {
      const t = trips.get(date, r.id);
      for (let k = 0; k < 5; k++) {
        const free = Object.keys(trips.seatMap(t)).filter(n => trips.seatMap(t)[n].state === 'available');
        const n = 1 + Math.floor(Math.random() * 3);
        if (free.length < n) break;
        const types = ['regular', 'regular', 'student', 'senior_pwd', 'child'];
        const fares = store.fares();
        const pax = [];
        for (let i = 0; i < n; i++) {
          const ft = types[Math.floor(Math.random() * types.length)];
          pax.push({ fareType: ft, fare: fares[ft].price, seat: Number(free.splice(Math.floor(Math.random() * free.length), 1)[0]), name: names[Math.floor(Math.random() * names.length)], age: ft === 'child' ? 8 : '', boarded: false });
        }
        const ref = u.newRef(date);
        store.addBooking({
          ref, tripId: t.id, date, routeId: r.id, createdAt: new Date().toISOString(),
          contact: { name: pax[0].name, phone: '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), email: '' },
          passengers: pax, total: pax.reduce((s, p) => s + p.fare, 0),
          payment: { method: 'cash', status: Math.random() > 0.5 ? 'paid' : 'unpaid' }, status: 'confirmed',
        });
        made++;
      }
    }));
    return made;
  }

  G7.views = G7.views || {};
  G7.views.office = { render };
})();
