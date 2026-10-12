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

  function get(date, routeId) {
    const r = route(routeId);
    const tid = id(date, routeId);
    const o = store.tripOverride(tid);
    return {
      id: tid,
      date,
      routeId,
      route: r,
      departs: o.departs || r.departs,
      cancelled: !!o.cancelled,
      blocked: (o.blocked || []).slice(),
      note: o.note || '',
    };
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
    config.outOfService.forEach(n => { if (map[n]) map[n] = { state: 'oos' }; });
    trip.blocked.forEach(n => { if (map[n] && map[n].state === 'available') map[n] = { state: 'blocked' }; });
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
    const cutoff = departureDate(trip).getTime() - config.bookingCutoffMinutes * 60000;
    if (Date.now() > cutoff) return { ok: false, reason: 'Booking for this trip is closed.' };
    return { ok: true, reason: '' };
  }

  return { id, route, routeLabel, routeLongLabel, get, allSeats, seatMap, availableCount, sellableCount, departureDate, bookable };
})();
