/* ============================================================
 * ticket.js  -  Booking confirmation / ticket rendering and the
 * "My booking" lookup page
 * ============================================================ */
window.G7 = window.G7 || {};

G7.ticket = (function () {
  const { u, config, trips, store, icon } = G7;
  const { esc } = u;

  function bookedOn(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  }

  // opts.confirmed -> show the green "Booking confirmed!" banner
  // opts.extra     -> extra HTML (buttons) placed next to Print
  function bookingHTML(b, opts) {
    opts = opts || {};
    const trip = trips.byId(b.tripId) || trips.get(b.date, b.routeId);
    const r = trip.route;
    const cancelled = b.status === 'cancelled';
    const paid = b.payment.status === 'paid';
    const payLabel = config.paymentMethods[b.payment.method] || b.payment.method;

    const rows = b.passengers.map((p, i) => {
      const f = store.fares()[p.fareType];
      return `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.fareLabel || (f ? f.label : p.fareType))}</td><td>${p.seat ? p.seat : 'Lap infant'}</td><td class="num">${u.money(p.fare)}</td></tr>`;
    }).join('');

    const banner = opts.confirmed ? `<div class="tk-banner">
      <span class="tk-check">${icon('check')}</span>
      <div><h2>Booking confirmed!</h2><p>Your seats are successfully reserved. Please keep your reference number for your travel.</p></div>
      <div class="tk-booked">${icon('calendar')}<div><small>Booked on</small><b>${esc(bookedOn(b.createdAt))}</b></div></div>
    </div>` : '';

    return `<div class="printable tk">
      ${banner}
      <div class="tk-summary">
        <div><small>Booking Reference</small><div class="tk-ref"><b>${esc(b.ref)}</b><button type="button" class="tk-copy no-print" data-copy="${esc(b.ref)}" aria-label="Copy reference">${icon('copy')}</button></div></div>
        <div><small>Booking Status</small>${cancelled ? '<span class="tk-pill bad">' + icon('xcircle') + 'Cancelled</span><em>Seats released.</em>' : '<span class="tk-pill ok">' + icon('checkcircle') + 'Confirmed</span><em>Your seats are reserved.</em>'}</div>
        <div><small>Total Amount</small><div class="tk-total">${icon('ticket')}<b>${u.money(b.total)}</b></div></div>
        <div><small>Payment Status</small><span class="tk-pill ${paid ? 'ok' : b.payment.status === 'refunded' ? 'bad' : 'warn'}">${icon(paid ? 'checkcircle' : b.payment.status === 'refunded' ? 'refresh' : 'clock')}${paid ? 'Paid' : b.payment.status === 'refunded' ? 'Refunded' : 'Unpaid'}</span><em>${esc(payLabel)}</em></div>
      </div>

      <section class="tk-card ${cancelled ? 'is-cancelled' : ''}">
        <header class="tk-head"><div><strong>${esc(config.company)}</strong><span>Safe, Reliable, and Convenient Travel</span></div><div class="tk-no">${esc(b.ref)}</div></header>
        <div class="tk-route">
          <div class="tk-place">${icon('pin')}<div><small>FROM</small><b>${esc(config.ports[r.from].name)}</b><span>${esc(config.ports[r.from].area)}</span></div></div>
          <span class="tk-arrow">${icon('arrow')}</span>
          <div class="tk-place">${icon('pin')}<div><small>TO</small><b>${esc(config.ports[r.to].name)}</b><span>${esc(config.ports[r.to].area)}</span></div></div>
          <div class="tk-when">${icon('calendar', 'big')}<div><small>Departure</small><b>${u.fmtDate(b.date)}</b><b>${u.fmtTime(trip.departs)}</b></div></div>
          <div class="tk-when">${icon('clock', 'big')}<div><small>Travel Time</small><span>${esc(config.travelTime)}</span></div></div>
        </div>
        <div class="tk-tablewrap"><table class="tk-table">
          <thead><tr><th>#</th><th>Passenger Name</th><th>Category / Fare</th><th>Seat No.</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4" class="num">Total Amount</td><td class="num">${u.money(b.total)}</td></tr></tfoot>
        </table></div>
        <div class="tk-notes">${icon('info', 'big')}<ul>${(config.ticketNotes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
        ${cancelled ? '<div class="stamp">CANCELLED</div>' : ''}
      </section>
    </div>
    <div class="tk-actions no-print"><button type="button" class="btn-outline" data-print>${icon('print')} Print Ticket(s)</button><button type="button" class="btn-outline" data-save="png" data-ref="${esc(b.ref)}">${icon('download')} Save as Image (PNG)</button><button type="button" class="btn-outline" data-save="jpg" data-ref="${esc(b.ref)}">${icon('download')} Save as JPG</button>${opts.extra || ''}</div>`;
  }

  // Wires the Print and Copy buttons inside el
  function wirePrint(el) {
    const p = u.$('[data-print]', el);
    if (p) p.addEventListener('click', () => window.print());
    u.$$('[data-save]', el).forEach(btn => btn.addEventListener('click', () => {
      const b = store.bookings().find(x => x.ref === btn.dataset.ref);
      if (b && G7.ticketImg) G7.ticketImg.save(b, btn.dataset.save);
    }));
    const c = u.$('[data-copy]', el);
    if (c) c.addEventListener('click', () => {
      const ref = c.dataset.copy;
      const ok = () => u.toast('Reference copied.', 'ok');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ref).then(ok, () => u.toast(ref, 'ok'));
      else u.toast(ref, 'ok');
    });
  }

  // Returns the booking when ref + phone (last 7 digits) match, else null
  async function find(ref, phone) {
    if (G7.cloud && G7.cloud.on) return await G7.cloud.lookup(ref, phone);
    const b = store.getBooking(ref);
    const digits = s => String(s || '').replace(/\D/g, '');
    if (!b || digits(b.contact.phone).slice(-7) !== digits(phone).slice(-7)) return null;
    return b;
  }

  function show(b) {
    const m = u.modal(bookingHTML(b), 'wide');
    wirePrint(m.el);
    return m;
  }

  // ---- "My Booking" lookup view ----
  function renderLookup(root) {
    root.innerHTML = `<div class="bk"><div class="bk-lookup"><div class="bk-main">
      <header class="bk-h">${icon('ticket', 'bk-h-ic')}<div><h2>Find my booking</h2><p>Enter your booking reference and the mobile number used when booking.</p></div></header>
      <form id="lookup-form" class="bk-form one">
        <label>Booking reference<div class="bk-input">${icon('ticket')}<input id="lk-ref" placeholder="G7-261012-ABCD" required autocomplete="off"></div></label>
        <label>Mobile number<div class="bk-input">${icon('phone')}<input id="lk-phone" inputmode="tel" required></div></label>
        <button class="btn-navy lg">Find booking ${icon('arrow')}</button>
      </form>
      <div id="lookup-result"></div></div></div></div>`;

    u.$('#lookup-form', root).addEventListener('submit', async e => {
      e.preventDefault();
      const out = u.$('#lookup-result', root);
      let b = null;
      try { b = await find(u.$('#lk-ref').value, u.$('#lk-phone').value); }
      catch (err) { console.error('[lookup]', err); out.innerHTML = '<p class="msg err">Could not check the booking right now (' + u.esc(String(err.message || err)) + '). Please try again or contact the ticket office.</p>'; return; }
      if (!b) { out.innerHTML = '<p class="msg err">No booking found with those details.</p>'; return; }
      out.innerHTML = bookingHTML(b);
      wirePrint(out);
    });
  }

  G7.views = G7.views || {};
  G7.views.ticket = { render: renderLookup };

  return { bookingHTML, show, find, wirePrint };
})();
