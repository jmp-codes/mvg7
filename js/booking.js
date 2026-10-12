/* ============================================================
 * booking.js  -  Customer booking wizard
 *   1 Choose your trip  2 Pick your seats  3 Passenger details
 *   4 Review & confirm  -> Booking confirmed (ticket)
 * ============================================================ */
window.G7 = window.G7 || {};

(function () {
  const { u, config, trips, store, seatmap, ticket, icon } = G7;
  const { esc, $, $$ } = u;

  let S = null;     // wizard state
  let root = null;  // view container

  // First date (today onwards) on which at least one route can still be booked
  function firstBookableDate() {
    for (let i = 0; i <= config.advanceBookingDays; i++) {
      const d = u.addDays(u.today(), i);
      if (trips.forDate(d).some(t => trips.bookable(t).ok)) return d;
    }
    return u.today();
  }

  function fresh() {
    const counts = {};
    store.fareOrder().forEach(f => (counts[f] = 0));
    counts.regular = 1;
    return {
      step: 1,
      date: firstBookableDate(),
      routeId: config.routes[0].id,
      tripId: '',
      counts,
      seats: [],
      section: 'front',
      passengers: [],
      contact: { name: '', phone: '', email: '' },
      payment: 'cash',
      agree: false,
      done: null,
    };
  }

  // ---- derived values -------------------------------------------------
  const totalPax = () => store.fareOrder().reduce((n, f) => n + (S.counts[f] || 0), 0);
  const seatedPax = () => { const F = store.fares(); return store.fareOrder().reduce((n, f) => n + (F[f].seat ? (S.counts[f] || 0) : 0), 0); };
  const infants = () => { const F = store.fares(); return store.fareOrder().reduce((n, f) => n + (F[f].seat ? 0 : (S.counts[f] || 0)), 0); };
  const adults = () => { const F = store.fares(); return store.fareOrder().reduce((n, f) => n + (F[f].adult ? (S.counts[f] || 0) : 0), 0); };
  // The selected trip; falls back to a trip of the chosen route (or the first one) on that date
  function currentTrip() {
    const list = trips.forDate(S.date);
    let t = list.find(x => x.id === S.tripId) || list.find(x => x.routeId === S.routeId) || list[0];
    S.tripId = t.id; S.routeId = t.routeId;
    return t;
  }
  const needsId = f => f === 'student' || f === 'senior_pwd';
  const needsAge = f => f === 'child' || f === 'infant';

  function totalPrice() {
    const fares = store.fares();
    return store.fareOrder().reduce((n, f) => n + (S.counts[f] || 0) * fares[f].price, 0);
  }

  // Builds passenger rows in fare order; seats go to seated passengers in click order.
  function buildPassengers() {
    const fares = store.fares();
    const old = S.passengers;
    const list = [];
    let seatIdx = 0;
    store.fareOrder().forEach(f => {
      for (let i = 0; i < (S.counts[f] || 0); i++) {
        const prev = old[list.length];
        const same = prev && prev.fareType === f;
        list.push({
          fareType: f,
          fareLabel: fares[f].label,
          fare: fares[f].price,
          seat: fares[f].seat ? S.seats[seatIdx++] : null,
          name: same ? prev.name : '',
          age: same ? prev.age : '',
          idType: same ? prev.idType : '',
          idNumber: same ? prev.idNumber : '',
          boarded: false,
        });
      }
    });
    S.passengers = list;
  }

  // ---- shell ------------------------------------------------------------
  const STEPS = [
    ['Choose Trip', 'ship'],
    ['Pick Seats', 'seat'],
    ['Passenger Details', 'user'],
    ['Review & Confirm', 'checkcircle'],
  ];

  function stepper() {
    return `<ol class="bk-steps">${STEPS.map((s, i) => {
      const n = i + 1;
      const cls = n === S.step ? 'on' : n < S.step ? 'done' : '';
      return `<li class="${cls}"><span class="bk-dot">${n < S.step ? icon('check') : n}</span><b>${s[0]}</b></li>`;
    }).join('')}</ol>`;
  }

  function tripSummary() {
    const t = currentTrip();
    const r = t.route;
    const seats = S.seats.length ? S.seats.slice().sort((a, b) => a - b).join(', ') : '—';
    return `<aside class="bk-side">
      <div class="bk-box">
        <h4>${icon('ship')} Your Trip</h4>
        <div class="bk-trip">
          <div><small>From</small><b>${esc(config.ports[r.from].name)}</b></div>
          <span>${icon('arrow')}</span>
          <div><small>To</small><b>${esc(config.ports[r.to].name)}</b></div>
        </div>
        <dl>
          <dt>Date</dt><dd>${u.fmtDate(t.date)}</dd>
          <dt>Departure</dt><dd>${u.fmtTime(t.departs)}</dd>
          <dt>Passengers</dt><dd>${totalPax()}</dd>
          <dt>Seats</dt><dd>${esc(seats)}</dd>
        </dl>
        <div class="bk-sum"><span>Total</span><strong>${u.money(totalPrice())}</strong></div>
      </div>
      <div class="bk-box">
        <h4>${icon('info')} Important Reminders</h4>
        <ul class="bk-rem">${config.reminders.map(x => `<li>${icon('check')}${esc(x)}</li>`).join('')}</ul>
      </div>
    </aside>`;
  }

  let lastScreen = null; // which screen was drawn last, so +/- clicks don't jump the page

  function draw() {
    const y = window.pageYOffset || 0;
    const screen = S.done ? 'done' : S.step;
    const sameScreen = screen === lastScreen;
    lastScreen = screen;
    drawScreen();
    // Same step redrawn (counters, date, seat toggles): stay where the user was. New step: go to top.
    window.scrollTo(0, sameScreen ? y : 0);
  }

  function drawScreen() {
    if (S.done) return drawDone();
    root.innerHTML = `<div class="bk"><div class="bk-wrap">${stepper()}
      <div class="bk-layout"><section class="bk-main" id="step-body"></section>${tripSummary()}</div></div></div>`;
    [null, step1, step2, step3, step4][S.step]($('#step-body', root));
  }

  function head(iconName, title, sub) {
    return `<header class="bk-h">${icon(iconName, 'bk-h-ic')}<div><h2>${title}</h2><p>${sub}</p></div></header>`;
  }

  // ---- step 1: trip + passenger counts ----------------------------------
  function step1(el) {
    const fares = store.fares();
    const maxDate = u.addDays(u.today(), config.advanceBookingDays);

    const cur = currentTrip();
    const routeCards = trips.forDate(S.date).map(t => {
      const r = t.route;
      const b = trips.bookable(t);
      const left = trips.availableCount(t);
      return `<label class="bk-route ${t.id === cur.id ? 'on' : ''} ${b.ok ? '' : 'off'}">
        <input type="radio" name="route" value="${t.id}" ${t.id === cur.id ? 'checked' : ''}>
        <span class="bk-radio"></span>
        <div><b>${esc(trips.routeLabel(r))}</b>
        <span>Departs ${u.fmtTime(t.departs)} · ${esc(config.travelTime)}</span></div>
        <em class="${b.ok && left > 0 ? '' : 'bad'}">${b.ok ? left + ' seats left' : esc(b.reason)}</em>
      </label>`;
    }).join('');

    const counters = store.fareOrder().map(f => `
      <div class="bk-count">
        <div><b>${esc(fares[f].label)}</b><small>${esc(fares[f].note || (fares[f].seat ? 'Seat assigned' : 'No seat'))}</small></div>
        <span class="bk-price">${u.money(fares[f].price)}</span>
        <div class="bk-stepper">
          <button type="button" data-dec="${f}" aria-label="Fewer ${esc(fares[f].label)}">−</button>
          <output>${S.counts[f] || 0}</output>
          <button type="button" data-inc="${f}" aria-label="More ${esc(fares[f].label)}">+</button>
        </div>
      </div>`).join('');

    el.innerHTML = `${head('ship', 'Choose your trip', 'Select your travel date and route, then add passengers.')}
      <label class="bk-field">Travel date
        <div class="bk-input">${icon('calendar')}<input type="date" id="b-date" value="${S.date}" min="${u.today()}" max="${maxDate}"></div>
      </label>
      <h3 class="bk-sub">Route</h3>
      <div class="bk-routes">${routeCards}</div>
      <h3 class="bk-sub">Passengers <small>(max ${config.maxPassengersPerBooking})</small></h3>
      <div class="bk-counts">${counters}</div>
      <div class="bk-actions"><span></span><button class="btn-navy lg" id="next">Choose seats ${icon('arrow')}</button></div>`;

    $('#b-date', el).addEventListener('change', e => {
      if (e.target.value) { S.date = e.target.value; S.tripId = ''; S.seats = []; draw(); }
    });
    $$('input[name=route]', el).forEach(r => r.addEventListener('change', e => { S.tripId = e.target.value; S.seats = []; draw(); }));
    $$('[data-inc]', el).forEach(b => b.addEventListener('click', () => {
      if (totalPax() >= config.maxPassengersPerBooking) return u.toast('Maximum ' + config.maxPassengersPerBooking + ' passengers per booking.', 'err');
      S.counts[b.dataset.inc] = (S.counts[b.dataset.inc] || 0) + 1; S.seats = []; draw();
    }));
    $$('[data-dec]', el).forEach(b => b.addEventListener('click', () => { if (S.counts[b.dataset.dec] > 0) { S.counts[b.dataset.dec]--; S.seats = []; draw(); } }));

    $('#next', el).addEventListener('click', () => {
      const t = currentTrip();
      const ok = trips.bookable(t);
      if (!S.date || S.date < u.today()) return u.toast('Please choose a valid date.', 'err');
      if (!ok.ok) return u.toast(ok.reason, 'err');
      if (totalPax() < 1) return u.toast('Add at least one passenger.', 'err');
      if (totalPax() > config.maxPassengersPerBooking) return u.toast('Maximum ' + config.maxPassengersPerBooking + ' passengers per booking.', 'err');
      if (infants() > adults()) return u.toast('Each infant must travel with an adult (Regular, Student or Senior/PWD).', 'err');
      if (seatedPax() > trips.availableCount(t)) return u.toast('Not enough seats left on this trip.', 'err');
      S.step = 2;
      draw();
    });
  }

  // ---- step 2: seats ----------------------------------------------------
  function step2(el) {
    const trip = currentTrip();
    const need = seatedPax();
    const tabs = config.sections.map(s => `<button type="button" class="bk-tab ${s.id === S.section ? 'on' : ''}" data-sec="${s.id}">${esc(s.name)}</button>`).join('');

    el.innerHTML = `${head('seat', 'Pick your seats', need ? 'Select ' + need + ' seat' + (need > 1 ? 's' : '') + ' for your passengers.' : 'Only lap infants on this booking: no seat needed.')}
      <div class="bk-pick"><b id="pick-count"></b><span id="pick-list"></span></div>
      <div class="bk-tabs">${tabs}</div>
      <div id="map" class="bk-map"></div>
      <div class="bk-actions"><button class="btn-outline" id="back">${icon('back')} Back</button><button class="btn-navy lg" id="next">Continue ${icon('arrow')}</button></div>`;

    const mapEl = $('#map', el);
    function paint() {
      seatmap.render(mapEl, trips.seatMap(trip), {
        mode: 'book',
        section: S.section,
        selected: S.seats,
        onSeat(n) {
          const i = S.seats.indexOf(n);
          if (i >= 0) S.seats.splice(i, 1);
          else if (S.seats.length < need) S.seats.push(n);
          else return u.toast('You have already picked ' + need + ' seat(s). Tap a selected seat to change it.', 'err');
          paint();
          refreshSide();
        },
      });
      $('#pick-count', el).textContent = S.seats.length + ' of ' + need + ' seat(s) selected';
      $('#pick-list', el).textContent = S.seats.length ? 'Seats: ' + S.seats.join(', ') : '';
    }
    function refreshSide() {
      const side = $('.bk-side', root);
      if (side) side.outerHTML = tripSummary();
    }
    paint();

    $$('[data-sec]', el).forEach(b => b.addEventListener('click', () => {
      S.section = b.dataset.sec;
      $$('[data-sec]', el).forEach(x => x.classList.toggle('on', x === b));
      paint();
    }));
    $('#back', el).addEventListener('click', () => { S.step = 1; draw(); });
    $('#next', el).addEventListener('click', () => {
      if (S.seats.length !== need) return u.toast('Please select ' + need + ' seat(s).', 'err');
      buildPassengers();
      S.step = 3;
      draw();
    });
  }

  // ---- step 3: passenger + contact details -----------------------------
  function step3(el) {
    const fares = store.fares();
    const idOpts = sel => '<option value="">Select ID type</option>' + config.idTypes.map(t => `<option ${t === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');

    const rows = S.passengers.map((p, i) => `<fieldset class="bk-pax">
        <legend><span>${i + 1}</span>Passenger ${i + 1} · ${esc(fares[p.fareType].label)} · ${p.seat ? 'Seat ' + p.seat : 'Lap infant'}</legend>
        <div class="bk-form">
          <label class="wide">Full name<div class="bk-input">${icon('user')}<input data-i="${i}" data-f="name" value="${esc(p.name)}" placeholder="As shown on ID" required></div></label>
          ${needsAge(p.fareType) ? `<label>Age<div class="bk-input"><input data-i="${i}" data-f="age" type="number" min="0" max="17" value="${esc(p.age)}" required></div></label>` : ''}
          ${needsId(p.fareType) ? `<label>ID type<div class="bk-input"><select data-i="${i}" data-f="idType">${idOpts(p.idType)}</select></div></label>
          <label>ID number<div class="bk-input">${icon('idcard')}<input data-i="${i}" data-f="idNumber" value="${esc(p.idNumber)}"></div></label>` : ''}
        </div>
        ${fares[p.fareType].note ? `<small class="bk-note">${icon('info')}${esc(fares[p.fareType].note)}</small>` : ''}
      </fieldset>`).join('');

    el.innerHTML = `${head('user', 'Passenger details', 'Enter details exactly as shown on each passenger\'s ID.')}
      ${rows}
      <fieldset class="bk-pax">
        <legend><span>${icon('phone')}</span>Contact person</legend>
        <div class="bk-form">
          <label>Name<div class="bk-input">${icon('user')}<input id="c-name" value="${esc(S.contact.name)}" placeholder="Defaults to Passenger 1"></div></label>
          <label>Mobile number<div class="bk-input">${icon('phone')}<input id="c-phone" inputmode="tel" value="${esc(S.contact.phone)}" required></div></label>
          <label class="wide">Email (optional)<div class="bk-input">${icon('mail')}<input id="c-email" type="email" value="${esc(S.contact.email)}"></div></label>
        </div>
      </fieldset>
      <div class="bk-actions"><button class="btn-outline" id="back">${icon('back')} Back</button><button class="btn-navy lg" id="next">Review ${icon('arrow')}</button></div>`;

    function collect() {
      $$('[data-i]', el).forEach(inp => { S.passengers[inp.dataset.i][inp.dataset.f] = inp.value.trim(); });
      S.contact.name = $('#c-name', el).value.trim();
      S.contact.phone = $('#c-phone', el).value.trim();
      S.contact.email = $('#c-email', el).value.trim();
    }

    $('#back', el).addEventListener('click', () => { collect(); S.step = 2; draw(); });
    $('#next', el).addEventListener('click', () => {
      collect();
      for (let i = 0; i < S.passengers.length; i++) {
        const p = S.passengers[i];
        if (!p.name) return u.toast('Enter a name for passenger ' + (i + 1) + '.', 'err');
        if (needsAge(p.fareType) && (p.age === '' || isNaN(Number(p.age)))) return u.toast('Enter the age for passenger ' + (i + 1) + '.', 'err');
        if (needsId(p.fareType) && (!p.idType || !p.idNumber)) return u.toast('Enter the ID type and number for passenger ' + (i + 1) + ' (discounted fare).', 'err');
      }
      if (!/^[0-9+\-\s()]{7,}$/.test(S.contact.phone)) return u.toast('Enter a valid mobile number.', 'err');
      if (!S.contact.name) S.contact.name = S.passengers[0].name;
      S.step = 4;
      draw();
    });
  }

  // ---- step 4: review & confirm ----------------------------------------
  function step4(el) {
    const trip = currentTrip();
    const fares = store.fares();
    const rows = S.passengers.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${esc(fares[p.fareType].label)}</td><td>${p.seat || 'Lap infant'}</td><td class="num">${u.money(p.fare)}</td></tr>`).join('');
    const pay = Object.keys(config.paymentMethods).map(k => `<label class="bk-pay ${S.payment === k ? 'on' : ''}"><input type="radio" name="pay" value="${k}" ${S.payment === k ? 'checked' : ''}><span class="bk-radio"></span>${esc(config.paymentMethods[k])}</label>`).join('');

    el.innerHTML = `${head('checkcircle', 'Review & confirm', 'Please check your booking details before confirming.')}
      <div class="bk-review">
        <div><small>Route</small><b>${esc(trips.routeLongLabel(trip.route))}</b></div>
        <div><small>Departure</small><b>${u.fmtDate(trip.date)} · ${u.fmtTime(trip.departs)}</b></div>
        <div><small>Contact</small><b>${esc(S.contact.name)} · ${esc(S.contact.phone)}${S.contact.email ? ' · ' + esc(S.contact.email) : ''}</b></div>
      </div>
      <div class="tk-tablewrap"><table class="tk-table">
        <thead><tr><th>#</th><th>Passenger Name</th><th>Category / Fare</th><th>Seat No.</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" class="num">Total Amount</td><td class="num">${u.money(totalPrice())}</td></tr></tfoot>
      </table></div>
      <h3 class="bk-sub">Payment method</h3>
      <div class="bk-pays">${pay}</div>
      <p class="bk-hint">${icon('info')}Your seats are held once you confirm. Payment is settled with the ticket office; unpaid bookings may be released per company policy.</p>
      <label class="bk-agree"><input type="checkbox" id="agree" ${S.agree ? 'checked' : ''}> I confirm that the details above are correct.</label>
      <div class="bk-actions"><button class="btn-outline" id="back">${icon('back')} Back</button><button class="btn-navy lg" id="confirm">Confirm booking ${icon('check')}</button></div>`;

    $$('input[name=pay]', el).forEach(r => r.addEventListener('change', e => {
      S.payment = e.target.value;
      $$('.bk-pay', el).forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    }));
    $('#agree', el).addEventListener('change', e => (S.agree = e.target.checked));
    $('#back', el).addEventListener('click', () => { S.step = 3; draw(); });
    $('#confirm', el).addEventListener('click', () => {
      if (!$('#agree', el).checked) return u.toast('Please tick the confirmation box.', 'err');
      confirmBooking();
    });
  }

  async function confirmBooking() {
    const trip = currentTrip();
    const ok = trips.bookable(trip);
    if (!ok.ok) return u.toast(ok.reason, 'err');

    // Re-check seats right before saving (someone may have booked meanwhile)
    const map = trips.seatMap(trip);
    const clash = S.seats.filter(n => !map[n] || map[n].state !== 'available');
    if (clash.length) {
      u.toast('Seat(s) ' + clash.join(', ') + ' were just taken. Please pick again.', 'err');
      S.seats = S.seats.filter(n => clash.indexOf(n) < 0);
      S.step = 2;
      return draw();
    }

    const build = () => ({
      ref: u.newRef(S.date),
      tripId: trip.id,
      date: trip.date,
      routeId: trip.routeId,
      createdAt: new Date().toISOString(),
      contact: Object.assign({}, S.contact),
      passengers: S.passengers.map(p => Object.assign({}, p)),
      total: S.passengers.reduce((n, p) => n + p.fare, 0),
      payment: { method: S.payment, status: 'unpaid' },
      status: 'confirmed',
    });
    let booking = build();
    const btn = $('#confirm', root); if (btn) btn.disabled = true;

    if (G7.cloud && G7.cloud.on) {
      // Shared database: the server re-checks seats, fares and trip rules and saves in one step
      let r;
      for (let i = 0; i < 4; i++) {
        r = await G7.cloud.createBooking(booking);
        if (r.ok || !/duplicate|unique/i.test(r.reason)) break;
        booking = build();   // reference collided: try another
      }
      if (!r.ok) {
        if (btn) btn.disabled = false;
        u.toast(r.reason, 'err');
        if (/seat|taken|fare|cancel/i.test(r.reason)) { await G7.cloud.reloadTaken(); S.seats = []; S.step = 2; draw(); }
        return;
      }
      booking = r.booking;
    } else {
      do { booking.ref = u.newRef(S.date); } while (store.getBooking(booking.ref));
      store.addBooking(booking);
    }
    S.done = booking;
    draw();
  }

  function drawDone() {
    const b = S.done;
    const extra = `<button type="button" class="btn-navy" id="again">${icon('plus')} Book Another Trip</button>`;
    root.innerHTML = `<div class="bk"><div class="bk-wrap bk-done">${ticket.bookingHTML(b, { confirmed: true, extra })}</div></div>`;
    ticket.wirePrint(root);
    $('#again', root).addEventListener('click', () => { S = fresh(); draw(); });
  }

  // Used by the landing page search box: start a fresh booking with these choices
  G7.booking = {
    prefill(o) {
      S = fresh();
      if (o.date) S.date = o.date;
      if (o.routeId) { S.routeId = o.routeId; S.tripId = ''; }
      if (o.pax) S.counts.regular = o.pax;
    },
  };

  G7.views = G7.views || {};
  G7.views.book = {
    render(container) {
      root = container;
      if (!S) S = fresh();
      draw();
    },
  };
})();
