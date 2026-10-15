/* ============================================================
 * home.js  -  Landing page (route #/home)
 * Sections: hero + search box, feature strip, destinations,
 * routes & schedules, travel advisory, how booking works,
 * about, footer.
 *
 * PHOTOS (in /assets, replace a file to change it):
 *   hero.jpg                 full-width banner behind the headline
 *   card-book.jpg, card-schedules.jpg, card-booking.jpg   the three action cards
 * Missing files are ignored, so nothing breaks.
 * ============================================================ */
window.G7 = window.G7 || {};

(function () {
  const { u, config, trips, ticket } = G7;
  const { esc, $, $$ } = u;

  const icon = G7.icon; // shared icon set (js/icons.js)
  const FB = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5z"/></svg>';
  const YT = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.200 0-7.800.4A2.500 2.500 0 0 0 2.400 7.200C2 8.800 2 12 2 12s0 3.200.4 4.800a2.500 2.500 0 0 0 1.800 1.800C5.800 19 12 19 12 19s6.200 0 7.800-.4a2.500 2.500 0 0 0 1.800-1.800C22 15.200 22 12 22 12s0-3.200-.4-4.800zM10 15V9l5.200 3z"/></svg>';

  // Stand-in shown only until assets/logo-white.png loads.
  const LOGO_BIG = `<svg class="logo-big" viewBox="0 0 280 140" aria-hidden="true">
    <path d="M6 100c30-22 62-26 92-10 28 15 52 14 84-4-14 22-42 34-76 28-30-5-60-30-100-14z" fill="#5bb7ec"/>
    <path d="M30 112c26-12 52-8 78 6 20 10 44 10 74-6-10 14-34 26-62 22-28-4-56-26-90-22z" fill="#2b86d4" opacity=".85"/>
    <text x="52" y="100" font-family="'Arial Black','Montserrat',Arial,sans-serif" font-style="italic" font-weight="900" font-size="108" letter-spacing="-6" fill="#fff">G7</text></svg>`;

  const STEPS_ART = `<svg class="bg-art" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 210C140 150 300 215 470 260L470 320L0 320Z" fill="#d9eaf8" opacity=".7"/>
    <path d="M0 250C120 215 260 255 400 290L400 320L0 320Z" fill="#c9e0f4" opacity=".6"/>
    <path d="M1440 200C1300 150 1150 215 980 262L980 320L1440 320Z" fill="#d9eaf8" opacity=".7"/>
    <path d="M1440 245C1320 215 1190 255 1050 292L1050 320L1440 320Z" fill="#c9e0f4" opacity=".6"/>
    <g fill="none" stroke="#86b9e4" stroke-width="3" stroke-linecap="round">
      <path d="M150 112q18-18 38-6q16-14 44 0"/><path d="M1270 90q12-12 26-4q12-10 30 0"/><path d="M1330 120q10-10 22-3q10-8 26 0"/></g></svg>`;

  // ---- hero illustration (replaced by assets/hero.jpg if present) -----
  const HERO_ART = `<svg class="hero-art" viewBox="0 0 1440 700" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb3ea"/><stop offset="1" stop-color="#cfe8fb"/></linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a7fd0"/><stop offset="1" stop-color="#0a3f8c"/></linearGradient>
    </defs>
    <rect width="1440" height="700" fill="url(#sky)"/>
    <g fill="#fff" opacity=".75"><ellipse cx="250" cy="90" rx="150" ry="26"/><ellipse cx="380" cy="110" rx="110" ry="20"/><ellipse cx="1120" cy="70" rx="170" ry="24"/><ellipse cx="800" cy="140" rx="120" ry="18"/></g>
    <path d="M0 290 L120 240 L260 275 L420 215 L600 280 L760 230 L940 270 L1120 205 L1300 255 L1440 235 L1440 330 L0 330Z" fill="#5a8fb8" opacity=".7"/>
    <path d="M0 320 L140 270 L300 300 L470 245 L640 305 L820 262 L1010 300 L1200 250 L1440 290 L1440 360 L0 360Z" fill="#2f6f5c"/>
    <path d="M0 345 L200 315 L420 340 L700 310 L980 340 L1240 315 L1440 335 L1440 380 L0 380Z" fill="#23574a"/>
    <rect y="350" width="1440" height="350" fill="url(#sea)"/>
    <g stroke="#fff" stroke-width="2" fill="none" opacity=".22" stroke-linecap="round">
      <path d="M60 430c40-8 80-8 120 0M300 470c50-10 100-10 150 0M600 410c40-8 80-8 120 0M200 560c60-10 120-10 180 0M900 600c60-10 120-10 180 0M1180 520c50-10 100-10 150 0"/></g>
    <g class="art-wake">
    <path d="M640 470 C760 500 1000 505 1380 440 L1440 470 L1440 520 C1100 560 800 540 600 500Z" fill="#fff" opacity=".55"/>
    <path d="M700 478 C860 505 1080 495 1340 445" stroke="#fff" stroke-width="10" fill="none" opacity=".7" stroke-linecap="round"/>
    </g>
    <!-- vessel -->
    <g class="art-ship">
      <polygon points="690,395 1340,345 1300,450 760,468 680,440" fill="#fff"/>
      <polygon points="715,430 1310,392 1300,418 740,452" fill="#0a2f7a"/>
      <polygon points="690,395 1340,345 1336,360 694,410" fill="#e8eef5"/>
      <polygon points="790,318 1245,296 1262,350 780,372" fill="#fff"/>
      <polygon points="880,255 1190,244 1200,296 870,306" fill="#fff"/>
      <polygon points="965,208 1110,203 1115,248 960,253" fill="#fff"/>
      <g fill="#274a7a">
        ${Array.from({ length: 14 }, (_, i) => `<rect x="${805 + i * 31}" y="${334 - i * 1.4}" width="20" height="14" rx="2"/>`).join('')}
        ${Array.from({ length: 9 }, (_, i) => `<rect x="${893 + i * 32}" y="${268 - i * 0.6}" width="21" height="14" rx="2"/>`).join('')}
        ${Array.from({ length: 4 }, (_, i) => `<rect x="${975 + i * 34}" y="${220 - i * 0.3}" width="26" height="16" rx="2"/>`).join('')}
      </g>
      <rect x="1030" y="130" width="5" height="78" fill="#d9e2ec"/><rect x="1005" y="148" width="55" height="4" fill="#d9e2ec"/>
      <g fill="#f08a24"><circle cx="840" cy="388" r="9"/><circle cx="1000" cy="380" r="9"/><circle cx="1170" cy="371" r="9"/></g>
      <text x="800" y="440" transform="rotate(-2.4 800 440)" font-family="system-ui,sans-serif" font-weight="800" font-size="21" letter-spacing="1" fill="#fff">G7 MARINE TRANSPORT</text>
    </g>
  </svg>`;

  // ---- quick-action photo cards (images in /assets) -----------------
  const CARDS = [
    { img: 'assets/card-book.jpg', title: 'Book a Trip', text: 'Find available routes, schedules, and fares for your next journey.', href: '#/book' },
    { img: 'assets/card-schedules.jpg', title: 'View Schedules', text: 'Check trip schedules and plan your travel.', href: '#/home?s=routes' },
    { img: 'assets/card-booking.jpg', title: 'Check Booking', text: 'View and manage your existing bookings.', href: '#/ticket' },
  ];

  // ---- route / schedule helpers --------------------------------------
  const FARE_ICON = { regular: 'user', student: 'cap', senior_pwd: 'user', child: 'child', infant: 'infant' };
  const ROUTE_PHOTO = { 'TILIK-NASUGBU': 'assets/card-book.jpg', 'NASUGBU-TILIK': 'assets/card-booking.jpg' };

  function routesHTML() {
    const fares = G7.store.fares();
    const tiles = config.routes.map(r => `<article class="rcard">
      <div class="rcard-photo"><img src="${ROUTE_PHOTO[r.id] || 'assets/card-book.jpg'}" alt="">
        <span class="time-pill">${icon('clock')}${u.fmtTime(r.departs)}</span></div>
      <div class="rcard-body">
        <h3>${esc(config.ports[r.from].name)} \u2192 ${esc(config.ports[r.to].name)}</h3>
        <p class="rrow">${icon('pin')}<span>${esc(config.ports[r.from].area)} \u2192 ${esc(config.ports[r.to].area)}</span></p>
        <hr>
        <p class="rrow">${icon('ship')}<span>${esc(config.travelTime)}<small>Schedules may vary by day and weather.</small></span></p>
        <a class="btn-navy" href="#/book" data-route="${r.id}">Book a Trip ${icon('arrow')}</a>
      </div>
    </article>`).join('');

    const rows = G7.store.fareOrder().map(f => `<tr><td>${icon(FARE_ICON[f] || 'tag')}${esc(fares[f].label)}</td><td class="num">${u.money(fares[f].price)}</td></tr>`).join('');
    const adv = config.advisory || { summary: '', items: [] };

    return `<section class="band routes-band" id="routes">
      <div class="rb-head">
        <p class="eyebrow ruled">ROUTES &amp; SCHEDULES</p>
        <h2 class="sec-title xl">Where We Sail</h2>
        <p class="sec-sub">Regular ferry and fastcraft routes between ${esc(config.ports.TILIK.name)}, ${esc(config.ports.TILIK.area)} and ${esc(config.ports.NASUGBU.name)}, ${esc(config.ports.NASUGBU.area)}.</p>
      </div>
      <div class="rgrid">${tiles}
        <article class="rcard fares">
          <header class="fares-head">${icon('ticket', 'big')}<h3>Fares</h3>
            <svg class="waves" viewBox="0 0 200 60" aria-hidden="true"><path d="M0 40c20-12 40-12 60 0s40 12 60 0 40-12 80 0" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/><path d="M0 52c20-12 40-12 60 0s40 12 60 0 40-12 80 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/></svg></header>
          <div class="rcard-body">
            <table class="fare-tbl"><thead><tr><th>Passenger Type</th><th class="num">Fare (PHP)</th></tr></thead><tbody>${rows}</tbody></table>
            <p class="fare-note">${icon('info')}<span>Exact fare rates and applicable discounts are subject to change. Please check the latest schedule and fare details before booking.</span></p>
          </div>
        </article>
      </div>
      <div class="advisory">${icon('megaphone', 'big')}<h3>Travel Advisory</h3><p>${esc(adv.summary)}</p>
        <button type="button" class="btn-outline" id="adv-open">View Advisory ${icon('arrow')}</button></div>
    </section>`;
  }

  const LEGAL = [['terms', 'Terms of Service'], ['privacy', 'Privacy Policy'], ['faq', 'FAQ']];

  const portOpts = '<option value="">Select %s</option>' +
    Object.keys(config.ports).map(k => `<option value="${k}">${esc(config.ports[k].name)}, ${esc(config.ports[k].area.split(',')[0])}</option>`).join('');

  function html() {
    const c = config.contact || {};
    const legal = config.legal || {};
    return `
    <section class="hero">
      <img class="hero-photo" src="assets/hero.jpg" alt="" onload="this.classList.add('ready')" onerror="this.parentNode.classList.add('no-photo');this.remove()">
      ${HERO_ART}
      <div class="hero-shade"></div>
      <div class="hero-inner">
        <p class="eyebrow light">ISLANDS CONNECT PEOPLE</p>
        <h1>Your Journey<br>Starts at Sea</h1>
        <p class="hero-sub">Discover easier island travel with<br>${esc(config.company)}.</p>
        <ul class="badges">
          <li>${icon('ship')}Safe</li><li>${icon('people')}Reliable</li><li>${icon('compass')}For a Better<br>Connected Community</li>
        </ul>
      </div>
    </section>

    <section class="search-card" id="search">
      <div class="search-tabs" role="tablist">
        <button class="stab on" data-tab="book" role="tab">${icon('ticket')} Book a Ticket</button>
        <button class="stab" data-tab="check" role="tab">${icon('calendar')} Check Booking</button>
      </div>
      <form class="search-form" id="f-book">
        <label class="fld"><span>From</span><div class="inp">${icon('pin')}<select id="s-from">${portOpts.replace('%s', 'Origin')}</select></div></label>
        <button type="button" class="swap" id="s-swap" aria-label="Swap origin and destination">${icon('swap')}</button>
        <label class="fld"><span>To</span><div class="inp">${icon('pin')}<select id="s-to">${portOpts.replace('%s', 'Destination')}</select></div></label>
        <label class="fld"><span>Departure Date</span><div class="inp">${icon('calendar')}<input type="date" id="s-date" min="${u.today()}" max="${u.addDays(u.today(), config.advanceBookingDays)}"></div></label>
        <label class="fld"><span>Passengers</span><div class="inp">${icon('user')}<select id="s-pax">${Array.from({ length: config.maxPassengersPerBooking }, (_, i) => `<option value="${i + 1}">${i + 1} Passenger${i ? 's' : ''}</option>`).join('')}</select></div></label>
        <button class="btn-navy lg">Search Trips ${icon('arrow')}</button>
      </form>
      <form class="search-form check" id="f-check" hidden>
        <label class="fld"><span>Booking reference</span><div class="inp">${icon('ticket')}<input id="c-ref" placeholder="G7-261012-ABCD" autocomplete="off" required></div></label>
        <label class="fld"><span>Mobile number</span><div class="inp">${icon('user')}<input id="c-phone" inputmode="tel" required></div></label>
        <button class="btn-navy lg">Find Booking ${icon('arrow')}</button>
      </form>
    </section>

    <section class="features">
      <div class="feat">${icon('ticket', 'big')}<div><h3>Easy Online Booking</h3><p>Book your tickets anytime, anywhere in just a few clicks.</p></div></div>
      <div class="feat">${icon('ship', 'big')}<div><h3>Convenient Travel</h3><p>Comfortable and reliable sea travel for your next journey.</p></div></div>
      <div class="feat">${icon('shield', 'big')}<div><h3>Secure Tickets</h3><p>Your booking information is safe and protected.</p></div></div>
    </section>

    <section class="band tint" id="destinations">
      <p class="eyebrow">EVERYTHING YOU NEED</p>
      <h2 class="sec-title">Plan Your Journey</h2>
      <p class="sec-sub">Book a seat, check the schedule, or look up an existing booking with ${esc(config.company)}.</p>
      <div class="dest-grid">${CARDS.map(d => `<a class="dest" href="${d.href}">
        <div class="dest-art"><img src="${d.img}" alt=""></div>
        <div class="dest-cap"><div><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p></div><span class="go">${icon('arrow')}</span></div></a>`).join('')}</div>
    </section>

    ${routesHTML()}

    <section class="band steps-band" id="guide">
      ${STEPS_ART}
      <p class="eyebrow ruled warm">SIMPLE STEPS</p><h2 class="sec-title xl2">How Booking Works</h2>
      <p class="sec-sub">Get your ferry ticket in just a few easy steps and sail with us.</p>
      <div class="steps2">
        <div class="step2"><i>1</i><span class="sic">${icon('search')}</span><div><h3>Search Your Trip</h3><p>Select your departure and destination and choose your preferred schedule.</p></div></div>
        ${icon('chevron', 'chev')}
        <div class="step2"><i>2</i><span class="sic">${icon('ticket')}</span><div><h3>Choose &amp; Book</h3><p>Pick your seats and passenger types, then complete your booking.</p></div></div>
        ${icon('chevron', 'chev')}
        <div class="step2"><i>3</i><span class="sic">${icon('doc')}</span><div><h3>Get Your Ticket</h3><p>Receive your e-ticket and travel with ease.</p></div></div>
      </div>
    </section>

    <section class="band about-band" id="about">
      <p class="eyebrow ruled warm">ABOUT US</p><h2 class="sec-title xl2">${esc(config.company)}</h2>
      <p class="sec-sub">${esc(config.about || `${config.company}, operating ${config.vessel}, provides regular ferry and fastcraft service between ${config.ports.TILIK.name}, ${config.ports.TILIK.area}, and ${config.ports.NASUGBU.name}, ${config.ports.NASUGBU.area}.`)}</p>
    </section>

    <footer class="site-foot" id="contact">
      <div class="sf-boat" aria-hidden="true"></div>
      <svg class="sf-wave" viewBox="0 0 1440 140" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70C200 20 360 120 640 90S1100 20 1440 80L1440 140L0 140Z" fill="#0a4590" opacity=".45"/><path d="M0 100C240 60 420 140 760 112S1180 70 1440 110L1440 140L0 140Z" fill="#0b5bb3" opacity=".35"/></svg>
      <div class="sf-main">
        <div class="sf-col sf-brand">
          <div class="logo-slot"><img class="logo-img" src="assets/logo-white.png" alt="${esc(config.company)}" onload="this.parentNode.classList.add('has-logo')" onerror="this.remove()">${LOGO_BIG}</div>
          <div class="wordmark">MARINE TRANSPORT</div>
          <p>Your trusted partner for safe, reliable, and convenient sea travel between ${esc(config.ports.TILIK.name)}, ${esc(config.ports.TILIK.area.split(',')[0])} and ${esc(config.ports.NASUGBU.name)}, ${esc(config.ports.NASUGBU.area)}.</p>
        </div>
        <div class="sf-col"><h4>Quick Links</h4><ul class="sf-links">
          <li><a href="#/home">${icon('home')}Home</a></li>
          <li><a href="#/book">${icon('ticket')}Book a Trip</a></li>
          <li><a href="#/home?s=routes">${icon('ship')}Schedules</a></li>
          <li><a href="#/home?s=routes">${icon('doc')}Fares</a></li>
          <li><a href="#/home?s=about">${icon('info')}About Us</a></li>
          <li><a href="#/home?s=contact">${icon('phone')}Contact Us</a></li></ul></div>
        <div class="sf-col"><h4>Contact Information</h4><ul class="sf-info">
          <li>${icon('pin')}<span>${esc(config.ports.TILIK.name)}, ${esc(config.ports.TILIK.area)}</span></li>
          <li>${icon('pin')}<span>${esc(config.ports.NASUGBU.name)}, ${esc(config.ports.NASUGBU.area)}</span></li>
          ${c.email ? `<li>${icon('mail')}<a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
          ${c.phone ? `<li>${icon('phone')}<span>${esc(c.phone)}</span></li>` : ''}</ul></div>
        <div class="sf-col"><h4>Departures</h4><ul class="sf-info">
          ${config.routes.map(r => `<li>${icon('clock')}<span>${esc(trips.routeLabel(r))}<small>${u.fmtTime(r.departs)}</small></span></li>`).join('')}
          <li class="sf-note"><span>Schedules may vary by day and weather.</span></li></ul></div>
      </div>
      <div class="sf-base"><div class="sf-base-in">
        <span>\u00a9 ${new Date().getFullYear()} ${esc(config.company)}. All rights reserved.</span>
        <div class="sf-right">
          ${LEGAL.filter(l => legal[l[0]]).length ? `<nav class="legal">${LEGAL.filter(l => legal[l[0]]).map(l => `<button type="button" data-legal="${l[0]}">${l[1]}</button>`).join('<span>|</span>')}</nav>` : ''}
          <div class="social">
            ${c.facebook ? `<a href="${esc(c.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${FB}</a>` : ''}
            ${c.messenger ? `<a href="${esc(c.messenger)}" target="_blank" rel="noopener" aria-label="Messenger">${icon('chat')}</a>` : ''}
            ${c.youtube ? `<a href="${esc(c.youtube)}" target="_blank" rel="noopener" aria-label="YouTube">${YT}</a>` : ''}
          </div>
        </div>
      </div></div>
    </footer>`;
  }

  function render(root) {
    root.innerHTML = html();

    // tabs
    $$('.stab', root).forEach(b => b.addEventListener('click', () => {
      $$('.stab', root).forEach(x => x.classList.toggle('on', x === b));
      $('#f-book', root).hidden = b.dataset.tab !== 'book';
      $('#f-check', root).hidden = b.dataset.tab !== 'check';
    }));

    // origin/destination stay opposite each other (only two ports)
    const from = $('#s-from', root), to = $('#s-to', root);
    const other = v => (v === 'TILIK' ? 'NASUGBU' : v === 'NASUGBU' ? 'TILIK' : '');
    from.addEventListener('change', () => (to.value = other(from.value)));
    to.addEventListener('change', () => (from.value = other(to.value)));
    $('#s-swap', root).addEventListener('click', () => { const f = from.value; from.value = to.value; to.value = f; });

    $('#f-book', root).addEventListener('submit', e => {
      e.preventDefault();
      if (!from.value || !to.value) return u.toast('Please select your origin and destination.', 'err');
      const date = $('#s-date', root).value;
      if (!date) return u.toast('Please select a departure date.', 'err');
      const r = config.routes.find(x => x.from === from.value && x.to === to.value);
      G7.booking.prefill({ date, routeId: r.id, pax: Number($('#s-pax', root).value) });
      location.hash = '#/book';
    });

    $('#f-check', root).addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#f-check button[type=submit], #f-check .btn-navy', root);
      if (btn) btn.disabled = true;
      let b = null;
      try { b = await ticket.find($('#c-ref', root).value, $('#c-phone', root).value); }
      catch (err) { console.error('[lookup]', err); if (btn) btn.disabled = false; return u.toast('Could not check the booking right now: ' + (err.message || err), 'err'); }
      if (btn) btn.disabled = false;
      if (!b) return u.toast('No booking found with those details.', 'err');
      ticket.show(b);
    });

    // Footer legal links open the text from config.legal in a popup
    $$('[data-legal]', root).forEach(btn => btn.addEventListener('click', () => {
      const item = LEGAL.find(l => l[0] === btn.dataset.legal);
      const text = String((config.legal || {})[btn.dataset.legal] || '');
      u.modal('<h2>' + esc(item[1]) + '</h2>' + text.split(/\n\s*\n/).map(p => '<p>' + esc(p) + '</p>').join(''));
    }));

    // Travel advisory popup
    const advBtn = $('#adv-open', root);
    if (advBtn) advBtn.addEventListener('click', () => {
      const adv = config.advisory || { summary: '', items: [] };
      const items = adv.items.concat('Online booking closes ' + config.bookingCutoffMinutes + ' minutes before departure.');
      u.modal(`<h2>Travel Advisory</h2><p>${esc(adv.summary)}</p><ul class="adv-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`);
    });

    // "Book this trip" on route tiles
    $$('[data-route]', root).forEach(a => a.addEventListener('click', () => {
      G7.booking.prefill({ routeId: a.dataset.route });
    }));
  }

  G7.views = G7.views || {};
  G7.views.home = { render };
})();
