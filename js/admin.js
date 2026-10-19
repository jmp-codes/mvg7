/* ============================================================
 * admin.js  -  Ticket Office (staff area)
 * Tabs: Dashboard, Bookings, Manifest, Trips & Seats, Fares, Data
 * ============================================================ */
window.G7 = window.G7 || {};

(function () {
  const { u, config, trips, store, seatmap, ticket, icon, pay, auth } = G7;
  const { esc, $, $$ } = u;

  // [key, label, icon, adminOnly]
  const TABS = [
    ['dashboard', 'Dashboard', 'home'],
    ['bookings', 'Bookings', 'calendar'],
    ['payments', 'Payments', 'coins'],
    ['manifest', 'Manifest', 'people'],
    ['trips', 'Trips & Seats', 'ship'],
    ['fares', 'Fares', 'tag', true],
    ['staff', 'Staff', 'user', true],
    ['data', 'Data Management', 'database', true],
  ];
  const tabsFor = () => TABS.filter(t => !t[3] || G7.auth.isAdmin());

  let root = null;
  let tab = 'dashboard';
  const F = {
    date: u.today(), routeId: config.routes[0].id,
    q: '', fdate: '', status: 'all', page: 1, size: 10, sort: { key: 'created', dir: -1 },
    mtrip: '', tsort: 'asc', mpage: 1, msort: { key: 'seat', dir: 1 }, tdate: '', troute: 'all', tstatus: 'all', tq: '', tpage: 1, mq: '',
  };

  const authed = () => !!auth.me();

  function render(container) {
    root = container;
    authed() ? draw() : login();
  }

  async function login() {
    document.body.classList.remove('is-office-app');
    root.innerHTML = '<div class="of-login"><div class="of-login-card"><header><div><h2>Ticket Office</h2><p>Loading…</p></div></header></div></div>';
    let staff = [];
    try { staff = await auth.loginOptions(); } catch (e) { console.error(e); u.toast('Cannot reach the server.', 'err'); }
    const cloud = !!(G7.cloud && G7.cloud.on);
    // staff created in the app sign in by name; the first administrator (real email) uses the email option
    const opts = staff.map(x => `<option value="${esc(x.id)}" data-email="${esc(x.email)}">${esc(x.name)}</option>`).join('')
      + (cloud ? '<option value="__email">Sign in with email…</option>' : '');
    root.innerHTML = `<div class="of-login"><div class="of-login-card">
      <header><div><h2>Ticket Office</h2><p>Staff only. ${cloud ? 'Choose your name and enter your PIN.' : 'Choose your name and enter your PIN.'}</p></div><span class="of-login-ic">${icon('ticket')}</span></header>
      <form id="login"><label>Staff
        <div class="of-input">${icon('user')}<select id="who">${opts}</select></div></label>
        <label id="emlab" hidden>Email
        <div class="of-input">${icon('user')}<input type="email" id="em" placeholder="you@example.com" autocomplete="username"></div></label>
        <label><span id="pinlab">PIN</span>
        <div class="of-input">${icon('lock')}<input type="password" id="pin" placeholder="Enter your PIN" autocomplete="current-password" required></div></label>
        <button class="of-btn teal">${icon('login')} Sign in</button></form>
      <div class="of-divider">${icon('shield')}</div>
      <div class="of-info">${icon('info')}<p>This area is restricted to authorized ticket office staff only. Please keep your PIN confidential.</p></div>
    </div></div>`;
    const who = $('#who', root);
    const sync = () => {
      const o = who.options[who.selectedIndex];
      const needEmail = cloud && o && (o.value === '__email' || !o.dataset.email);
      $('#emlab', root).hidden = !needEmail;
      $('#em', root).required = !!needEmail;
      $('#pinlab', root).textContent = needEmail ? 'Password' : 'PIN';
    };
    who.addEventListener('change', sync); sync();
    $('#login', root).addEventListener('submit', async e => {
      e.preventDefault();
      const o = who.options[who.selectedIndex], btn = $('#login .of-btn', root);
      btn.disabled = true;
      let ok = null;
      try { ok = await auth.login(who.value, $('#pin').value, cloud ? (o.dataset.email || $('#em').value) : ''); } catch (err) { console.error(err); }
      btn.disabled = false;
      if (ok) { tab = 'dashboard'; draw(); }
      else { u.toast('Wrong PIN or password.', 'err'); $('#pin').value = ''; $('#pin').focus(); }
    });
  }

  const BRAND = `<a class="brand" href="index.html#/home" aria-label="G7 Marine Transport home">
      <svg class="logo-mark" viewBox="0 0 80 40" aria-hidden="true"><path d="M2 30c10-8 18-8 28-2s20 6 30-2" fill="none" stroke="#1b8fc7" stroke-width="3" stroke-linecap="round"/><path d="M6 35c10-6 18-6 28-1s20 5 32-1" fill="none" stroke="#0a2f7a" stroke-width="2" stroke-linecap="round"/><text x="26" y="26" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="26" fill="#0a2f7a">G7</text></svg>
      <span class="brand-text"><b>G7 MARINE</b><b>TRANSPORT</b></span>
      <img class="logo-img" src="assets/logo-white.png" alt="G7 Marine Transport" onload="this.parentNode.classList.add('has-logo')" onerror="this.remove()"></a>`;

  function draw() {
    document.body.classList.add('is-office-app'); // sidebar layout replaces the public header
    root.innerHTML = `<div class="os">
      <aside class="os-side no-print">${BRAND}<div class="os-label">TICKET OFFICE</div>
        <nav>${tabsFor().map(([k, t, ic]) => `<button class="os-link ${k === tab ? 'on' : ''}" data-tab="${k}">${icon(ic)}${t}</button>`).join('')}</nav>
        <div class="os-foot"><div class="os-acct"><div class="os-menu" id="acct-menu" hidden><a href="#" id="chpin">${icon('lock')} Change my PIN</a><a href="index.html#/home">${icon('home')} Back to website</a></div>
          <button class="os-acct-btn" id="acct" aria-haspopup="true"><span class="of-avatar">${icon('user')}</span><span class="who"><b>${esc(auth.me().name)}</b><small>${auth.me().role === 'admin' ? 'Administrator' : 'Cashier'}</small></span> <span class="sp"></span>${icon('chevdown')}</button></div>
          <button class="os-signout" id="logout">${icon('logout')} Sign out</button></div></aside>
      <div class="os-main"><div class="of os-body" id="tab-body"></div></div></div>`;
    $$('[data-tab]', root).forEach(b => b.addEventListener('click', async () => { tab = b.dataset.tab; if (G7.cloud && G7.cloud.on) await G7.cloud.refreshBookings(); draw(); }));
    $('#acct', root).addEventListener('click', e => { e.stopPropagation(); const m = $('#acct-menu', root); m.hidden = !m.hidden; });
    document.addEventListener('click', function close(e) {
      const m = $('#acct-menu', root);
      if (!m) return document.removeEventListener('click', close);
      if (!e.target.closest || !e.target.closest('.os-acct')) m.hidden = true;
    });
    $('#chpin', root).addEventListener('click', e => { e.preventDefault(); $('#acct-menu', root).hidden = true; G7.officePay.pinModal(); });
    $('#logout', root).addEventListener('click', async () => { await auth.logout(); login(); });
    if (!tabsFor().some(t => t[0] === tab)) tab = 'dashboard';
    const ctx = { head, F, pager, openPop, bindPopClose, payPill, dateInput };
    ({ dashboard, bookings: el => G7.officeBookings.render(el, ctx), manifest, trips: tripsTab, fares, data, payments: el => G7.officePay.paymentsTab(el, ctx), staff: el => G7.officePay.staffTab(el, ctx) })[tab]($('#tab-body', root));
  }

  // ---- shared bits --------------------------------------------------------
  const routeOptions = (sel, withTime) => config.routes.map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(trips.routeLabel(r))}${withTime ? ' (' + u.fmtTime(trips.get(F.date, r.id).departs) + ')' : ''}</option>`).join('');
  const tripLabel = t => trips.routeLabel(t.route) + ' (' + u.fmtTime(t.departs) + ')';
  const confirmedFor = tid => store.bookings().filter(b => b.tripId === tid && b.status === 'confirmed');
  const paxCount = list => list.reduce((n, b) => n + b.passengers.length, 0);
  const payPill = (b, cls) => {
    const st = b.payment.status;
    if (cls === 'od') return st === 'paid' ? '<span class="od-pill ok">Paid</span>' : st === 'refunded' ? '<span class="od-pill bad">Refunded</span>' : '<span class="od-pill warn">Unpaid</span>';
    return st === 'paid' ? `<span class="of-pill ok">${icon('checkcircle')}Paid</span>` : st === 'refunded' ? `<span class="of-pill bad">${icon('refresh')}Refunded</span>` : `<span class="of-pill warn">${icon('clock')}Unpaid</span>`;
  };
  const todayPill = () => `<div class="od-date static">${icon('calendarcheck')}<div><b>Today</b><small>${u.fmtDate(u.today())}</small></div></div>`;
  const head = (ic, title, sub, right) => `<header class="od-head op"><div class="op-t">${icon(ic, 'op-ic')}<div><h2>${title}</h2><p>${sub}</p></div></div><div class="op-r">${todayPill()}${right || ''}</div></header>`;
  let popBound = false; // one global listener closes any open row menu
  function bindPopClose() {
    if (popBound) return;
    popBound = true;
    document.addEventListener('click', e => {
      if (!e.target.closest || !e.target.closest('[data-kebab],.of-pop')) $$('.of-pop').forEach(x => x.remove());
    });
  }
  // Opens a small menu inside cell td. items: [{act, label, icon, danger}]
  function openPop(td, ref, items) {
    $$('.of-pop').forEach(x => x.remove());
    const pop = document.createElement('div');
    pop.className = 'of-pop';
    pop.innerHTML = items.map(it => `<button class="${it.danger ? 'danger' : ''}" data-act="${it.act}" data-ref="${esc(ref)}">${icon(it.icon)} ${it.label}</button>`).join('');
    td.appendChild(pop);
  }
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
  const dayStats = date => {
    const ts = trips.forDate(date);
    const list = [];
    ts.forEach(t => confirmedFor(t.id).forEach(b => list.push(b)));
    return { trips: ts, bookings: list.length, pax: paxCount(list), sales: pay.totals(date).net };
  };
  function delta(now, before, money) {
    const d = now - before;
    if (d === 0) return '<span class="flat">Same as yesterday</span>';
    const up = d > 0, arrow = up ? '↑' : '↓';
    const pct = before > 0 ? Math.round(Math.abs(d) / before * 100) + '%' : '';
    const amt = money ? (before > 0 ? pct : u.money(Math.abs(d))) : Math.abs(d);
    return `<span class="${up ? 'up' : 'down'}">${arrow} ${amt} ${up ? '' : 'less '}from yesterday</span>`;
  }

  function dashboard(el) {
    const day = dayStats(F.date), prev = dayStats(u.addDays(F.date, -1));
    const isToday = F.date === u.today();
    const recent = store.bookings().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

    el.innerHTML = `<header class="od-head"><div><small class="eyebrow">TICKET OFFICE</small><h2>Dashboard</h2><p>Overview of ticketing operations, trips, and bookings.</p></div>
        <label class="od-date no-print">${icon('calendarcheck')}<div><b>${isToday ? 'Today' : 'Selected date'}</b><small>${u.fmtDate(F.date)}</small></div>${icon('chevdown')}<input type="date" id="d" value="${F.date}" aria-label="Date"></label></header>
      <section class="od-stats">
        <div class="od-stat"><span class="of-circ blue">${icon('ticket')}</span><div><small>Total Bookings</small><strong>${day.bookings}</strong>${delta(day.bookings, prev.bookings)}</div></div>
        <div class="od-stat"><span class="of-circ green">${icon('people')}</span><div><small>Total Passengers</small><strong>${day.pax}</strong>${delta(day.pax, prev.pax)}</div></div>
        <div class="od-stat"><span class="of-circ gold">${icon('coins')}</span><div><small>Total Sales</small><strong>${u.money(day.sales)}</strong>${delta(day.sales, prev.sales, true)}</div></div>
        <div class="od-stat"><span class="of-circ purple">${icon('ship')}</span><div><small>${isToday ? "Today's Trips" : 'Trips'}</small><strong>${day.trips.length}</strong><span class="flat">${new Set(day.trips.map(t => t.routeId)).size} route(s) · ${day.trips.filter(t => t.cancelled).length} cancelled</span></div></div>
      </section>
      <section class="od-cols">
        <div class="od-card"><header>${icon('ship', 'od-ic')}<div class="ttl"><h3>${isToday ? "Today's Trips" : 'Trips'}</h3><p>Scheduled trips for ${isToday ? 'today' : 'this date'} with seat availability.</p></div><button class="od-all" id="all-trips">View All ${icon('chevright')}</button></header>
          <div class="of-scroll"><table class="od-tbl"><thead><tr><th>Time</th><th>Route</th><th>Vessel</th><th>Seats</th><th>Occupancy</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          ${day.trips.map(t => { const cap = trips.sellableCount(t), sold = cap - trips.availableCount(t), pct = cap ? Math.round(sold / cap * 100) : 0; return `<tr><td>${u.fmtTime(t.departs)}</td><td>${esc(trips.routeLabel(t.route))}${t.extra ? ' <span class="of-badge gold">EXTRA</span>' : ''}</td><td>${esc(config.vessel)}</td><td>${sold} / ${cap}</td><td><div class="od-occ"><i style="width:${pct}%"></i><span>${pct}%</span></div></td>
            <td>${t.cancelled ? '<span class="od-pill bad">● Cancelled</span>' : '<span class="od-pill ok">● Active</span>'}</td>
            <td class="od-acts"><button class="od-ico" data-seats="${t.id}" aria-label="View seats" title="View seats">${icon('eye')}</button><button class="od-ico" data-manage="${t.id}" aria-label="Trip actions" title="Trip actions">${icon('dots')}</button></td></tr>`; }).join('')}</tbody></table></div></div>
        <div class="od-card"><header>${icon('doc', 'od-ic')}<div class="ttl"><h3>Recent Bookings</h3><p>Latest passenger reservations.</p></div><button class="od-all" id="all-bk">View All ${icon('chevright')}</button></header>
          ${recent.length ? `<div class="of-scroll"><table class="od-tbl"><thead><tr><th>Ref</th><th>Trip</th><th>Pax</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>
          ${recent.map(b => { const t = trips.byId(b.tripId) || trips.get(b.date, b.routeId); return `<tr><td><a href="#" class="od-ref" data-ref="${esc(b.ref)}">${esc(b.ref)}</a></td><td>${esc(config.ports[t.route.from].name.replace(' Port', ''))} → ${esc(config.ports[t.route.to].name.replace(' Port', ''))}<small>${u.fmtDate(b.date)} · ${u.fmtTime(t.departs)}</small></td><td>${b.passengers.length}</td><td>${u.money(b.total)}</td>
            <td>${b.status === 'cancelled' ? '<span class="od-pill bad">Cancelled</span>' : '<span class="od-pill ok">Confirmed</span>'}</td><td>${payPill(b, 'od')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="of-empty">No bookings yet.</p>'}</div>
      </section>`;

    $('#d', el).addEventListener('change', e => { F.date = e.target.value || u.today(); dashboard(el); });
    $('#all-trips', el).addEventListener('click', () => { F.tdate = F.date; F.troute = 'all'; F.tq = ''; F.tpage = 1; tab = 'trips'; draw(); });
    $('#all-bk', el).addEventListener('click', () => { F.q = ''; F.fdate = ''; F.status = 'all'; F.page = 1; tab = 'bookings'; draw(); });
    $$('[data-seats]', el).forEach(b => b.addEventListener('click', () => openTrip(b.dataset.seats, true, () => dashboard(el))));
    $$('[data-manage]', el).forEach(b => b.addEventListener('click', () => openTrip(b.dataset.manage, false, () => dashboard(el))));
    $$('[data-ref]', el).forEach(a => a.addEventListener('click', e => { e.preventDefault(); ticket.show(store.getBooking(a.dataset.ref)); }));
  }

  // ---- manifest ----------------------------------------------------------
  const MSORT = {
    name: r => r.p.name.toLowerCase(), contact: r => r.b.contact.phone, cat: r => (store.fares()[r.p.fareType] || {}).label || '',
    seat: r => r.p.seat || 999, pay: r => r.b.payment.status, boarded: r => (r.p.boarded ? 1 : 0), ref: r => r.b.ref,
  };

  function manifest(el) {
    const dayTrips = trips.forDate(F.date);
    const t = dayTrips.find(x => x.id === F.mtrip) || dayTrips.find(x => x.routeId === F.routeId) || dayTrips[0];
    F.mtrip = t.id;
    const rows = [];
    confirmedFor(t.id).forEach(b => b.passengers.forEach((p, i) => rows.push({ b, p, i })));
    const cap = trips.sellableCount(t);

    el.innerHTML = `${head('people', 'Passenger Manifest', 'View and print the list of passengers for a selected trip.')}
      <div class="of-filters no-print"><label class="inl">Travel date${dateInput('d', F.date)}</label>
        <label class="inl">Trip<div class="of-input"><select id="r">${dayTrips.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(tripLabel(x))}</option>`).join('')}</select></div></label><span class="sp"></span>
        <button class="of-btn navy" id="print">${icon('print')} Print Manifest</button></div>
      <div class="printable">
      <section class="of-summary">
        <div class="of-circ big">${icon('ship')}</div>
        <div class="main"><h3>${esc(trips.routeLabel(t.route))}</h3><p>${u.fmtDate(t.date)} · ${u.fmtTime(t.departs)}</p><small>${esc(config.vessel)}</small></div>
        <div class="kpi">${icon('seat')}<small>Total Seats</small><b>${cap}</b></div>
        <div class="kpi">${icon('people')}<small>Booked Passengers</small><b>${rows.length}</b></div>
        <div class="kpi">${icon('user')}<small>Available Seats</small><b>${trips.availableCount(t)}</b></div>
        ${t.cancelled ? '<span class="of-pill bad">● Cancelled</span>' : '<span class="of-pill ok">● Active</span>'}
      </section>
      <div class="of-panel"><div class="of-listbar"><div class="of-lt">${icon('people', 'of-lt-ic')}<div><h3>Passenger List</h3><span><span id="mcount">${rows.length}</span> passengers booked for this trip. <b id="bcount">${rows.filter(r => r.p.boarded).length}</b> boarded.</span></div></div>
        <div class="of-input wide no-print">${icon('search')}<input id="mq" value="${esc(F.mq)}" placeholder="Search by name, reference no., or contact..."></div></div>
      <div id="mlist"></div></div></div>`;
    $('#d', el).addEventListener('change', e => { F.date = e.target.value || u.today(); F.mtrip = ''; F.mpage = 1; manifest(el); });
    $('#r', el).addEventListener('change', e => { F.mtrip = e.target.value; F.mpage = 1; manifest(el); });
    $('#print', el).addEventListener('click', () => { const keep = F.mpage; F.mpage = 0; list(); window.print(); F.mpage = keep || 1; list(); });

    function list() {
      const q = F.mq.trim().toLowerCase();
      let v = rows.filter(r => !q || (r.p.name + ' ' + r.b.ref + ' ' + r.b.contact.phone).toLowerCase().includes(q));
      const kf = MSORT[F.msort.key] || MSORT.seat;
      v = v.slice().sort((a, b) => (kf(a) > kf(b) ? 1 : kf(a) < kf(b) ? -1 : 0) * F.msort.dir);
      const size = 10, all = F.mpage === 0;
      const pages = Math.max(1, Math.ceil(v.length / size));
      if (!all && F.mpage > pages) F.mpage = pages;
      const view = all ? v : v.slice((F.mpage - 1) * size, F.mpage * size);
      const th = (k, tx) => `<th data-msort="${k}">${tx}<span class="srt ${F.msort.key === k ? 'on' : ''}">${icon('sort')}</span></th>`;
      $('#mlist', el).innerHTML = `<div class="of-scroll"><table class="of-tbl flat"><thead><tr><th>#</th>${th('ref', 'Booking Reference')}${th('name', 'Passenger Name')}${th('contact', 'Contact Number')}${th('cat', 'Category / Fare')}${th('seat', 'Seat No.')}<th>Booking Status</th>${th('pay', 'Payment Status')}${th('boarded', 'Boarded')}<th class="no-print">Actions</th></tr></thead>
        <tbody>${view.map((r, n) => `<tr><td>${(all ? 0 : (F.mpage - 1) * size) + n + 1}</td><td><b>${esc(r.b.ref)}</b></td><td>${esc(r.p.name)}</td><td>${esc(r.b.contact.phone)}</td><td>${esc(r.p.fareLabel || (store.fares()[r.p.fareType] || {}).label || r.p.fareType)}</td><td>${r.p.seat || 'Lap'}</td>
          <td><span class="of-pill ok">Confirmed</span></td>
          <td>${r.b.payment.status === 'paid' ? '<span class="of-pill ok">Paid</span>' : '<span class="of-pill warn">Unpaid</span>'}</td>
          <td class="c"><input type="checkbox" data-ref="${r.b.ref}" data-i="${r.i}" ${r.p.boarded ? 'checked' : ''}></td>
          <td class="no-print"><button class="of-ico" data-ticket="${r.b.ref}" aria-label="View ticket" title="View ticket">${icon('ticket')}</button></td></tr>`).join('')}</tbody></table></div>
        ${v.length ? '' : `<div class="of-emptybox"><span class="of-circ big pale">${icon('people')}</span><b>No passengers booked for this trip.</b><p>Once passengers are booked, they will appear here.</p></div>`}
        <div class="no-print">${pager(v.length, all ? 1 : F.mpage, size, 'entries')}</div>`;
    }
    list();
    $('#mq', el).addEventListener('input', e => { F.mq = e.target.value; F.mpage = 1; list(); });
    $('#mlist', el).addEventListener('click', e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) { F.mpage = Number(pg.dataset.pg); return list(); }
      const sh = e.target.closest('[data-msort]');
      if (sh) { const k = sh.dataset.msort; F.msort = { key: k, dir: F.msort.key === k ? -F.msort.dir : 1 }; return list(); }
      const tk = e.target.closest('[data-ticket]');
      if (tk) ticket.show(store.getBooking(tk.dataset.ticket));
    });
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
  const TSORT = {
    asc: [(a, b) => (a.date + a.departs).localeCompare(b.date + b.departs), 'Departure (Earliest)'],
    desc: [(a, b) => (b.date + b.departs).localeCompare(a.date + a.departs), 'Departure (Latest)'],
    booked: [(a, b) => b._booked - a._booked, 'Most booked'],
    avail: [(a, b) => a._avail - b._avail, 'Fewest seats available'],
  };

  function tripList() {
    const start = F.tdate || u.today();
    const days = F.tdate ? 1 : 14;
    const out = [];
    for (let i = 0; i < days; i++) trips.forDate(u.addDays(start, i)).forEach(t => out.push(t));
    const q = F.tq.trim().toLowerCase();
    const list = out.filter(t => {
      if (F.troute !== 'all' && t.routeId !== F.troute) return false;
      if (F.tstatus === 'active' && t.cancelled) return false;
      if (F.tstatus === 'cancelled' && !t.cancelled) return false;
      if (!q) return true;
      return (config.vessel + ' ' + trips.routeLabel(t.route) + ' ' + t.id).toLowerCase().includes(q);
    });
    list.forEach(t => { t._cap = trips.sellableCount(t); t._avail = trips.availableCount(t); t._booked = t._cap - t._avail; });
    return list.sort((TSORT[F.tsort] || TSORT.asc)[0]);
  }

  // Which dates customers can book. Anything outside these ranges is closed.
  function openWindow(el) {
    const box = $('#openwin', el);
    const ranges = store.openRanges().slice().sort((a, b) => a.from.localeCompare(b.from));
    box.innerHTML = `<div class="of-panel" style="margin-bottom:14px;padding:16px 18px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between"><div><b>Dates open for booking</b>
      <div class="of-hint" style="margin:2px 0 0">Customers can only book dates inside these ranges. The daily trips run on every open date.</div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">${ranges.length ? ranges.map((r, i) => `<span class="of-pill ok" style="padding:6px 10px">${u.fmtDate(r.from)} → ${u.fmtDate(r.to)} <button type="button" data-rm="${i}" aria-label="Close these dates" style="border:0;background:none;cursor:pointer;font-size:1.1em;margin-left:4px">×</button></span>`).join('') : '<span class="of-pill bad">No dates are open. Customers cannot book.</span>'}</div>
      <form id="ow" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <label>From${dateInput('ow-f', u.today())}</label><label>To${dateInput('ow-t', u.addDays(u.today(), 30))}</label>
        <button class="of-btn navy">${icon('plus')} Open these dates</button></form></div>`;
    $$('[data-rm]', box).forEach(b => b.addEventListener('click', () => {
      const r = ranges[Number(b.dataset.rm)];
      if (!confirm('Close booking for ' + u.fmtDate(r.from) + ' to ' + u.fmtDate(r.to) + '? Existing bookings are not cancelled.')) return;
      store.setOpenRanges(ranges.filter((x, i) => i !== Number(b.dataset.rm)));
      u.toast('Dates closed.', 'ok'); openWindow(el);
    }));
    $('#ow', box).addEventListener('submit', e => {
      e.preventDefault();
      const f = $('#ow-f', box).value, t = $('#ow-t', box).value;
      if (!f || !t) return u.toast('Choose both dates.', 'err');
      if (t < f) return u.toast('The end date must be on or after the start date.', 'err');
      if (t < u.today()) return u.toast('Those dates have already passed.', 'err');
      // merge overlapping / adjacent ranges
      const all = ranges.concat({ from: f, to: t }).sort((a, b) => a.from.localeCompare(b.from)), out = [];
      all.forEach(r => { const l = out[out.length - 1]; if (l && r.from <= u.addDays(l.to, 1)) { if (r.to > l.to) l.to = r.to; } else out.push({ from: r.from, to: r.to }); });
      store.setOpenRanges(out);
      u.toast('Dates opened for booking.', 'ok'); openWindow(el);
    });
  }

  function tripsTab(el) {
    el.innerHTML = `${head('ship', 'Trips & Seats', 'View trips, check seat availability, and manage trip schedules.', `<button class="of-btn navy" id="addtrip">${icon('plus')} Add Trip</button>`)}
      <div class="of-filters">
        <label>Date${dateInput('td', F.tdate)}</label>
        <label>Route<div class="of-input"><select id="tr"><option value="all">All routes</option>${routeOptions(F.troute)}</select></div></label>
        <label>Status<div class="of-input"><select id="ts">${[['all', 'All'], ['active', 'Active'], ['cancelled', 'Cancelled']].map(([v, t]) => `<option value="${v}" ${F.tstatus === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></label>
        <label class="grow">Search<div class="of-input">${icon('search')}<input id="tq" value="${esc(F.tq)}" placeholder="Search by vessel, route or trip ID..."></div></label>
        <button class="of-btn ghost" id="clr">${icon('filter')} Clear</button></div>
      <div class="of-panel" id="tl"></div>`;
    $('.of-filters', el).insertAdjacentHTML('beforebegin', '<div id="openwin" style="margin-top:14px"></div>');
    openWindow(el);
    $('#td', el).addEventListener('change', e => { F.tdate = e.target.value; F.tpage = 1; list(); });
    $('#tr', el).addEventListener('change', e => { F.troute = e.target.value; F.tpage = 1; list(); });
    $('#ts', el).addEventListener('change', e => { F.tstatus = e.target.value; F.tpage = 1; list(); });
    $('#tq', el).addEventListener('input', e => { F.tq = e.target.value; F.tpage = 1; list(); });
    $('#clr', el).addEventListener('click', () => { F.tdate = ''; F.troute = 'all'; F.tstatus = 'all'; F.tq = ''; F.tpage = 1; tripsTab(el); });
    $('#addtrip', el).addEventListener('click', () => addTripModal(() => tripsTab(el)));

    function list() {
      const all = tripList();
      const pages = Math.max(1, Math.ceil(all.length / TRIPS_PER_PAGE));
      if (F.tpage > pages) F.tpage = pages;
      const view = all.slice((F.tpage - 1) * TRIPS_PER_PAGE, F.tpage * TRIPS_PER_PAGE);
      $('#tl', el).innerHTML = `<div class="of-listbar"><div class="of-lt">${icon('ship', 'of-lt-ic')}<div><b>${all.length} trip(s) found</b><span>${F.tdate ? 'Showing scheduled trips for ' + u.fmtDate(F.tdate) + '.' : 'Showing scheduled trips for the next 14 days.'}</span></div></div>
        <label class="inl">Sort by <div class="of-input sm"><select id="tsort">${Object.keys(TSORT).map(k => `<option value="${k}" ${F.tsort === k ? 'selected' : ''}>${TSORT[k][1]}</option>`).join('')}</select></div></label></div>
        <div class="of-trow head"><span>Date</span><span>Route</span><span>Departure</span><span>Vessel</span><span>Total Seats</span><span>Booked</span><span>Available</span><span>Status</span><span>Actions</span></div>`
        + (view.length ? view.map(t => {
          const dd = new Date(t.date + 'T00:00:00');
          const pct = t._cap ? Math.round(t._booked / t._cap * 100) : 0;
          const fromP = config.ports[t.route.from], toP = config.ports[t.route.to];
          return `<div class="of-trow">
          <div class="d"><small>${dd.toLocaleDateString('en-PH', { weekday: 'short' })}</small><b>${dd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</b></div>
          <div class="r"><b>${esc(trips.routeLabel(t.route))}${t.extra ? ' <span class="of-badge gold">EXTRA</span>' : ''}</b><small>${icon('pin')} ${esc(fromP.area)} → ${esc(toP.area)}</small></div>
          <div><b>${u.fmtTime(t.departs)}</b></div>
          <div class="v">${icon('ship')}<span>${esc(config.vessel)}</span></div>
          <div><b>${t._cap}</b></div>
          <div class="bk"><b>${t._booked}</b><div class="of-occ"><i style="width:${pct}%"></i></div><small>${pct}%</small></div>
          <div><span class="of-pill ${t._avail ? 'ok' : 'bad'}">${t._avail}</span></div>
          <div>${t.cancelled ? '<span class="of-pill bad">● Cancelled</span>' : '<span class="of-pill ok">● Active</span>'}</div>
          <div class="acts"><button class="of-btn outline sm" data-seats="${t.id}">${icon('eye')} View Seats</button><button class="of-kebab" data-manage="${t.id}" aria-label="Trip actions">${icon('dots')}</button></div>
        </div>`;
        }).join('') : '<p class="of-empty">No trips match.</p>') + pager(all.length, F.tpage, TRIPS_PER_PAGE, 'trips');
    }
    list();
    $('#tl', el).addEventListener('change', e => { if (e.target.id === 'tsort') { F.tsort = e.target.value; F.tpage = 1; list(); } });
    $('#tl', el).addEventListener('click', e => {
      const pg = e.target.closest('[data-pg]');
      if (pg) { F.tpage = Number(pg.dataset.pg); return list(); }
      const sx = e.target.closest('[data-seats]'), m = e.target.closest('[data-manage]');
      const id = (sx || m) && (sx || m).dataset[sx ? 'seats' : 'manage'];
      if (!id) return;
      openTrip(id, !!sx, list);
    });
  }

  // Header block shared by the trip modals
  function tripHead(t) {
    const f = config.ports[t.route.from], to = config.ports[t.route.to];
    return `<header class="of-mh"><span class="of-circ big">${icon('ship')}</span><div>
      <h3>${esc(trips.routeLabel(t.route))}${t.extra ? ' <span class="of-badge gold">EXTRA TRIP</span>' : ''}${t.cancelled ? ' <span class="of-badge bad">CANCELLED</span>' : ''}</h3>
      <p>${u.fmtDate(t.date)} · ${esc(config.vessel)}</p><small>${esc(f.area)} → ${esc(to.area)}</small></div></header>`;
  }

  // Moves every confirmed booking of trip src onto trip dst. Returns { ok, reason }
  function moveBookings(src, dst) {
    const list = confirmedFor(src.id);
    const map = trips.seatMap(dst);
    const clash = [];
    list.forEach(b => b.passengers.forEach(p => { if (p.seat && (!map[p.seat] || map[p.seat].state !== 'available')) clash.push(p.seat); }));
    if (clash.length) return { ok: false, reason: 'Seat(s) ' + clash.join(', ') + ' are not free on the new trip.' };
    list.forEach(b => store.updateBooking(b.ref, x => { x.tripId = dst.id; x.date = dst.date; x.routeId = dst.routeId; }));
    return { ok: true, count: list.length };
  }

  // Modal to manage one trip: departure time, note, status, reschedule; or (withSeats) the seat plan
  function openTrip(tripId, withSeats, onChange) {
    const m = u.modal('', 'wide of-mod');
    const done = () => { onChange && onChange(); };

    function paint() {
      const t = trips.byId(tripId);
      if (!t) { m.close(); done(); return; }
      const booked = confirmedFor(t.id).length;

      if (withSeats) { m.close(); return seatEditor(tripId, onChange); }

      m.el.innerHTML = `<div class="of-modal">${tripHead(t)}
        <div class="of-mgrid">
          <section class="of-mcard"><span class="of-circ blue">${icon('clock')}</span><div class="f"><h4>Departure Time</h4><p>Set a new departure time for this trip.</p>
            <div class="of-input">${icon('clock')}<input type="time" id="time" value="${t.departs}"></div></div></section>
          <aside class="of-mnote">${icon('info', 'of-circ-ic')}<div><h4>Important</h4><ul>
            <li>A new departure time applies to this trip's existing tickets as well, so inform passengers who have already booked${booked ? ' (' + booked + ' booking' + (booked > 1 ? 's' : '') + ')' : ''}.</li>
            <li>Cancelling a trip stops new bookings; existing bookings stay on file.</li></ul></div></aside>
        </div>
        <section class="of-mcard flat"><span class="of-circ blue">${icon('doc')}</span><div class="f"><h4>Note (Optional)</h4><p>Add a note (e.g., delayed due to weather). This is shown to staff.</p>
          <textarea id="note" maxlength="200" rows="3" placeholder="e.g. Delayed due to weather">${esc(t.note)}</textarea><div class="cnt"><span id="cnt">${t.note.length}</span> / 200</div></div></section>
        <section class="of-mcard flat"><span class="of-circ blue">${icon('calendarcheck')}</span><div class="f"><h4>Reschedule to another date</h4>
          <p>Moves this trip${booked ? ' and its ' + booked + ' booking(s)' : ''} to a different day. The original trip is ${t.extra ? (booked ? 'cancelled' : 'removed') : 'cancelled'}.</p>
          <div class="of-filters slim"><div class="of-input">${icon('calendar')}<input type="date" id="rs-date" value="${t.date}" min="${u.today()}"></div>
          <div class="of-input">${icon('clock')}<input type="time" id="rs-time" value="${t.departs}"></div>
          <button class="of-btn outline" id="rs-go">Reschedule</button></div></div></section>
        <footer class="of-mfoot">
          <button class="of-btn ${t.cancelled ? 'navy' : 'danger'} left" id="toggle-cancel">${t.cancelled ? 'Restore trip' : 'Cancel trip'}</button>
          ${t.extra && !booked ? `<button class="of-btn danger left" id="del-trip">${icon('trash')} Delete trip</button>` : ''}
          <span class="sp"></span>
          <button class="of-btn ghost" id="m-cancel">Cancel</button>
          <button class="of-btn ghost" id="save-note">Save note only</button>
          <button class="of-btn navy" id="save-all">Save changes</button></footer></div>`;

      const note = $('#note', m.el);
      note.addEventListener('input', () => { $('#cnt', m.el).textContent = note.value.length; });
      const saveNote = () => store.setTripOverride(t.id, { note: note.value.trim() });
      $('#m-cancel', m.el).addEventListener('click', () => m.close());
      $('#save-note', m.el).addEventListener('click', () => { saveNote(); u.toast('Note saved.', 'ok'); done(); });
      $('#save-all', m.el).addEventListener('click', () => {
        const time = $('#time', m.el).value;
        if (!time) return u.toast('Choose a departure time.', 'err');
        const clash = trips.forDate(t.date).some(x => x.id !== t.id && x.routeId === t.routeId && x.departs === time);
        if (clash) return u.toast('Another trip on this route already departs at that time.', 'err');
        saveNote();
        store.setTripOverride(t.id, { departs: time });
        u.toast('Trip updated.', 'ok'); done(); m.close();
      });
      $('#toggle-cancel', m.el).addEventListener('click', () => {
        if (!t.cancelled && !confirm('Cancel this trip? New bookings will be stopped.')) return;
        store.setTripOverride(t.id, { cancelled: !t.cancelled });
        done(); paint();
      });
      const del = $('#del-trip', m.el);
      if (del) del.addEventListener('click', () => {
        if (!confirm('Delete this extra trip?')) return;
        store.removeExtraTrip(t.id); u.toast('Trip deleted.', 'ok'); done(); m.close();
      });
      $('#rs-go', m.el).addEventListener('click', () => {
        const date = $('#rs-date', m.el).value, time = $('#rs-time', m.el).value;
        if (!date || !time) return u.toast('Choose the new date and time.', 'err');
        if (date === t.date && time === t.departs) return u.toast('Pick a different date or time.', 'err');
        if (date === t.date) { // same day: just a new time
          if (trips.forDate(date).some(x => x.id !== t.id && x.routeId === t.routeId && x.departs === time)) return u.toast('Another trip on this route already departs at that time.', 'err');
          store.setTripOverride(t.id, { departs: time }); u.toast('Trip rescheduled to ' + u.fmtTime(time) + '.', 'ok'); done(); return paint();
        }
        if (!confirm('Move this trip to ' + u.fmtDate(date) + ' at ' + u.fmtTime(time) + '?' + (booked ? ' Its bookings move with it.' : ''))) return;
        // Target: a free extra trip on the new date at that time, or the route's default trip there (taking the new time)
        let dst = trips.forDate(date).find(x => x.routeId === t.routeId && x.departs === time);
        if (!dst) {
          const def = trips.get(date, t.routeId);
          if (!def.cancelled && confirmedFor(def.id).length === 0 && !t.extra) { store.setTripOverride(def.id, { departs: time }); dst = trips.get(date, t.routeId); }
          else { const r = trips.addExtra(date, t.routeId, time); if (!r.ok) return u.toast(r.reason, 'err'); dst = r.trip; }
        }
        if (dst.cancelled) store.setTripOverride(dst.id, { cancelled: false });
        const mv = moveBookings(t, dst);
        if (!mv.ok) { if (dst.extra) store.removeExtraTrip(dst.id); return u.toast(mv.reason, 'err'); }
        if (t.extra && !booked) store.removeExtraTrip(t.id);
        else store.setTripOverride(t.id, { cancelled: true, note: ('Rescheduled to ' + u.fmtDate(date) + ' ' + u.fmtTime(time)).slice(0, 200) });
        u.toast('Trip rescheduled to ' + u.fmtDate(date) + '.', 'ok'); done(); m.close();
      });
    }

    paint();
  }

  // Seat plan editor: block/release seats on one trip, or mark seats under maintenance for all trips
  function seatEditor(tripId, onChange) {
    const t = trips.byId(tripId);
    if (!t) return;
    const m = u.modal('', 'of-mod of-seatmodal');
    const pending = new Set();
    let mode = 'block'; // 'block' = this trip only, 'maint' = every trip

    function paint() {
      const cur = trips.byId(tripId), map = trips.seatMap(cur);
      const nums = Object.keys(map);
      const total = nums.filter(n => map[n].state !== 'oos').length;
      const booked = nums.filter(n => map[n].state === 'booked').length;
      const avail = nums.filter(n => map[n].state === 'available').length;
      const f = config.ports[t.route.from], to = config.ports[t.route.to];
      const maint = nums.filter(n => map[n].state === 'oos').map(Number).sort((a, b) => a - b);
      const blk = nums.filter(n => map[n].state === 'blocked').map(Number).sort((a, b) => a - b);
      const chips = (list, cls) => list.length ? list.map(n => `<span class="of-sc ${cls}">${n}</span>`).join('') : '<em>None</em>';
      m.el.innerHTML = `<div class="of-modal">
        <header class="of-mh"><span class="of-circ big">${icon('ship')}</span>
          <div class="grow"><h3>${esc(trips.routeLabel(t.route))}</h3><p>${u.fmtDate(t.date)} · ${u.fmtTime(cur.departs)} &nbsp;|&nbsp; ${esc(config.vessel)}</p><small>${icon('pin')} ${esc(f.area)} → ${esc(to.area)}</small></div>
          <div class="of-sstats"><div><b>${total}</b><small>Total Seats</small></div><div><b>${booked}</b><small>Booked</small></div><div><b>${avail}</b><small>Available</small></div><div class="m"><b>${maint.length}</b><small>Maintenance</small></div></div></header>
        <div class="of-seginfo">
          <div class="seg" role="tablist"><button data-mode="block" class="${mode === 'block' ? 'on' : ''}">Block / release (this trip)</button><button data-mode="maint" class="${mode === 'maint' ? 'on' : ''}">Maintenance (all trips)</button></div>
          <p>${icon('info')} ${mode === 'block'
            ? 'Click a seat to block it for this trip only, or a blocked seat to release it. Seats with bookings cannot be changed here.'
            : 'Click a seat to mark it out of service (under maintenance) on every trip, or an out-of-service seat to put it back in service. Seats with upcoming bookings cannot be taken out of service.'}</p></div>
        <div class="of-strip"><div class="maint"><b>${icon('wrench')} Under maintenance (all trips)</b>${chips(maint, 'maint')}</div><div class="blk"><b>${icon('lock')} Blocked on this trip</b>${chips(blk, 'blk')}</div></div>
        <div class="of-sgrid">${config.sections.map(sec => { const ns = G7.seatmap.seatNumbers(sec); return `<section class="of-ssec"><header><h4>${esc(sec.name)}</h4><span>${ns.length} seats</span></header><div data-sec="${sec.id}"></div></section>`; }).join('')}</div>
        <footer class="of-sfoot"><div class="of-leg"><span><i class="seat-chip available"></i>Available</span><span><i class="seat-chip sel"></i>Selected</span><span><i class="seat-chip taken"></i>Taken</span><span><i class="seat-chip blocked"></i>Blocked</span><span><i class="seat-chip oos"></i>Under maintenance</span></div>
          <span class="sp"></span><button class="of-btn ghost" id="s-back">${icon('back')} Back</button><button class="of-btn navy" id="s-save">${icon('lock')} Save Changes${pending.size ? ' (' + pending.size + ')' : ''}</button></footer></div>`;

      config.sections.forEach(sec => {
        seatmap.render($('[data-sec="' + sec.id + '"]', m.el), map, {
          mode: 'admin', section: sec.id, selected: Array.from(pending), legend: false, stern: false,
          onSeat(n) { if (pending.has(n)) pending.delete(n); else pending.add(n); paint(); },
        });
      });
      $$('[data-mode]', m.el).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; pending.clear(); paint(); }));
      $('#s-back', m.el).addEventListener('click', () => m.close());
      $('#s-save', m.el).addEventListener('click', () => {
        if (!pending.size) return m.close();
        const nums = Array.from(pending);
        if (mode === 'block') {
          let blocked = cur.blocked.slice();
          nums.forEach(n => { blocked = blocked.indexOf(n) >= 0 ? blocked.filter(x => x !== n) : blocked.concat(n); });
          store.setTripOverride(cur.id, { blocked });
        } else {
          let oos = store.maintenanceSeats().slice();
          const upcoming = store.bookings().filter(b => b.status === 'confirmed' && b.date >= u.today());
          const clash = nums.filter(n => oos.indexOf(n) < 0 && upcoming.some(b => b.passengers.some(p => p.seat === n)));
          if (clash.length) return u.toast('Seat(s) ' + clash.join(', ') + ' have upcoming bookings. Move or cancel those first.', 'err');
          nums.forEach(n => { oos = oos.indexOf(n) >= 0 ? oos.filter(x => x !== n) : oos.concat(n); });
          store.setMaintenanceSeats(oos.sort((a, b) => a - b));
        }
        u.toast('Seat changes saved.', 'ok');
        onChange && onChange();
        m.close();
      });
    }
    paint();
  }

  // Modal to add a new (extra) trip on any route/date
  function addTripModal(onDone) {
    const m = u.modal(`<div class="of-modal"><header class="of-mh"><span class="of-circ big">${icon('ship')}</span><div><h3>Add Trip</h3><p>Add an extra departure to the schedule.</p></div></header>
      <form id="at" class="of-mform">
        <label>Date${dateInput('at-d', u.today())}</label>
        <label>Route<div class="of-input"><select id="at-r">${routeOptions(config.routes[0].id)}</select></div></label>
        <label>Departure time<div class="of-input">${icon('clock')}<input type="time" id="at-t" value="${config.routes[0].departs}" required></div></label>
        <p class="of-hint">The default 07:00 / 10:00 trips already exist every day. Use this for additional sailings, or on a day when the route needs another time.</p>
        <footer class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="at-x">Cancel</button><button class="of-btn navy">Add trip</button></footer>
      </form></div>`, 'of-mod');
    $('#at-r', m.el).addEventListener('change', e => { $('#at-t', m.el).value = config.routes.find(r => r.id === e.target.value).departs; });
    $('#at-x', m.el).addEventListener('click', () => m.close());
    $('#at', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const r = trips.addExtra($('#at-d', m.el).value, $('#at-r', m.el).value, $('#at-t', m.el).value);
      if (!r.ok) return u.toast(r.reason, 'err');
      u.toast('Trip added.', 'ok');
      F.tdate = r.trip.date; F.tpage = 1;
      m.close(); onDone();
    });
  }

  // ---- fares -------------------------------------------------------------
  const FARE_ART = { regular: ['people', 'blue'], student: ['cap', 'green'], senior_pwd: ['user', 'orange'], child: ['child', 'purple'], infant: ['infant', 'pink'] };
  const DOTS = ['#1b7fe0', '#1c9b5a', '#f08a1c', '#a45be0', '#e0485f', '#0aa7b5', '#8a6d3b', '#5b6a82'];
  const money0 = n => config.currency + Number(n).toLocaleString('en-PH');

  function fareModal(id, done) {
    const f = id ? store.fares()[id] : null;
    const custom = !f || f.custom;
    const m = u.modal(`<div class="of-modal"><h3>${f ? 'Edit fare: ' + esc(f.label) : 'Add Category'}</h3>
      <form id="ff">
        ${custom ? `<label>Category name<div class="of-input"><input id="f-label" value="${esc(f ? f.label : '')}" placeholder="e.g. Group (10+)" required maxlength="40"></div></label>
        <label>Description<div class="of-input"><input id="f-note" value="${esc(f ? f.note : '')}" placeholder="Shown to passengers" maxlength="90"></div></label>` : ''}
        <label>Price (${config.currency})<div class="of-input"><input type="number" min="0" step="0.01" id="f-price" value="${f ? f.price : ''}" required></div></label>
        ${custom ? `<label class="chk"><input type="checkbox" id="f-adult" ${!f || f.adult ? 'checked' : ''}> Counts as an adult (can travel with an infant)</label>` : ''}
        <p class="of-hint">Applies to future bookings only. Custom categories take a seat.</p>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="f-x">Cancel</button><button class="of-btn navy">Save</button></div></form></div>`, 'of-mod');
    $('#f-x', m.el).addEventListener('click', () => m.close());
    $('#ff', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const price = Number($('#f-price', m.el).value);
      if (!(price >= 0)) return u.toast('Enter a valid price.', 'err');
      if (custom) {
        const label = $('#f-label', m.el).value.trim();
        if (!label) return u.toast('Enter a category name.', 'err');
        const list = store.customFares();
        const rec = { id: id || 'c' + Date.now().toString(36), label, note: $('#f-note', m.el).value.trim(), price, seat: true, adult: $('#f-adult', m.el).checked };
        if (id) list.splice(list.findIndex(x => x.id === id), 1, rec); else list.push(rec);
        store.saveCustomFares(list);
      } else {
        const map = {};
        Object.keys(config.fares).forEach(k => (map[k] = store.fares()[k].price));
        map[id] = price;
        store.setFarePrices(map);
      }
      u.toast('Fare saved.', 'ok'); m.close(); done();
    });
  }

  function fares(el) {
    bindPopClose();
    const f = store.fares(), order = store.fareOrder();
    el.innerHTML = `${head('tag', 'Fares', 'Manage ticket fares for all passenger categories.')}
      <div class="of-cols">
        <div class="of-panel pad">
          <div class="of-fhead"><span class="of-circ blue">${icon('people')}</span><div><h3>Passenger Categories</h3><p>Set and update the standard fares for each passenger category.</p></div>
            <button class="of-btn navy" id="addcat">${icon('plus')} Add Category</button></div>
          <div class="of-frow th"><span>Category</span><span>Fare</span><span>Actions</span></div>
          ${order.map(id => { const art = FARE_ART[id] || ['tag', 'purple']; return `<div class="of-frow">
            <div class="c"><span class="of-circ ${art[1]}">${icon(art[0])}</span><div><b>${esc(f[id].label)}</b><small>${esc(f[id].note || (f[id].seat ? 'Standard fare for all passengers.' : 'Rides on an adult\'s lap, no seat assigned.'))}</small></div></div>
            <strong>${money0(f[id].price)}</strong>
            <div class="acts"><button class="of-btn outline" data-edit="${id}">${icon('pencil')} Edit</button><button class="of-kebab" data-kebab="${id}" aria-label="More">${icon('dots')}</button></div></div>`; }).join('')}
        </div>
        <aside class="of-side">
          <div class="of-panel pad blue"><h4><span class="of-circ-ic">${icon('info')}</span> Fare Information</h4><ul class="chk">
            <li>These fares apply to all trips and routes.</li><li>New fares will apply to future bookings.</li>
            <li>Existing tickets will keep the fare they were sold at.</li><li>Make sure to update schedules if there are fare changes.</li></ul></div>
          <div class="of-panel pad gold"><h4><span class="of-circ-ic">${icon('chart')}</span> Fare Summary</h4>
            ${order.map((id, n) => `<div class="of-kv"><span><i class="dot" style="background:${DOTS[n % DOTS.length]}"></i>${esc(f[id].label)}</span><b>${money0(f[id].price)}</b></div>`).join('')}</div>
        </aside></div>`;
    const again = () => fares(el);
    $('#addcat', el).addEventListener('click', () => fareModal(null, again));
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => fareModal(b.dataset.edit, again)));
    $$('[data-kebab]', el).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.kebab, had = b.parentNode.querySelector('.of-pop');
      if (had) return had.remove();
      const custom = f[id].custom;
      openPop(b.parentNode, id, custom ? [{ act: 'edit', label: 'Edit', icon: 'pencil' }, { act: 'del', label: 'Delete category', icon: 'trash', danger: true }]
        : [{ act: 'edit', label: 'Edit price', icon: 'pencil' }, { act: 'reset', label: 'Reset to default price', icon: 'refresh' }]);
      $$('.of-pop [data-act]', b.parentNode).forEach(x => x.addEventListener('click', () => {
        $$('.of-pop').forEach(p => p.remove());
        if (x.dataset.act === 'edit') fareModal(id, again);
        if (x.dataset.act === 'del' && confirm('Delete this category? Past tickets keep their fare.')) { store.saveCustomFares(store.customFares().filter(c => c.id !== id)); u.toast('Category deleted.', 'ok'); again(); }
        if (x.dataset.act === 'reset') { const map = {}; Object.keys(config.fares).forEach(k => { if (k !== id) map[k] = store.fares()[k].price; }); store.setFarePrices(map); u.toast('Price reset.', 'ok'); again(); }
      }));
    }));
  }

  // ---- data --------------------------------------------------------------
  const ART = {
    csv: '<svg viewBox="0 0 120 80" class="of-art"><rect x="34" y="6" width="52" height="64" rx="5" fill="#fff" stroke="#9fb6dc" stroke-width="2"/><text x="42" y="22" font-size="11" font-weight="700" fill="#0a2f7a" font-family="system-ui">CSV</text><rect x="42" y="30" width="36" height="26" rx="2" fill="#e6f6ee" stroke="#1c9b5a"/><path d="M42 39h36M42 48h36M54 30v26M66 30v26" stroke="#1c9b5a" fill="none"/><circle cx="82" cy="62" r="11" fill="#0a3a7a"/><path d="M82 56v10M77 62l5 5 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    json: '<svg viewBox="0 0 120 80" class="of-art"><rect x="34" y="6" width="52" height="64" rx="5" fill="#fff" stroke="#9fd3b4" stroke-width="2"/><text x="40" y="22" font-size="11" font-weight="700" fill="#12703f" font-family="system-ui">JSON</text><text x="44" y="52" font-size="22" font-weight="700" fill="#1c9b5a" font-family="monospace">{ }</text><circle cx="82" cy="62" r="11" fill="#1c7a47"/><path d="M82 56v10M77 62l5 5 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    sample: '<svg viewBox="0 0 120 80" class="of-art"><rect x="34" y="6" width="52" height="64" rx="5" fill="#fff" stroke="#c9b6ee" stroke-width="2"/><path d="M42 20h30M42 30h22M42 40h30M42 50h18" stroke="#a58be0" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="62" r="11" fill="#6b3fd4"/><path d="M82 68V57M77 62l5-5 5 5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    erase: '<svg viewBox="0 0 120 80" class="of-art"><ellipse cx="58" cy="18" rx="22" ry="8" fill="#f6b8c0"/><path d="M36 18v38c0 5 10 9 22 9s22-4 22-9V18" fill="#f9cfd5"/><ellipse cx="58" cy="18" rx="22" ry="8" fill="#f4a9b4"/><circle cx="82" cy="60" r="12" fill="#d63a50"/><path d="M76 56h12M79 56v-2h6v2M77 56l1 10h8l1-10" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  };

  function storageBytes() {
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('g7.') === 0) n += (k.length + String(localStorage.getItem(k)).length) * 2; } } catch (e) { /* storage blocked */ }
    return n;
  }
  const fmtBytes = n => (n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  function data(el) {
    const bks = store.bookings();
    const tripIds = new Set(bks.map(b => b.tripId).concat(Object.keys(store.tripOverrides()), store.extraTrips().map(t => t.id)));
    const pax = bks.filter(b => b.status === 'confirmed').reduce((n, b) => n + b.passengers.length, 0);
    const used = storageBytes(), LIMIT = 5 * 1048576, pct = Math.min(100, Math.round(used / LIMIT * 100));

    el.innerHTML = `${head('database', 'Data Management', 'Export, import, and manage booking data. ' + ((G7.cloud && G7.cloud.on) ? 'Data is stored in the shared G7 database.' : 'All data is stored locally on this computer.'))}
      <div class="of-data">
        <div class="of-dcard blue"><span class="of-circ blue">${icon('file')}</span><h3>Export Bookings (CSV)</h3><p>Download all booking records in CSV format. You can open this file in Excel or other spreadsheet software.</p>${ART.csv}<button class="of-btn solid blue" id="csv">${icon('download')} Export as CSV</button></div>
        <div class="of-dcard green"><span class="of-circ green">${icon('database')}</span><h3>Download Full Backup (JSON)</h3><p>Download a complete backup of all system data (bookings, trips, fares, etc.) in JSON format.</p>${ART.json}<button class="of-btn solid green" id="json">${icon('download')} Download Backup</button></div>
        ${(G7.cloud && G7.cloud.on) ? '' : `<div class="of-dcard purple"><span class="of-circ purple">${icon('upload')}</span><h3>Load Sample Bookings (Testing)</h3><p>Import sample booking records for testing and demonstration purposes. They are added to your current data.</p>${ART.sample}<button class="of-btn solid purple" id="sample">${icon('upload')} Load Sample Data</button></div>`}
        <div class="of-dcard red"><span class="of-circ red">${icon('trash')}</span><h3>Erase All Data</h3><p>Permanently delete all bookings, trips, fares, and other data stored in this computer. <b>This action cannot be undone.</b></p>${ART.erase}<button class="of-btn solid red" id="reset">${icon('trash')} Erase All Data</button></div>
        <aside class="of-dcard info"><h4><span class="of-circ-ic">${icon('info')}</span> Data Information</h4><ul class="chk">
          <li>${(G7.cloud && G7.cloud.on) ? 'All data is stored in the shared G7 database, so every staff device sees the same bookings.' : 'All data is stored locally in this browser (computer) using localStorage.'}</li><li>Back up your data regularly to prevent accidental loss.</li>
          <li>Sample data is for testing only and can be removed anytime.</li><li>The erase option will permanently delete all data. Make sure to create a backup before proceeding.</li></ul></aside>
      </div>
      <div class="of-dlow">
        <div class="of-panel pad"><div class="of-fhead">${icon('database', 'of-lt-ic')}<div><h3>Current Data Summary</h3><p>Overview of data stored in this computer.</p></div><button class="of-btn ghost" id="refresh">${icon('refresh')} Refresh</button></div>
          <div class="of-sumtiles">
            <div class="t1">${icon('ticket')}<span>Bookings</span><b>${bks.length}</b><small>Total records</small></div>
            <div class="t2">${icon('ship')}<span>Trips</span><b>${tripIds.size}</b><small>Trips with records</small></div>
            <div class="t3">${icon('tag')}<span>Fares</span><b>${store.fareOrder().length}</b><small>Fare categories</small></div>
            <div class="t4">${icon('people')}<span>Passengers</span><b>${pax}</b><small>Total passengers</small></div></div></div>
        <div class="of-panel pad"><div class="of-fhead">${icon('chart', 'of-lt-ic')}<div><h3>Storage Usage</h3><p>Local storage usage in this browser.</p></div></div>
          <div class="of-store"><div class="bar"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>
          <div class="of-kv"><span>Used Storage</span><b>${fmtBytes(used)}</b></div><div class="of-kv"><span>Total Available</span><b>5.0 MB</b></div><div class="of-kv"><span>Estimated Capacity</span><b>~ 5 MB (browser limit)</b></div>
          <div class="of-info2">${icon('info')}<p>Data is stored in your browser's localStorage. Clearing browser data may remove all records.</p></div></div>
      </div>`;

    $('#refresh', el).addEventListener('click', () => data(el));
    $('#csv', el).addEventListener('click', () => {
      const headRow = ['Ref', 'Date', 'Route', 'Departs', 'Passenger', 'Fare type', 'Seat', 'Amount', 'Contact', 'Phone', 'Payment', 'Payment method', 'Receipt no', 'Received by', 'Refunded', 'Status', 'Boarded'];
      const lines = [headRow.join(',')];
      store.bookings().forEach(b => b.passengers.forEach(p => lines.push([
        b.ref, b.date, trips.routeLabel(trips.route(b.routeId)), (trips.byId(b.tripId) || trips.get(b.date, b.routeId)).departs, p.name, p.fareLabel || p.fareType, p.seat || '', p.fare,
        b.contact.name, b.contact.phone, b.payment.status, b.payment.method, b.payment.receiptNo || '', b.payment.receivedByName || '', b.payment.refund ? b.payment.refund.amount : '', b.status, p.boarded ? 'yes' : 'no',
      ].map(u.csvCell).join(','))));
      u.download('g7-bookings.csv', lines.join('\n'), 'text/csv');
    });
    $('#json', el).addEventListener('click', () => u.download('g7-backup.json', JSON.stringify(store.exportAll(), null, 2), 'application/json'));
    if ($('#sample', el)) $('#sample', el).addEventListener('click', () => { const n = sampleData(); u.toast(n + ' sample bookings added.', 'ok'); data(el); });
    $('#reset', el).addEventListener('click', async () => {
      if (confirm('Erase ALL bookings, trip changes and fare changes? This cannot be undone.')) { try { await store.resetAll(); u.toast('All data erased.', 'ok'); } catch (e) { u.toast('Could not erase: ' + (e.message || e), 'err'); } data(el); }
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
        const bk = {
          ref, tripId: t.id, date, routeId: r.id, createdAt: new Date().toISOString(),
          contact: { name: pax[0].name, phone: '09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), email: '' },
          passengers: pax, total: pax.reduce((s, p) => s + p.fare, 0),
          payment: { method: 'cash', status: 'unpaid' }, status: 'confirmed',
        };
        if (Math.random() > 0.5) pay.seedPaid(bk, (auth.me() || {}).name || 'Sample');
        store.addBooking(bk);
        made++;
      }
    }));
    return made;
  }

  G7.views = G7.views || {};
  G7.views.office = { render };
})();
