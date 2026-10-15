/* ============================================================
 * office-pay.js  -  Ticket Office UI for payments & staff
 * Receive payment, receipts, void, cancel/refund, Payments tab,
 * Staff tab, change-PIN. Called from admin.js (G7.officePay).
 * Business rules live in payments.js / auth.js, not here.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.officePay = (function () {
  const { u, config, trips, store, icon, pay, auth } = G7;
  const { esc, $, $$ } = u;
  const money = u.money;

  const methodOpts = sel => Object.keys(config.paymentMethods).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(pay.methodLabel(k))}</option>`).join('');
  const refLabel = m => (m === 'gcash' ? 'GCash reference no.' : 'Bank reference no.');
  const when = iso => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  const tripOf = b => trips.byId(b.tripId) || trips.get(b.date, b.routeId);
  const summary = b => { const t = tripOf(b); return `<div class="pay-sum"><div><small>Booking</small><b>${esc(b.ref)}</b><span>${esc(b.contact.name)} · ${b.passengers.length} pax</span><span>${esc(trips.routeLabel(t.route))} · ${u.fmtDate(b.date)} ${u.fmtTime(t.departs)}</span></div><div class="due"><small>Amount due</small><b>${money(b.total)}</b></div></div>`; };
  const fail = r => u.toast(r.reason || 'Something went wrong.', 'err');
  const me = () => auth.me();
  const CLOUD = !!(G7.cloud && G7.cloud.on);

  // ---- Receive payment ------------------------------------------------------
  function receiveModal(ref, done) {
    const b = store.getBooking(ref), staff = me();
    if (!b || !staff) return;
    const due = b.total;
    const m = u.modal(`<div class="of-modal pay-modal"><h3>Receive payment</h3>${summary(b)}
      <form id="pf" novalidate>
        <label>Payment method<div class="of-input"><select id="pm">${methodOpts(b.payment.method)}</select></div></label>
        <div id="cashbox"><label>Cash received (${config.currency})<div class="of-input"><input id="pt" type="number" min="0" step="0.01" inputmode="decimal" value="${due}"></div></label>
          <div class="pay-quick" id="pq"></div>
          <div class="pay-change" id="chg"></div></div>
        <div id="refbox" hidden><label><span id="reflab"></span><div class="of-input"><input id="pr" maxlength="40" placeholder="e.g. 1234 567 890" autocomplete="off"></div></label>
          <p class="of-hint">Check the payment in the ${'GCash / bank'} app before confirming.</p></div>
        <p class="of-hint">Received by <b>${esc(staff.name)}</b></p>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="px">Cancel</button><button class="of-btn navy" id="pgo">${icon('check')} Confirm payment</button></div>
      </form></div>`, 'of-mod pay-mod');
    const el = m.el, pm = $('#pm', el), pt = $('#pt', el);
    function quick() {
      const opts = [due], steps = [100, 500, 1000, 2000];
      steps.forEach(s => { const v = Math.ceil(due / s) * s; if (v > due && !opts.includes(v)) opts.push(v); });
      $('#pq', el).innerHTML = opts.slice(0, 4).map((v, i) => `<button type="button" class="of-btn sm" data-q="${v}">${i === 0 ? 'Exact ' : ''}${money(v)}</button>`).join('');
    }
    function sync() {
      const cash = pm.value === 'cash';
      $('#cashbox', el).hidden = !cash; $('#refbox', el).hidden = cash;
      $('#reflab', el).textContent = refLabel(pm.value);
      const t = Number(pt.value) || 0, chg = $('#chg', el);
      if (!cash) return;
      if (t < due) chg.innerHTML = `<span class="short">Short by <b>${money(due - t)}</b></span>`;
      else chg.innerHTML = `Change to give <b>${money(Math.round((t - due) * 100) / 100)}</b>`;
      chg.classList.toggle('bad', t < due);
    }
    quick(); sync();
    pm.addEventListener('change', sync); pt.addEventListener('input', sync);
    el.addEventListener('click', e => { const q = e.target.closest('[data-q]'); if (q) { pt.value = q.dataset.q; sync(); } });
    $('#px', el).addEventListener('click', m.close);
    $('#pf', el).addEventListener('submit', e => {
      e.preventDefault();
      const r = pay.receive(ref, { staff, method: pm.value, tendered: pt.value, reference: $('#pr', el).value });
      if (!r.ok) return fail(r);
      m.close(); u.toast('Payment received · ' + r.booking.payment.receiptNo, 'ok');
      if (done) done();
      receiptDialog(ref, 'payment', true);
    });
    setTimeout(() => (pm.value === 'cash' ? pt.select() : $('#pr', el).focus()), 30);
  }

  // ---- Receipt / refund voucher dialog --------------------------------------
  function receiptDialog(ref, kind, justDone) {
    const b = store.getBooking(ref);
    if (!b) return;
    const p = b.payment, rf = p.refund || {}, isR = kind === 'refund';
    if (isR ? !rf.refundNo : !p.receiptNo) return u.toast('No receipt for this booking.', 'err');
    const amt = isR ? rf.amount : b.total;
    const m = u.modal(`<div class="of-modal pay-modal pay-receipt">
      <div class="pay-done ${isR ? 'ref' : ''}"><span>${icon(isR ? 'refresh' : 'check')}</span><div><h3>${isR ? 'Refund recorded' : justDone ? 'Payment received' : 'Receipt'}</h3>
        <p>${isR ? 'Refund no. ' + esc(rf.refundNo) : 'Receipt no. ' + esc(p.receiptNo)} · ${esc(b.ref)}</p></div></div>
      <div class="pay-amt ${isR ? 'ref' : ''}"><small>${isR ? 'Amount to give back' : 'Amount paid'}</small><b>${money(amt)}</b>
        ${!isR && p.method === 'cash' ? `<div class="pay-chg"><span>Cash received ${money(p.amountReceived)}</span><strong>Change: ${money(p.change || 0)}</strong></div>` : `<div class="pay-chg"><span>${esc(pay.methodLabel(isR ? rf.method : p.method))}${(isR ? rf.reference : p.reference) ? ' · Ref ' + esc(isR ? rf.reference : p.reference) : ''}</span></div>`}</div>
      <p class="of-hint" style="text-align:center">${isR ? 'Refunded' : 'Received'} by ${esc((isR ? rf.byName : p.receivedByName) || '-')} · ${when(isR ? rf.at : p.paidAt)}</p>
      <div class="pay-acts"><button class="of-btn navy" data-r="print">${icon('print')} Print receipt</button><button class="of-btn outline" data-r="png">${icon('download')} Save PNG</button><button class="of-btn outline" data-r="jpg">${icon('download')} Save JPG</button></div>
      <div class="of-mfoot"><span class="sp"></span><button class="of-btn ghost" data-r="done">Done</button></div></div>`, 'of-mod pay-mod');
    m.el.addEventListener('click', e => {
      const t = e.target.closest('[data-r]'); if (!t) return;
      const a = t.dataset.r;
      if (a === 'done') return m.close();
      if (a === 'print') G7.ticketImg.printReceipt(b, kind); else G7.ticketImg.saveReceipt(b, kind, a);
    });
  }

  // ---- Void a payment ---------------------------------------------------------
  function voidModal(ref, done) {
    const b = store.getBooking(ref), staff = me();
    if (!b || !staff) return;
    const m = u.modal(`<div class="of-modal pay-modal"><h3>Void payment</h3>${summary(b)}
      <div class="of-info2">${icon('info')}<p>Use this only if the payment was recorded by mistake. The booking goes back to <b>Unpaid</b> and receipt <b>${esc(b.payment.receiptNo)}</b> is cancelled. To give money back to a customer, cancel the booking and refund instead.</p></div>
      <form id="vf"><label style="margin-top:.9rem">Reason<div class="of-input"><input id="vr" maxlength="120" placeholder="e.g. Entered on the wrong booking" required></div></label>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="vx">Keep payment</button><button class="of-btn danger">Void payment</button></div></form></div>`, 'of-mod pay-mod');
    $('#vx', m.el).addEventListener('click', m.close);
    $('#vf', m.el).addEventListener('submit', e => {
      e.preventDefault();
      const r = pay.voidPayment(ref, $('#vr', m.el).value, staff);
      if (!r.ok) return fail(r);
      m.close(); u.toast('Payment voided.', 'ok'); if (done) done();
    });
  }

  // ---- Cancel a booking (with refund when it was paid) --------------------------
  function cancelModal(ref, done) {
    const b = store.getBooking(ref), staff = me();
    if (!b || !staff) return;
    const paid = b.payment.status === 'paid';
    const m = u.modal(`<div class="of-modal pay-modal"><h3>Cancel booking</h3>${summary(b)}
      <form id="cf">
        <label>Reason for cancelling<div class="of-input"><input id="cr" maxlength="120" placeholder="e.g. Customer request / trip cancelled" required></div></label>
        ${paid ? `<div class="pay-refbox"><label class="chk"><input type="checkbox" id="rc" checked> Refund the payment now</label>
          <div id="rbox"><div class="pay-grid"><label>Refund amount (${config.currency})<div class="of-input"><input id="ra" type="number" min="0" step="0.01" value="${b.total}"></div></label>
            <label>Refund method<div class="of-input"><select id="rm">${methodOpts(b.payment.method)}</select></div></label></div>
            <div id="rrefbox" hidden><label><span id="rrl"></span><div class="of-input"><input id="rr" maxlength="40" autocomplete="off"></div></label></div>
            <p class="of-hint" id="rhint"></p></div></div>` : `<p class="of-hint">This booking is unpaid, so nothing needs to be refunded. Its seats will be released.</p>`}
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="cx">Keep booking</button><button class="of-btn danger">Cancel booking</button></div></form></div>`, 'of-mod pay-mod');
    const el = m.el;
    if (paid) {
      const sync = () => {
        const on = $('#rc', el).checked, meth = $('#rm', el).value;
        $('#rbox', el).hidden = !on; $('#rrefbox', el).hidden = meth === 'cash'; $('#rrl', el).textContent = 'Refund ' + refLabel(meth).toLowerCase();
        $('#rhint', el).textContent = meth === 'cash' ? 'Give the cash back to the customer at the counter.' : 'Send the money back first, then enter the transfer reference.';
      };
      $('#rc', el).addEventListener('change', sync); $('#rm', el).addEventListener('change', sync); sync();
    }
    $('#cx', el).addEventListener('click', m.close);
    $('#cf', el).addEventListener('submit', e => {
      e.preventDefault();
      const reason = $('#cr', el).value.trim();
      if (!reason) return u.toast('Enter a reason.', 'err');
      let refundOpts = null;
      if (paid && $('#rc', el).checked) {
        refundOpts = { staff, amount: $('#ra', el).value, method: $('#rm', el).value, reference: $('#rr', el).value, reason };
        // validate the refund first so a bad refund never leaves a half-done cancellation
        const amt = Number(refundOpts.amount);
        if (!(amt > 0) || amt > b.total) return u.toast('Refund must be between ' + money(0.01) + ' and ' + money(b.total) + '.', 'err');
        if (refundOpts.method !== 'cash' && !String(refundOpts.reference).trim()) return u.toast('Enter the refund reference number.', 'err');
      }
      store.updateBooking(ref, x => { x.status = 'cancelled'; x.cancelledAt = new Date().toISOString(); x.cancelledBy = staff.name; x.cancelReason = reason; });
      m.close();
      if (refundOpts) {
        const r = pay.refund(ref, refundOpts);
        if (!r.ok) { fail(r); if (done) done(); return; }
        u.toast('Booking cancelled and refunded.', 'ok'); if (done) done(); receiptDialog(ref, 'refund', true);
      } else { u.toast('Booking cancelled.', 'ok'); if (done) done(); }
    });
  }

  // ---- Refund a cancelled, paid booking ----------------------------------------
  function refundModal(ref, done) {
    const b = store.getBooking(ref), staff = me();
    if (!b || !staff) return;
    const m = u.modal(`<div class="of-modal pay-modal"><h3>Refund payment</h3>${summary(b)}
      <form id="rf"><div class="pay-grid"><label>Refund amount (${config.currency})<div class="of-input"><input id="ra" type="number" min="0" step="0.01" value="${b.total}"></div></label>
        <label>Refund method<div class="of-input"><select id="rm">${methodOpts(b.payment.method)}</select></div></label></div>
        <div id="rrefbox" hidden><label><span id="rrl"></span><div class="of-input"><input id="rr" maxlength="40" autocomplete="off"></div></label></div>
        <label>Reason<div class="of-input"><input id="rs" maxlength="120" value="${esc(b.cancelReason || '')}" required></div></label>
        <p class="of-hint" id="rhint"></p>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="rx">Close</button><button class="of-btn navy">Record refund</button></div></form></div>`, 'of-mod pay-mod');
    const el = m.el, sync = () => { const meth = $('#rm', el).value; $('#rrefbox', el).hidden = meth === 'cash'; $('#rrl', el).textContent = 'Refund ' + refLabel(meth).toLowerCase(); $('#rhint', el).textContent = meth === 'cash' ? 'Give the cash back to the customer at the counter.' : 'Send the money back first, then enter the transfer reference.'; };
    $('#rm', el).addEventListener('change', sync); sync();
    $('#rx', el).addEventListener('click', m.close);
    $('#rf', el).addEventListener('submit', e => {
      e.preventDefault();
      const r = pay.refund(ref, { staff, amount: $('#ra', el).value, method: $('#rm', el).value, reference: $('#rr', el).value, reason: $('#rs', el).value });
      if (!r.ok) return fail(r);
      m.close(); u.toast('Refund recorded.', 'ok'); if (done) done(); receiptDialog(ref, 'refund', true);
    });
  }

  // Menu items for a booking row (admin.js shows them)
  function menuItems(b) {
    const items = [], st = b.payment.status;
    if (b.status === 'confirmed') {
      if (st === 'unpaid') items.push({ act: 'pay', label: 'Receive payment', icon: 'coins' });
      if (st === 'paid') { items.push({ act: 'receipt', label: 'View receipt', icon: 'doc' }, { act: 'void', label: 'Void payment', icon: 'xcircle' }); }
      items.push({ act: 'cancel', label: st === 'paid' ? 'Cancel & refund' : 'Cancel booking', icon: 'trash', danger: true });
    } else {
      if (st === 'paid') items.push({ act: 'receipt', label: 'View receipt', icon: 'doc' }, { act: 'refund', label: 'Refund payment', icon: 'refresh' });
      if (st === 'refunded') items.push({ act: 'refundvoucher', label: 'View refund voucher', icon: 'doc' });
    }
    return items;
  }

  // ---- Payments tab (daily cash report) ----------------------------------------
  function paymentsTab(el, ctx) {
    const { head, F } = ctx;
    const date = F.paydate || (F.paydate = u.today());
    const t = pay.totals(date), led = pay.ledger(date);
    const typeLabel = { paid: ['Payment', 'ok'], void: ['Voided', 'warn'], refund: ['Refund', 'bad'] };
    el.innerHTML = `${head('coins', 'Payments', 'Daily collections, refunds and the cash report.')}
      <div class="of-filters no-print"><label class="inl">Report date<div class="of-input">${icon('calendar')}<input type="date" id="pd" value="${date}"></div></label>
        <button class="of-btn ghost" id="pt-today">Today</button><span class="sp"></span>
        <button class="of-btn outline" id="pcsv">${icon('download')} Export CSV</button><button class="of-btn navy" id="pprint">${icon('print')} Print report</button></div>
      <div class="printable"><div class="pay-rhead only-print"><b>${esc(config.company)} · Cash report</b><span>${u.fmtDate(date)}</span></div>
      <section class="of-sumtiles pay-tiles">
        <div class="t2">${icon('coins')}<span>Net sales</span><b>${money(t.net)}</b><small>${money(t.collected)} collected − ${money(t.refunds)} refunds</small></div>
        <div class="t3">${icon('card')}<span>Cash in drawer</span><b>${money(t.cashInDrawer)}</b><small>Cash received − cash refunds</small></div>
        <div class="t1">${icon('phone')}<span>GCash &amp; bank</span><b>${money((t.byMethod.gcash || 0) + (t.byMethod.bank || 0) - (t.refundByMethod.gcash || 0) - (t.refundByMethod.bank || 0))}</b><small>GCash ${money(t.byMethod.gcash || 0)} · Bank ${money(t.byMethod.bank || 0)}</small></div>
        <div class="t4">${icon('clock')}<span>Still unpaid</span><b>${money(pay.outstanding())}</b><small>Confirmed bookings, all dates</small></div></section>
      <div class="of-panel" style="margin-top:1rem"><div class="of-listbar"><div class="of-lt">${icon('people', 'of-lt-ic')}<div><h3>By staff</h3><span>Money handled on ${u.fmtDate(date)}</span></div></div></div>
        ${Object.keys(t.byStaff).length ? `<div class="of-scroll"><table class="of-tbl"><thead><tr><th>Staff</th><th>Payments</th><th>Collected</th><th>Refunds</th><th>Cash to hand in</th></tr></thead><tbody>
          ${Object.values(t.byStaff).map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${s.count}</td><td>${money(s.collected)}</td><td>${money(s.refunds)}</td><td><b>${money(s.cash)}</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="of-empty">No payments on this date.</p>'}</div>
      <div class="of-panel" style="margin-top:1rem"><div class="of-listbar"><div class="of-lt">${icon('doc', 'of-lt-ic')}<div><h3>Transactions</h3><span>${led.length} entr${led.length === 1 ? 'y' : 'ies'} on ${u.fmtDate(date)}</span></div></div></div>
        ${led.length ? `<div class="of-scroll"><table class="of-tbl"><thead><tr><th>Time</th><th>Type</th><th>No.</th><th>Booking</th><th>Method</th><th>Amount</th><th>Staff</th><th>Details</th></tr></thead><tbody>
          ${led.map(e => { const tl = typeLabel[e.type]; const sign = e.type === 'paid' ? '+' : '−'; return `<tr><td>${new Date(e.at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</td>
            <td><span class="of-pill ${tl[1]}">${tl[0]}</span></td><td>${esc(e.no || '')}</td><td><b>${esc(e.ref)}</b><small>${esc(e.customer || '')}</small></td><td>${esc(pay.methodLabel(e.method))}</td>
            <td class="pay-${e.type}"><b>${sign}${money(e.amount)}</b></td><td>${esc(e.by)}</td>
            <td>${e.type === 'paid' ? (e.method === 'cash' ? 'Received ' + money(e.tendered || e.amount) + ', change ' + money(e.change || 0) : 'Ref ' + esc(e.reference || '-')) : esc(e.note || '') + (e.reference ? ' · Ref ' + esc(e.reference) : '')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="of-empty">No transactions on this date.</p>'}</div></div>`;
    const redraw = () => paymentsTab(el, ctx);
    $('#pd', el).addEventListener('change', e => { F.paydate = e.target.value || u.today(); redraw(); });
    $('#pt-today', el).addEventListener('click', () => { F.paydate = u.today(); redraw(); });
    $('#pprint', el).addEventListener('click', () => window.print());
    $('#pcsv', el).addEventListener('click', () => {
      const rows = [['Date', 'Time', 'Type', 'Number', 'Booking', 'Customer', 'Method', 'Amount', 'Staff', 'Reference', 'Note']];
      led.slice().reverse().forEach(e => { const d = new Date(e.at); rows.push([u.dateStr(d), d.toLocaleTimeString('en-PH'), e.type, e.no || '', e.ref, e.customer || '', e.method, (e.type === 'paid' ? '' : '-') + e.amount, e.by, e.reference || '', e.note || '']); });
      rows.push([], ['', '', '', '', '', '', 'Net sales', t.net], ['', '', '', '', '', '', 'Cash in drawer', t.cashInDrawer]);
      u.download('g7-payments-' + date + '.csv', rows.map(r => r.map(u.csvCell).join(',')).join('\n'), 'text/csv');
    });
  }

  // ---- Staff tab (administrators only) ------------------------------------------
  function staffModal(id, done) {
    const s = id ? auth.find(id) : null;
    const m = u.modal(`<div class="of-modal pay-modal"><h3>${s ? 'Edit staff' : 'Add staff'}</h3>
      <form id="sf"><label>Full name<div class="of-input"><input id="sn" maxlength="40" value="${esc(s ? s.name : '')}" placeholder="e.g. Maria Santos" required></div></label>
        <label>PIN (${CLOUD ? '6 to 8' : '4 to 8'} digits)<div class="of-input">${icon('lock')}<input id="sp" inputmode="numeric" maxlength="8" value="${esc(s && !CLOUD ? s.pin : '')}" placeholder="${s && CLOUD ? 'Leave blank to keep the current PIN' : 'Used to sign in'}" ${s && CLOUD ? '' : 'required'}></div></label>
        <label>Role<div class="of-input"><select id="sr"><option value="cashier" ${s && s.role === 'cashier' ? 'selected' : ''}>Cashier — bookings, payments, manifest, trips</option><option value="admin" ${s && s.role === 'admin' ? 'selected' : ''}>Administrator — everything, including staff, fares and data</option></select></div></label>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="sx">Cancel</button><button class="of-btn navy">Save</button></div></form></div>`, 'of-mod pay-mod');
    $('#sx', m.el).addEventListener('click', m.close);
    $('#sf', m.el).addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#sf .navy', m.el); btn.disabled = true;
      const r = await auth.save({ name: $('#sn', m.el).value, pin: $('#sp', m.el).value, role: $('#sr', m.el).value }, id);
      btn.disabled = false;
      if (!r.ok) return fail(r);
      m.close(); u.toast('Staff saved.', 'ok'); done();
    });
  }
  function staffTab(el, ctx) {
    const list = auth.all(), self = me();
    el.innerHTML = `${ctx.head('people', 'Staff', 'Who can sign in to the Ticket Office. Every payment is stamped with the staff member\'s name.', `<button class="of-btn navy" id="sadd">${icon('plus')} Add staff</button>`)}
      <div class="of-panel pad"><div class="of-scroll"><table class="of-tbl staff-tbl"><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${list.map(s => `<tr class="${s.active === false ? 'dim' : ''}"><td><b>${esc(s.name)}</b>${self && self.id === s.id ? ' <span class="of-badge gold">YOU</span>' : ''}<small class="rl">${s.role === 'admin' ? 'Administrator' : 'Cashier'}</small></td>
          <td>${s.role === 'admin' ? 'Administrator' : 'Cashier'}</td>
          <td>${s.active === false ? '<span class="of-pill bad">Inactive</span>' : '<span class="of-pill ok">Active</span>'}</td>
          <td class="acts"><button class="of-btn outline sm" data-edit="${s.id}">${icon('pencil')} Edit</button>
            <button class="of-btn sm ${s.active === false ? '' : 'danger'}" data-toggle="${s.id}">${s.active === false ? 'Activate' : 'Deactivate'}</button></td></tr>`).join('')}</tbody></table></div>
        <div class="of-info2">${icon('info')}<p>${CLOUD ? 'Each staff member signs in with their own name and PIN. PINs cannot be viewed; use Edit to set a new one.' : 'Staff PINs are stored in this browser only. This tells staff apart for the payment records; it is not real security.'} Deactivated staff can no longer sign in but their past payments stay on record.</p></div></div>`;
    const redraw = () => staffTab(el, ctx);
    $('#sadd', el).addEventListener('click', () => staffModal(null, redraw));
    $$('[data-edit]', el).forEach(b => b.addEventListener('click', () => staffModal(b.dataset.edit, redraw)));
    $$('[data-toggle]', el).forEach(b => b.addEventListener('click', async () => {
      const s = auth.find(b.dataset.toggle), r = await auth.setActive(s.id, s.active === false);
      if (!r.ok) return fail(r); redraw();
    }));
  }

  // ---- Change my PIN ----------------------------------------------------------------
  function pinModal() {
    const m = u.modal(`<div class="of-modal pay-modal"><h3>Change my PIN</h3>
      <form id="pnf"><label>Current PIN<div class="of-input">${icon('lock')}<input id="po" type="password" inputmode="numeric" maxlength="8" required></div></label>
        <label>New PIN (${CLOUD ? '6 to 8' : '4 to 8'} digits)<div class="of-input">${icon('lock')}<input id="pn" type="password" inputmode="numeric" maxlength="8" required></div></label>
        <div class="of-mfoot"><span class="sp"></span><button type="button" class="of-btn ghost" id="pnx">Cancel</button><button class="of-btn navy">Save PIN</button></div></form></div>`, 'of-mod pay-mod');
    $('#pnx', m.el).addEventListener('click', m.close);
    $('#pnf', m.el).addEventListener('submit', async e => {
      e.preventDefault();
      const r = await auth.changeOwnPin($('#po', m.el).value, $('#pn', m.el).value);
      if (!r.ok) return fail(r); m.close(); u.toast('PIN changed.', 'ok');
    });
  }

  return { receiveModal, receiptDialog, voidModal, cancelModal, refundModal, menuItems, paymentsTab, staffTab, pinModal };
})();
