/* ============================================================
 * storage.js  -  ALL persistence lives here (localStorage).
 * To move to a real backend later, replace the bodies of these
 * functions (keep the same names) and the rest of the app works.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.store = (function () {
  const PREFIX = 'g7.';

  const cloud = () => G7.cloud && G7.cloud.on;
  function get(key, fallback) {
    if (cloud()) return G7.cloud.read(key, fallback);
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.error('[store] read failed for', key, e);
      return fallback;
    }
  }
  function set(key, value) {
    if (cloud()) { G7.cloud.write(key, value); return; }
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

  // ---- Seats out of service (maintenance). Defaults to config.outOfService until changed in the office ----
  function maintenanceSeats() { const v = get('maintenance', null); return Array.isArray(v) ? v : G7.config.outOfService.slice(); }
  function setMaintenanceSeats(list) { set('maintenance', list); }

  // ---- Dates open for booking. The office opens ranges of dates; nothing else can be booked. ----
  // Default (nothing saved yet): today through the next 30 days.
  function openRanges() {
    const v = get('openDates', null);
    if (Array.isArray(v)) return v.filter(r => r && r.from && r.to);
    return [{ from: G7.u.today(), to: G7.u.addDays(G7.u.today(), 30) }];
  }
  function setOpenRanges(list) { set('openDates', list); }
  function isOpenDate(date) {
    return openRanges().some(r => date >= r.from && date <= r.to) || extraTrips().some(t => t.date === date);
  }

  // ---- Extra trips added by the Ticket Office (beyond the default daily schedule) ----
  function extraTrips() { return get('extraTrips', []); }
  function addExtraTrip(t) { const l = extraTrips(); l.push(t); set('extraTrips', l); return t; }
  function removeExtraTrip(id) {
    set('extraTrips', extraTrips().filter(t => t.id !== id));
    const all = tripOverrides(); delete all[id]; set('trips', all);
  }

  // ---- Fares: built-in categories (price overridable) + custom categories added in the office ----
  function customFares() { return get('customFares', []); }
  function saveCustomFares(list) { set('customFares', list); }
  function fares() {
    const saved = get('farePrices', {});
    const out = {};
    Object.keys(G7.config.fares).forEach(id => {
      out[id] = Object.assign({ id }, G7.config.fares[id]);
      if (saved[id] != null) out[id].price = Number(saved[id]);
    });
    customFares().forEach(f => { out[f.id] = Object.assign({ custom: true, seat: true }, f); });
    return out;
  }
  function fareOrder() { return G7.config.fareOrder.concat(customFares().map(f => f.id)); }
  function setFarePrices(map) { set('farePrices', map); }

  // ---- Staff accounts (Ticket Office). Until staff are edited, one default admin uses config.adminPin ----
  function staff() {
    if (cloud()) return G7.cloud.staff();
    const v = get('staff', null);
    if (Array.isArray(v) && v.length) return v;
    return [{ id: 'admin', name: 'Administrator', pin: G7.config.adminPin, role: 'admin', active: true }];
  }
  function saveStaff(list) { set('staff', list); }

  // ---- Receipt numbers: R-YYMMDD-0001, restarting each day ----
  const issued = {};
  function nextReceiptNo(prefix) {
    if (cloud()) {
      // shared database: continue after the highest number already used today
      const d = new Date(), p2 = x => String(x).padStart(2, '0');
      const stamp = prefix + '-' + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + '-';
      let max = issued[stamp] || 0;
      bookings().forEach(b => ((b.payment && b.payment.log) || []).forEach(l => { if (l.no && String(l.no).indexOf(stamp) === 0) max = Math.max(max, parseInt(String(l.no).slice(-4), 10) || 0); }));
      issued[stamp] = max + 1;
      return stamp + String(max + 1).padStart(4, '0');
    }
    const d = new Date(), key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const seq = get('receiptSeq', {});
    const n = (seq[prefix] && seq[prefix].day === key ? seq[prefix].n : 0) + 1;
    seq[prefix] = { day: key, n };
    set('receiptSeq', seq);
    const p2 = x => String(x).padStart(2, '0');
    return prefix + '-' + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + String(n).padStart(4, '0');
  }

  // Seats already taken on a trip (customer pages only know seat numbers, not names)
  function takenSeats(tripId) { return cloud() ? G7.cloud.taken(tripId) : []; }

  // ---- Maintenance --------------------------------------------------
  function exportAll() {
    return { exportedAt: new Date().toISOString(), bookings: bookings(), trips: tripOverrides(), extraTrips: extraTrips(), customFares: customFares(), maintenance: maintenanceSeats(), openDates: openRanges(), farePrices: get('farePrices', {}), staff: staff().map(x => ({ id: x.id, name: x.name, role: x.role, active: x.active !== false })) };
  }
  function resetAll() {
    if (cloud()) return G7.cloud.resetAll();
    ['bookings', 'trips', 'extraTrips', 'farePrices', 'customFares', 'maintenance', 'openDates', 'receiptSeq'].forEach(k => localStorage.removeItem(PREFIX + k));
  }

  return { takenSeats, staff, saveStaff, nextReceiptNo, bookings, saveBookings, getBooking, addBooking, updateBooking, tripOverride, tripOverrides, setTripOverride, maintenanceSeats, setMaintenanceSeats, openRanges, setOpenRanges, isOpenDate, extraTrips, addExtraTrip, removeExtraTrip, fares, fareOrder, customFares, saveCustomFares, setFarePrices, exportAll, resetAll };
})();
