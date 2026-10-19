/* ============================================================
 * trips.js  -  Trip & seat-availability logic (no DOM here)
 * A "trip" = one route on one date. It is derived from config
 * plus any override saved by the Ticket Office.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.trips = (function () {
  const { config, store } = G7;

  function id(date, routeId) { return date + '|' + routeId; }
  function route(routeId) { return config.routes.find(r => r.id === routeId); }

  function routeLabel(r) {
    return config.ports[r.from].name + ' → ' + config.ports[r.to].name;
  }
  function routeLongLabel(r) {
    const f = config.ports[r.from], t = config.ports[r.to];
    return `${f.name} (${f.area}) → ${t.name} (${t.area})`;
  }

  // Builds a trip object from its base data {id,date,routeId,departs} plus saved overrides
  function build(base, extra) {
    const o = store.tripOverride(base.id);
    return {
      id: base.id,
      date: base.date,
      routeId: base.routeId,
      route: route(base.routeId),
      departs: o.departs || base.departs,
      cancelled: !!o.cancelled,
      blocked: (o.blocked || []).slice(),
      note: o.note || '',
      extra: !!extra,
    };
  }

  // The default daily trip of a route
  function get(date, routeId) {
    return build({ id: id(date, routeId), date, routeId, departs: route(routeId).departs }, false);
  }

  // Any trip (default or extra) by its id
  function byId(tid) {
    const parts = String(tid || '').split('|');
    if (parts.length < 3) return route(parts[1]) ? get(parts[0], parts[1]) : null;
    const x = store.extraTrips().find(e => e.id === tid);
    return x ? build(x, true) : null;
  }

  // All trips running on a date (default + extra), earliest first
  function forDate(date) {
    const list = config.routes.map(r => get(date, r.id));
    store.extraTrips().filter(e => e.date === date).forEach(e => list.push(build(e, true)));
    return list.sort((a, b) => a.departs.localeCompare(b.departs));
  }

  // Adds an extra departure. Returns { ok, reason, trip }
  function addExtra(date, routeId, departs) {
    if (!route(routeId)) return { ok: false, reason: 'Choose a route.' };
    if (!date || !/^\d{2}:\d{2}$/.test(departs || '')) return { ok: false, reason: 'Choose a date and departure time.' };
    if (forDate(date).some(t => t.routeId === routeId && t.departs === departs)) return { ok: false, reason: 'A trip on this route already departs at that time.' };
    const x = { id: date + '|' + routeId + '|' + Date.now().toString(36), date, routeId, departs };
    store.addExtraTrip(x);
    return { ok: true, trip: byId(x.id) };
  }

  function allSeats() {
    const seats = [];
    config.sections.forEach(s => s.rows.forEach(row => row.forEach(c => { if (typeof c === 'number') seats.push(c); })));
    return seats;
  }

  // Returns { [seatNo]: { state, ref?, name? } } where state is
  // 'available' | 'booked' | 'blocked' | 'oos'
  function seatMap(trip) {
    const map = {};
    allSeats().forEach(n => (map[n] = { state: 'available' }));
    store.maintenanceSeats().forEach(n => { if (map[n]) map[n] = { state: 'oos' }; });
    trip.blocked.forEach(n => { if (map[n] && map[n].state === 'available') map[n] = { state: 'blocked' }; });
    store.takenSeats(trip.id).forEach(n => { if (map[n] && map[n].state === 'available') map[n] = { state: 'booked' }; });
    store.bookings()
      .filter(b => b.tripId === trip.id && b.status === 'confirmed')
      .forEach(b => b.passengers.forEach(p => {
        if (p.seat && map[p.seat]) map[p.seat] = { state: 'booked', ref: b.ref, name: p.name };
      }));
    return map;
  }

  function availableCount(trip) {
    const m = seatMap(trip);
    return Object.keys(m).filter(n => m[n].state === 'available').length;
  }
  function sellableCount(trip) {
    const m = seatMap(trip);
    return Object.keys(m).filter(n => m[n].state !== 'oos' && m[n].state !== 'blocked').length;
  }

  function departureDate(trip) {
    return new Date(trip.date + 'T' + trip.departs + ':00');
  }

  // { ok:boolean, reason:string }
  function bookable(trip) {
    if (trip.cancelled) return { ok: false, reason: 'This trip has been cancelled.' };
    if (!store.isOpenDate(trip.date)) return { ok: false, reason: 'Booking is not open for this date yet.' };
    const cutoff = departureDate(trip).getTime() - config.bookingCutoffMinutes * 60000;
    if (Date.now() > cutoff) return { ok: false, reason: 'Booking for this trip is closed.' };
    return { ok: true, reason: '' };
  }

  // Can a customer book anything on this date? { ok, reason, next? }  (next = the next date that has an open trip)
  function nextBookable(from, routeId, pax) {
    const u = G7.u, max = u.addDays(u.today(), config.advanceBookingDays);
    for (let i = 1; i <= config.advanceBookingDays; i++) {
      const d = u.addDays(from, i);
      if (d > max) break;
      if (forDate(d).some(t => (!routeId || t.routeId === routeId) && bookable(t).ok && availableCount(t) >= (pax || 1))) return d;
    }
    return '';
  }
  function trips_label(r) { return routeLabel(r); }
  function dayStatus(date, routeId, pax) {
    const u = G7.u, today = u.today(), max = u.addDays(today, config.advanceBookingDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { ok: false, range: true, reason: 'Please choose a travel date.' };
    if (date < today) return { ok: false, range: true, reason: 'That date has already passed. Please choose today or a later date.' };
    if (date > max) return { ok: false, range: true, reason: 'There are no trips on that date yet. Bookings are open up to ' + u.fmtDate(max) + '.' };
    if (!store.isOpenDate(date)) {
      return { ok: false, range: false, reason: 'Booking is not open for ' + u.fmtDate(date) + ' yet. No trips are scheduled on that date.', next: nextBookable(date, routeId, pax) };
    }
    if (!forDate(date).some(t => (!routeId || t.routeId === routeId) && bookable(t).ok && availableCount(t) >= (pax || 1))) {
      const rt = routeId && route(routeId);
      return { ok: false, range: false, reason: 'No ' + (rt ? trips_label(rt) + ' ' : '') + 'trips are available on ' + u.fmtDate(date) + ' (cancelled, closed or fully booked).', next: nextBookable(date, routeId, pax) };
    }
    return { ok: true };
  }

  return { dayStatus, nextBookable, id, route, routeLabel, routeLongLabel, get, byId, forDate, addExtra, allSeats, seatMap, availableCount, sellableCount, departureDate, bookable };
})();
