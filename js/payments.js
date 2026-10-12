/* ============================================================
 * payments.js  -  Payment logic for the Ticket Office (no DOM)
 *
 * booking.payment = {
 *   method, status: 'unpaid' | 'paid' | 'refunded',
 *   paidAt, receivedBy, receivedByName, amountReceived, change, reference, receiptNo,   (when paid)
 *   refund: { amount, reason, at, by, byName, method, reference, refundNo },             (when refunded)
 *   log: [ { type:'paid'|'void'|'refund', at, by, amount, method, no, reference, note } ]  <- audit trail / ledger
 * }
 * Every function returns { ok:boolean, reason?:string, booking? }.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.pay = (function () {
  const { store, config, u } = G7;

  const money2 = n => Math.round(Number(n) * 100) / 100;
  const methodLabel = m => ({ cash: 'Cash', gcash: 'GCash', bank: 'Bank transfer' }[m] || m);

  function receive(ref, o) {
    const b = store.getBooking(ref);
    if (!b) return { ok: false, reason: 'Booking not found.' };
    if (b.status !== 'confirmed') return { ok: false, reason: 'Only confirmed bookings can be paid.' };
    if (b.payment.status === 'paid') return { ok: false, reason: 'This booking is already paid.' };
    if (b.payment.status === 'refunded') return { ok: false, reason: 'This booking was refunded.' };
    if (!o.staff) return { ok: false, reason: 'Sign in as staff first.' };
    const method = o.method || b.payment.method;
    if (!config.paymentMethods[method]) return { ok: false, reason: 'Choose a payment method.' };
    const due = money2(b.total);
    let tendered = money2(o.tendered), change = 0;
    const reference = String(o.reference || '').trim();
    if (method === 'cash') {
      if (!(tendered > 0)) return { ok: false, reason: 'Enter the cash received.' };
      if (tendered < due) return { ok: false, reason: 'Cash received is less than the amount due (' + u.money(due) + ').' };
      change = money2(tendered - due);
    } else {
      if (!reference) return { ok: false, reason: 'Enter the ' + (method === 'gcash' ? 'GCash' : 'bank') + ' reference number.' };
      tendered = due;
    }
    const at = new Date().toISOString(), no = store.nextReceiptNo('R');
    const upd = store.updateBooking(ref, x => {
      Object.assign(x.payment, { method, status: 'paid', paidAt: at, receivedBy: o.staff.id, receivedByName: o.staff.name, amountReceived: tendered, change, reference, receiptNo: no });
      delete x.payment.refund;
      (x.payment.log = x.payment.log || []).push({ type: 'paid', at, by: o.staff.name, amount: due, method, no, reference, tendered, change });
    });
    return { ok: true, booking: upd };
  }

  // Undo a payment recorded by mistake -> back to Unpaid
  function voidPayment(ref, reason, staff) {
    const b = store.getBooking(ref);
    if (!b || b.payment.status !== 'paid') return { ok: false, reason: 'Only paid bookings can be voided.' };
    reason = String(reason || '').trim();
    if (!reason) return { ok: false, reason: 'Enter a reason for voiding.' };
    const at = new Date().toISOString(), p = b.payment;
    const upd = store.updateBooking(ref, x => {
      x.payment.log = x.payment.log || [];
      x.payment.log.push({ type: 'void', at, by: staff.name, amount: money2(x.total), method: p.method, no: p.receiptNo, reference: p.reference, note: reason });
      x.payment.status = 'unpaid';
      ['paidAt', 'receivedBy', 'receivedByName', 'amountReceived', 'change', 'reference', 'receiptNo'].forEach(k => delete x.payment[k]);
    });
    return { ok: true, booking: upd };
  }

  // Money returned to the customer (full or partial)
  function refund(ref, o) {
    const b = store.getBooking(ref);
    if (!b || b.payment.status !== 'paid') return { ok: false, reason: 'Only paid bookings can be refunded.' };
    const amount = money2(o.amount), due = money2(b.total);
    if (!(amount > 0)) return { ok: false, reason: 'Enter the refund amount.' };
    if (amount > due) return { ok: false, reason: 'Refund cannot be more than ' + u.money(due) + '.' };
    const reason = String(o.reason || '').trim();
    if (!reason) return { ok: false, reason: 'Enter a reason for the refund.' };
    const method = o.method || b.payment.method;
    const reference = String(o.reference || '').trim();
    if (method !== 'cash' && !reference) return { ok: false, reason: 'Enter the reference number of the refund transfer.' };
    const at = new Date().toISOString(), no = store.nextReceiptNo('RF');
    const upd = store.updateBooking(ref, x => {
      x.payment.status = 'refunded';
      x.payment.refund = { amount, reason, at, by: o.staff.id, byName: o.staff.name, method, reference, refundNo: no };
      (x.payment.log = x.payment.log || []).push({ type: 'refund', at, by: o.staff.name, amount, method, no, reference, note: reason });
    });
    return { ok: true, booking: upd };
  }

  // ---- Ledger / reports ---------------------------------------------------
  const localDate = iso => u.dateStr(new Date(iso));

  // All payment events (optionally for one local date), newest first
  function ledger(date) {
    const out = [];
    store.bookings().forEach(b => (b.payment.log || []).forEach(e => {
      if (!date || localDate(e.at) === date) out.push(Object.assign({ ref: b.ref, customer: b.contact && b.contact.name }, e));
    }));
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }

  // Money in/out for a date. collected = payments - voids; net = collected - refunds
  function totals(date) {
    const t = { collected: 0, byMethod: { cash: 0, gcash: 0, bank: 0 }, refunds: 0, refundByMethod: { cash: 0, gcash: 0, bank: 0 }, net: 0, cashInDrawer: 0, count: 0, byStaff: {} };
    ledger(date).forEach(e => {
      const sgn = e.type === 'paid' ? 1 : e.type === 'void' ? -1 : 0;
      const st = t.byStaff[e.by] || (t.byStaff[e.by] = { name: e.by, collected: 0, refunds: 0, cash: 0, count: 0 });
      if (sgn) {
        t.collected += sgn * e.amount; t.byMethod[e.method] = (t.byMethod[e.method] || 0) + sgn * e.amount;
        st.collected += sgn * e.amount; if (e.method === 'cash') st.cash += sgn * e.amount;
        if (sgn > 0) { t.count++; st.count++; }
      } else if (e.type === 'refund') {
        t.refunds += e.amount; t.refundByMethod[e.method] = (t.refundByMethod[e.method] || 0) + e.amount;
        st.refunds += e.amount; if (e.method === 'cash') st.cash -= e.amount;
      }
    });
    t.net = money2(t.collected - t.refunds);
    t.cashInDrawer = money2(t.byMethod.cash - t.refundByMethod.cash);
    return t;
  }

  // Money still to be collected for confirmed bookings (reserved but unpaid)
  function outstanding() {
    return store.bookings().filter(b => b.status === 'confirmed' && b.payment.status === 'unpaid').reduce((n, b) => n + b.total, 0);
  }

  // Testing helper: mark a booking paid without validation (sample data)
  function seedPaid(b, staffName) {
    const at = new Date().toISOString(), no = store.nextReceiptNo('R');
    Object.assign(b.payment, { status: 'paid', paidAt: at, receivedBy: 'admin', receivedByName: staffName, amountReceived: b.total, change: 0, reference: '', receiptNo: no });
    b.payment.log = [{ type: 'paid', at, by: staffName, amount: b.total, method: b.payment.method, no, reference: '', tendered: b.total, change: 0 }];
  }

  return { receive, voidPayment, refund, ledger, totals, outstanding, seedPaid, methodLabel };
})();
