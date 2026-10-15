/* ============================================================
 * office-bookings.js  -  Ticket Office "Bookings" tab
 * Stat cards, filters (+ more filters), selectable table, and the
 * Booking Details side panel (a pop-up on narrow screens).
 * Called from admin.js: G7.officeBookings.render(el, ctx)
 * ============================================================ */
window.G7 = window.G7 || {};

G7.officeBookings = (function () {
  const { u, config, trips, store, icon, pay, auth, ticket } = G7;
  const { esc, $, $$ } = u;
  const money = u.money;

  const SORTS = {
    ref: b => b.ref, trip: b => b.date + (tripOf(b).departs || ''), contact: b => b.contact.name.toLowerCase(), pax: b => b.passengers.length,
    total: b => b.total, payment: b => b.payment.status, status: b => b.status, created: b => b.createdAt,
  };
  const tripOf = b => trips.byId(b.tripId) || trips.get(b.date, b.routeId);
  const wide = () => window.matchMedia('(min-width: 1200px)').matches;
  const seatsOf = b => b.passengers.map(p => p.seat).filter(Boolean).join(', ') || '—';
  const pct = (n, d) => (d ? Math.round(n / d * 100) : 0);

  // Status shown in the details header
  function headPill(b) {
    const st = b.payment.status;
    if (b.status === 'cancelled') return `<span class="of-pill bad">${icon('xcircle')}Cancelled</span>`;
    if (st === 'paid') return `<span class="of-pill ok">${icon('checkcircle')}Paid</span>`;
    if (st === 'refunded') return `<span class="of-pill bad">${icon('refresh')}Refunded</span>`;
    return `<span class="of-pill warn">${icon('clock')}Pending Payment</span>`;
  }

  // ---- Booking Details panel ------------------------------------------------
  function detailHTML(b, inModal) {
    const t = tripOf(b), p = b.payment, st = p.status;
    const logRows = (p.log || []).slice().reverse().map(e => {
      const lab = { paid: 'Payment received', void: 'Payment voided', refund: 'Refund' }[e.type] || e.type;
      const cls = e.type === 'paid' ? 'ok' : e.type === 'void' ? 'warn' : 'bad';
      return `<li><span class="dot ${cls}"></span><div><b>${lab} · ${e.type === 'paid' ? '' : e.type === 'refund' ? '−' : ''}${money(e.amount)}</b>
        <small>${esc(pay.methodLabel(e.method))}${e.no ? ' · ' + esc(e.no) : ''} · ${esc(e.by)}</small><small>${new Date(e.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}${e.note ? ' · ' + esc(e.note) : ''}</small></div></li>`;
    }).join('');
    const confirmed = b.status === 'confirmed';
    let primary = '';
    if (confirmed && st === 'unpaid') primary = `<button class="of-btn ob-green" data-act="pay" data-ref="${esc(b.ref)}">${icon('coins')} Receive Payment</button>`;
    else if (st === 'paid') primary = `<button class="of-btn ob-green" data-act="receipt" data-ref="${esc(b.ref)}">${icon('doc')} View Receipt</button>`;
    else if (st === 'refunded') primary = `<button class="of-btn ob-purple" data-act="refundvoucher" data-ref="${esc(b.ref)}">${icon('doc')} View Refund Voucher</button>`;
    const refundBtn = !confirmed && st === 'paid' ? `<button class="of-btn ob-purple" data-act="refund" data-ref="${esc(b.ref)}">${icon('refresh')} Refund Payment</button>` : '';
    return `<div class="ob-detail">
      <div class="ob-dh"><span class="of-circ blue">${icon('clipboard')}</span><h3>Booking Details</h3>${inModal ? '' : `<button class="ob-x" id="pclose" aria-label="Close details">${icon('xcircle')}</button>`}</div>
      <div class="ob-ref"><b>${esc(b.ref)}</b>${headPill(b)}</div>
      <p class="ob-when">${u.fmtDate(b.date)} • ${u.fmtTime(t.departs)}</p>
      <p class="ob-route">${esc(trips.routeLabel(t.route))}</p>
      <span class="of-chip">${icon('ship')} ${esc(config.vessel)}</span>
      <div class="ob-sum">
        <div>${icon('user')}<small>Contact Person</small><b>${esc(b.contact.name)}</b><span>${icon('phone')} ${esc(b.contact.phone)}</span>${b.contact.email ? `<span>${icon('mail')} ${esc(b.contact.email)}</span>` : ''}</div>
        <div>${icon('people')}<small>Passengers</small><b>${b.passengers.length}</b><span>Seats: ${esc(seatsOf(b))}</span></div>
        <div>${icon('coins')}<small>Total Amount</small><b class="amt">${money(b.total)}</b></div></div>
      <div class="ob-acts">${primary}${refundBtn}
        ${confirmed ? `<button class="of-btn outline" data-act="edit" data-ref="${esc(b.ref)}">${icon('pencil')} Edit Booking</button>` : ''}
        <button class="of-btn outline" data-act="tickets" data-ref="${esc(b.ref)}">${icon('ticket')} View / Print Ticket</button>
        ${confirmed && st === 'paid' ? `<button class="of-btn outline" data-act="void" data-ref="${esc(b.ref)}">${icon('xcircle')} Void Payment</button>` : ''}
        ${confirmed ? `<button class="of-btn danger" data-act="cancel" data-ref="${esc(b.ref)}">${icon('trash')} ${st === 'paid' ? 'Cancel &amp; Refund' : 'Cancel Booking'}</button>` : ''}</div>
      <h4 class="ob-h">${icon('card')} Payment Information</h4>
      <div class="ob-pi"><div><small>Status</small><b class="${st === 'paid' ? 'ok' : st === 'refunded' ? 'bad' : 'warn'}">${icon(st === 'paid' ? 'checkcircle' : st === 'refunded' ? 'refresh' : 'clock')} ${st === 'paid' ? 'Paid' : st === 'refunded' ? 'Refunded' : 'Unpaid'}</b></div>
        <div><small>${st === 'paid' ? 'Amount paid' : st === 'refunded' ? 'Refunded' : 'Amount due'}</small><b>${money(st === 'refunded' && p.refund ? p.refund.amount : b.total)}</b></div>
        <div><small>Method</small><b>${esc(pay.methodLabel(p.method))}</b></div></div>
      <h4 class="ob-h">${icon('clock')} Payment History</h4>
      ${logRows ? `<ul class="ob-log">${logRows}</ul>` : '<p class="ob-none">No payment recorded yet.</p>'}
      <h4 class="ob-h">${icon('people')} Passengers</h4>
      <ul class="ob-pax">${b.passengers.map((x, i) => `<li><span>${i + 1}</span><div><b>${esc(x.name || '—')}</b><small>${esc(x.fareLabel || x.fareType)}${x.seat ? ' · Seat ' + x.seat : ' · Lap infant'}</small></div><em>${money(x.fare)}</em></li>`).join('')}</ul>
      ${b.status === 'cancelled' ? `<p class="of-hint">Cancelled${b.cancelledAt ? ' ' + new Date(b.cancelledAt).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : ''}${b.cancelledBy ? ' by ' + esc(b.cancelledBy) : ''}${b.cancelReason ? ' · ' + esc(b.cancelReason) : ''}</p>` : ''}
    </div>`;
  }

  // ---- Edit booking (contact + passenger details; seats & fares are not editable) ------
  function editModal(ref, done) {
    const b = store.getBooking(ref), staff = auth.me();
    if (!b || b.status !== 'confirmed') return u.toast('Only confirmed bookings can be edited.', 'err');
    const needsId = f => f === 'student' || f === 'senior_pwd';
    const m = u.modal(`<div class="of-modal pay-modal ob-edit"><h3>Edit booking · ${esc(b.ref)}</h3>
      <form id="ef" novalidate>
        <h4 class="ob-h">${icon('user')} Contact person</h4>
        <label>Full name<div class="of-input"><input id="en" maxlength="60" value="${esc(b.contact.name)}" required></div></label>
        <div class="pay-grid"><label>Mobile number<div class="of-input">${icon('phone')}<input id="ep" inputmode="tel" maxlength="20" value="${esc(b.contact.phone)}" required></div></label>
        <label>Email (optional)<div class="of-input">${icon('mail')}<input id="ee" type="email" maxlength="80" value="${esc(b.contact.email || '')}"></div></label></div>
        <h4 class="ob-h">${icon('people')} Passengers</h4>
        ${b.passengers.map((p, i) => `<div class="ob-pe"><b>${i + 1}. ${esc(p.fareLabel || p.fareType)}${p.seat ? ' · Seat ' + p.seat : ' · Lap infant'}</b>
          <label>Name<div class="of-input"><input data-i="${i}" data-f="name" maxlength="60" value="${esc(p.name || '')}" required></div></label>
          ${p.fareType === 'child' || p.fareType === 'infant' ? `<label>Age<div class="of-input"><input data-i="${i}" data-f="age" type="number" min="0" max="17" value="${esc(p.age == null ? '' : p.age)}"></div></label>` : ''}
          ${needsId(p.fareType) || p.idNumber ? `<div class="pay-grid"><label>ID type<div class="of-input"><select data-i="${i}" data-f="idType"><option value="">Select ID type</option>${config.idTypes.map(t => `<option ${t === p.idType ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div></label>
            <label>ID number<div class="of-input"><input data-i="${i}" data-f="idNumber" maxlength="30" value="${esc(p.idNumber || '')}"></div></label></div>` : ''}</div>`).join('')}
        <p class="of-hint">Seats, fares and the trip can't be changed here. To change those, cancel this booking and make a new one.</p>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="ex">Close</button><button class="of-btn navy">Save changes</button></div></form></div>`, 'of-mod pay-mod');
    $('#ex', m.el).addEventListener('click', m.close);
    $('#ef', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#en', m.el).value.trim(), phone = $('#ep', m.el).value.trim(), email = $('#ee', m.el).value.trim();
      if (!name) return u.toast('Enter the contact name.', 'err');
      if (!/^[+\d][\d\s-]{6,}$/.test(phone)) return u.toast('Enter a valid mobile number.', 'err');
      const names = $$('[data-f=name]', m.el);
      if (names.some(i => !i.value.trim())) return u.toast('Every passenger needs a name.', 'err');
      store.updateBooking(ref, x => {
        x.contact.name = name; x.contact.phone = phone; x.contact.email = email;
        $$('[data-i]', m.el).forEach(inp => { const p = x.passengers[Number(inp.dataset.i)]; if (p) p[inp.dataset.f] = inp.dataset.f === 'age' ? inp.value : inp.value.trim(); });
        x.editedAt = new Date().toISOString(); x.editedBy = staff ? staff.name : '';
      });
      m.close(); u.toast('Booking updated.', 'ok'); done();
    });
  }

  // ---- main render ---------------------------------------------------------------
  function render(el, ctx) {
    const { head, F, pager, openPop, bindPopClose, payPill, dateInput } = ctx;
    bindPopClose();
    F.sel = F.sel || new Set();
    if (F.route2 === undefined) { F.route2 = 'all'; F.pm = 'all'; F.dep = 'all'; }
    const extraCount = () => ['route2', 'pm', 'dep'].filter(k => F[k] !== 'all').length;

    el.innerHTML = `${head('calendar', 'Bookings', 'Manage and monitor all booking records.')}
      <div class="ob">
      <div class="ob-main">
        <section class="ob-stats" id="stats"></section>
        <div class="of-filters ob-filters">
          <label class="grow">Search<div class="of-input">${icon('search')}<input id="q" value="${esc(F.q)}" placeholder="Search by reference no., name, or phone..."></div></label>
          <label>Travel date${dateInput('fd', F.fdate)}</label>
          <label>Status<div class="of-input"><select id="st">${[['all', 'All'], ['confirmed', 'Confirmed'], ['unpaid', 'Pending payment'], ['paid', 'Paid'], ['cancelled', 'Cancelled'], ['refunded', 'Refunded']].map(([v, t]) => `<option value="${v}" ${F.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></label>
          <button class="of-btn ghost ob-more" id="more" aria-expanded="false">${icon('filter')} More filters<span class="ob-n" id="moren" ${extraCount() ? '' : 'hidden'}>${extraCount()}</span></button>
          <button class="of-btn navy" id="newb">${icon('plus')} New Booking</button>
          <div class="ob-extra" id="extra" hidden>
            <label>Route<div class="of-input"><select id="f-route"><option value="all">All routes</option>${config.routes.map(r => `<option value="${r.id}" ${F.route2 === r.id ? 'selected' : ''}>${esc(trips.routeLabel(r))}</option>`).join('')}</select></div></label>
            <label>Payment method<div class="of-input"><select id="f-pm"><option value="all">Any method</option>${Object.keys(config.paymentMethods).map(k => `<option value="${k}" ${F.pm === k ? 'selected' : ''}>${esc(pay.methodLabel(k))}</option>`).join('')}</select></div></label>
            <label>Departure time<div class="of-input"><select id="f-dep"><option value="all">Any time</option>${Array.from(new Set(config.routes.map(r => r.departs))).sort().map(d => `<option value="${d}" ${F.dep === d ? 'selected' : ''}>${u.fmtTime(d)}</option>`).join('')}</select></div></label>
            <button class="of-btn ghost" id="clr">Clear all filters</button></div>
        </div>
        <div class="of-panel" id="list"></div>
      </div>
      <aside class="ob-side" id="detail"></aside></div>`;

    const filtered = () => {
      const q = F.q.trim().toLowerCase();
      return store.bookings().filter(b => {
        if (F.fdate && b.date !== F.fdate) return false;
        if (F.status === 'confirmed' && b.status !== 'confirmed') return false;
        if (F.status === 'cancelled' && b.status !== 'cancelled') return false;
        if (F.status === 'unpaid' && !(b.status === 'confirmed' && b.payment.status === 'unpaid')) return false;
        if (F.status === 'paid' && b.payment.status !== 'paid') return false;
        if (F.status === 'refunded' && b.payment.status !== 'refunded') return false;
        if (F.route2 !== 'all' && b.routeId !== F.route2) return false;
        if (F.pm !== 'all' && b.payment.method !== F.pm) return false;
        if (F.dep !== 'all' && tripOf(b).departs !== F.dep) return false;
        if (!q) return true;
        return [b.ref, b.contact.name, b.contact.phone].concat(b.passengers.map(p => p.name)).join(' ').toLowerCase().includes(q);
      });
    };

    function stats() {
      const all = store.bookings(), n = all.length;
      const conf = all.filter(b => b.status === 'confirmed').length;
      const pend = all.filter(b => b.status === 'confirmed' && b.payment.status === 'unpaid').length;
      const canc = all.filter(b => b.status === 'cancelled').length;
      const now = Date.now(), wk = 7 * 864e5;
      const thisW = all.filter(b => now - new Date(b.createdAt) < wk).length, lastW = all.filter(b => now - new Date(b.createdAt) >= wk && now - new Date(b.createdAt) < 2 * wk).length;
      const delta = (lastW && thisW !== lastW) ? `<span class="${thisW >= lastW ? 'up' : 'down'}">${thisW >= lastW ? '↑ +' : '↓ '}${Math.round((thisW - lastW) / lastW * 100)}% from last week</span>` : `<span class="flat">${thisW} in the last 7 days</span>`;
      const card = (cls, ic, num, label, sub, key) => `<button class="ob-stat ${cls} ${F.status === key ? 'on' : ''}" data-statf="${key}">${icon(ic, 'ob-sic')}<div><b>${num}</b><strong>${label}</strong><small>${sub}</small></div></button>`;
      $('#stats', el).innerHTML = card('s1', 'doc', n, 'Total Bookings', delta, 'all') + card('s2', 'checkcircle', conf, 'Confirmed', pct(conf, n) + '% of total', 'confirmed')
        + card('s3', 'clock', pend, 'Pending Payment', pct(pend, n) + '% of total', 'unpaid') + card('s4', 'xcircle', canc, 'Cancelled', pct(canc, n) + '% of total', 'cancelled');
    }

    function table() {
      const rows = filtered(), kf = SORTS[F.sort.key] || SORTS.created;
      rows.sort((a, b) => (kf(a) > kf(b) ? 1 : kf(a) < kf(b) ? -1 : 0) * F.sort.dir);
      const pages = Math.max(1, Math.ceil(rows.length / F.size));
      if (F.page > pages) F.page = pages;
      const view = rows.slice((F.page - 1) * F.size, F.page * F.size);
      const th = (k, t) => `<th data-sort="${k}">${t}<span class="srt ${F.sort.key === k ? 'on' : ''}">${icon('sort')}</span></th>`;
      const allOn = view.length && view.every(b => F.sel.has(b.ref));
      const nsel = F.sel.size;
      $('#list', el).innerHTML = `<div class="of-listbar"><div class="of-lt">${icon('doc', 'of-lt-ic')}<b>${rows.length} booking(s) found</b></div>
        <label class="inl">Show <div class="of-input sm"><select id="size">${[10, 25, 50].map(n => `<option ${F.size === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div> entries</label></div>
        ${nsel ? `<div class="ob-bulk"><b>${nsel} selected</b><button class="of-btn sm outline" id="bulk-csv">${icon('download')} Export selected (CSV)</button><button class="of-btn sm ghost" id="bulk-clr">Clear selection</button></div>` : ''}
        ${view.length ? `<div class="of-scroll"><table class="of-tbl ob-tbl"><thead><tr><th class="ck"><input type="checkbox" id="selall" aria-label="Select all on this page" ${allOn ? 'checked' : ''}></th>${th('ref', 'Ref')}${th('trip', 'Trip Details')}${th('contact', 'Contact')}${th('pax', 'Pax')}${th('total', 'Total')}${th('payment', 'Payment')}${th('status', 'Status')}<th></th></tr></thead><tbody>
        ${view.map(b => { const t = tripOf(b); return `<tr data-ref="${esc(b.ref)}" class="${b.status === 'cancelled' ? 'dim' : ''} ${F.active === b.ref ? 'active' : ''}">
          <td class="ck"><input type="checkbox" data-sel="${esc(b.ref)}" aria-label="Select ${esc(b.ref)}" ${F.sel.has(b.ref) ? 'checked' : ''}></td>
          <td><a href="#" class="of-ref" data-open="${esc(b.ref)}">${esc(b.ref)}</a></td>
          <td><b class="ob-dt">${u.fmtDate(b.date)} • ${u.fmtTime(t.departs)}</b><small>${esc(trips.routeLabel(t.route))}</small><span class="of-chip">${icon('ship')} ${esc(config.vessel)}</span></td>
          <td>${esc(b.contact.name)}<small class="ph">${icon('phone')} ${esc(b.contact.phone)}</small></td>
          <td>${b.passengers.length}</td><td><b>${money(b.total)}</b></td><td>${payPill(b)}</td>
          <td>${b.status === 'cancelled' ? `<span class="of-pill bad">${icon('xcircle')}Cancelled</span>` : `<span class="of-pill ok">${icon('checkcircle')}Confirmed</span>`}</td>
          <td class="acts"><button class="of-kebab" data-kebab="${esc(b.ref)}" aria-label="More actions">${icon('dots')}</button></td></tr>`; }).join('')}
        </tbody></table></div>` : '<p class="of-empty">No bookings match.</p>'}
        ${pager(rows.length, F.page, F.size, 'entries')}`;
    }

    function panel() {
      const box = $('#detail', el), b = F.active && store.getBooking(F.active);
      if (!b) { box.innerHTML = `<div class="ob-detail ob-empty">${icon('clipboard', 'big')}<h3>Booking Details</h3><p>Select a booking from the list to see its details, payment history and actions.</p></div>`; return; }
      box.innerHTML = detailHTML(b, false);
    }
    const refresh = () => { stats(); table(); panel(); };
    refresh();

    // filters
    const bind = (id, key, ev) => $(id, el).addEventListener(ev || 'input', e => { F[key] = e.target.value; F.page = 1; table(); stats(); });
    bind('#q', 'q'); bind('#fd', 'fdate', 'change'); bind('#st', 'status', 'change');
    const syncMore = () => { const n = extraCount(), b = $('#moren', el); b.hidden = !n; b.textContent = n; };
    [['#f-route', 'route2'], ['#f-pm', 'pm'], ['#f-dep', 'dep']].forEach(([id, k]) => $(id, el).addEventListener('change', e => { F[k] = e.target.value; F.page = 1; syncMore(); table(); }));
    $('#more', el).addEventListener('click', () => { const x = $('#extra', el); x.hidden = !x.hidden; $('#more', el).setAttribute('aria-expanded', String(!x.hidden)); });
    $('#clr', el).addEventListener('click', () => { Object.assign(F, { q: '', fdate: '', status: 'all', route2: 'all', pm: 'all', dep: 'all', page: 1 }); render(el, ctx); });
    $('#newb', el).addEventListener('click', () => { location.href = 'index.html#/book'; });
    if (extraCount()) { $('#extra', el).hidden = false; $('#more', el).setAttribute('aria-expanded', 'true'); }

    // open details: side panel on wide screens, pop-up otherwise
    function open(ref) {
      F.active = ref;
      table();
      if (wide()) return panel();
      const b = store.getBooking(ref); if (!b) return;
      const m = u.modal(`<div class="of-modal ob-modal">${detailHTML(b, true)}</div>`, 'of-mod pay-mod');
      m.el.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) { m.close(); run(a.dataset.act, a.dataset.ref); } });
    }

    function run(act, ref) {
      const OP = G7.officePay;
      if (act === 'tickets' || act === 'view') ticket.show(store.getBooking(ref));
      else if (act === 'edit') editModal(ref, refresh);
      else if (act === 'pay') OP.receiveModal(ref, refresh);
      else if (act === 'receipt') OP.receiptDialog(ref, 'payment');
      else if (act === 'refundvoucher') OP.receiptDialog(ref, 'refund');
      else if (act === 'void') OP.voidModal(ref, refresh);
      else if (act === 'cancel') OP.cancelModal(ref, refresh);
      else if (act === 'refund') OP.refundModal(ref, refresh);
    }

    if (el._ob) { el.removeEventListener('change', el._ob.ch); el.removeEventListener('click', el._ob.ck); } // render() can run again on the same element
    const onChange = e => {
      if (e.target.id === 'size') { F.size = Number(e.target.value); F.page = 1; return table(); }
      if (e.target.id === 'selall') {
        const rows = filtered().sort((a, b) => 0), start = (F.page - 1) * F.size;
        const kf = SORTS[F.sort.key] || SORTS.created; rows.sort((a, b) => (kf(a) > kf(b) ? 1 : kf(a) < kf(b) ? -1 : 0) * F.sort.dir);
        rows.slice(start, start + F.size).forEach(b => (e.target.checked ? F.sel.add(b.ref) : F.sel.delete(b.ref)));
        return table();
      }
      const s = e.target.closest('[data-sel]');
      if (s) { s.checked ? F.sel.add(s.dataset.sel) : F.sel.delete(s.dataset.sel); table(); }
    };
    const onClick = e => {
      const sc = e.target.closest('[data-statf]');
      if (sc) { F.status = sc.dataset.statf; F.page = 1; $('#st', el).value = F.status; return (stats(), table()); }
      if (e.target.closest('#pclose')) { F.active = null; table(); return panel(); }
      if (e.target.closest('#bulk-clr')) { F.sel.clear(); return table(); }
      if (e.target.closest('#bulk-csv')) {
        const rows = [['Ref', 'Date', 'Departs', 'Route', 'Contact', 'Phone', 'Pax', 'Seats', 'Total', 'Payment', 'Method', 'Status']];
        Array.from(F.sel).map(r => store.getBooking(r)).filter(Boolean).forEach(b => rows.push([b.ref, b.date, tripOf(b).departs, trips.routeLabel(tripOf(b).route), b.contact.name, b.contact.phone, b.passengers.length, seatsOf(b), b.total, b.payment.status, b.payment.method, b.status]));
        return u.download('g7-selected-bookings.csv', rows.map(r => r.map(u.csvCell).join(',')).join('\n'), 'text/csv');
      }
      const pg = e.target.closest('[data-pg]');
      if (pg) { F.page = Number(pg.dataset.pg); return table(); }
      const sh = e.target.closest('[data-sort]');
      if (sh) { const k = sh.dataset.sort; F.sort = { key: k, dir: F.sort.key === k ? -F.sort.dir : 1 }; return table(); }
      const kb = e.target.closest('[data-kebab]');
      if (kb) {
        const ref = kb.dataset.kebab, b = store.getBooking(ref);
        const had = kb.parentNode.querySelector('.of-pop');
        if (had) return had.remove();
        const items = [{ act: 'tickets', label: 'View / print ticket', icon: 'ticket' }];
        if (b.status === 'confirmed') items.push({ act: 'edit', label: 'Edit booking', icon: 'pencil' });
        return openPop(kb.parentNode, ref, items.concat(G7.officePay.menuItems(b)));
      }
      const act = e.target.closest('.of-pop [data-act], #detail [data-act]');
      if (act) { e.preventDefault(); $$('.of-pop').forEach(x => x.remove()); return run(act.dataset.act, act.dataset.ref); }
      const op = e.target.closest('[data-open]');
      if (op) { e.preventDefault(); return open(op.dataset.open); }
      const tr = e.target.closest('tr[data-ref]');
      if (tr && !e.target.closest('input,button,a,.of-pop')) open(tr.dataset.ref);
    };
    el.addEventListener('change', onChange); el.addEventListener('click', onClick); el._ob = { ch: onChange, ck: onClick };
  }

  return { render, editModal };
})();
