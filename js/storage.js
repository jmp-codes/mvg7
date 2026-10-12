/* ============================================================
 * storage.js  -  ALL persistence lives here (localStorage).
 * To move to a real backend later, replace the bodies of these
 * functions (keep the same names) and the rest of the app works.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.store = (function () {
  const PREFIX = 'g7.';

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.error('[store] read failed for', key, e);
      return fallback;
    }
  }
  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('[store] write failed for', key, e);
      G7.u && G7.u.toast('Could not save data (storage full or blocked).', 'err');
    }
  }

  // ---- Bookings -----------------------------------------------------
  function bookings() { return get('bookings', []); }
  function saveBookings(list) { set('bookings', list); }
  function getBooking(ref) {
    ref = String(ref || '').trim().toUpperCase();
    return bookings().find(b => b.ref === ref) || null;
  }
  function addBooking(b) {
    const list = bookings();
    list.push(b);
    saveBookings(list);
    return b;
  }
  // fn(booking) mutates the booking; returns the updated booking
  function updateBooking(ref, fn) {
    const list = bookings();
    const b = list.find(x => x.ref === ref);
    if (!b) return null;
    fn(b);
    saveBookings(list);
    return b;
  }

  // ---- Per-trip overrides (cancelled, changed time, blocked seats) ----
  function tripOverrides() { return get('trips', {}); }
  function tripOverride(id) { return tripOverrides()[id] || {}; }
  function setTripOverride(id, patch) {
    const all = tripOverrides();
    all[id] = Object.assign({}, all[id] || {}, patch);
    set('trips', all);
    return all[id];
  }

  // ---- Extra trips added by the Ticket Office (beyond the default daily schedule) ----
  function extraTrips() { return get('extraTrips', []); }
  function addExtraTrip(t) { const l = extraTrips(); l.push(t); set('extraTrips', l); return t; }
  function removeExtraTrip(id) {
    set('extraTrips', extraTrips().filter(t => t.id !== id));
    const all = tripOverrides(); delete all[id]; set('trips', all);
  }

  // ---- Fares (only prices are overridable) ----------------------------
  function fares() {
    const saved = get('farePrices', {});
    const out = {};
    Object.keys(G7.config.fares).forEach(id => {
      out[id] = Object.assign({ id }, G7.config.fares[id]);
      if (saved[id] != null) out[id].price = Number(saved[id]);
    });
    return out;
  }
  function setFarePrices(map) { set('farePrices', map); }

  // ---- Maintenance --------------------------------------------------
  function exportAll() {
    return { exportedAt: new Date().toISOString(), bookings: bookings(), trips: tripOverrides(), extraTrips: extraTrips(), farePrices: get('farePrices', {}) };
  }
  function resetAll() {
    ['bookings', 'trips', 'extraTrips', 'farePrices'].forEach(k => localStorage.removeItem(PREFIX + k));
  }

  return { bookings, saveBookings, getBooking, addBooking, updateBooking, tripOverride, tripOverrides, setTripOverride, extraTrips, addExtraTrip, removeExtraTrip, fares, setFarePrices, exportAll, resetAll };
})();
