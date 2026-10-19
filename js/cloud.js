/* ============================================================
 * cloud.js - Supabase connection (shared database + staff sign-in).
 * Keeps an in-memory copy of the data so the rest of the app can stay
 * synchronous; storage.js reads/writes through it. Writes go to the
 * server in order; a failed write shows an error toast.
 * Falls back to local (browser-only) mode when not configured.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.cloud = (function () {
  const cfg = G7.supabaseConfig || {};
  const lib = window.supabase;
  if (cfg.url && cfg.key && !(lib && lib.createClient)) {
    console.error('[cloud] database library failed to load; running in local mode');
    document.addEventListener('DOMContentLoaded', function () { try { G7.u.toast('Cannot load the database library. Check your internet connection and reload. Data shown is NOT the shared data.', 'err'); } catch (e) {} });
  }
  if (!(cfg.url && cfg.key && lib && lib.createClient)) {
    return { on: false, ready: Promise.resolve() };
  }

  let storage; try { storage = window.sessionStorage; } catch (e) { storage = undefined; }
  const sb = lib.createClient(cfg.url, cfg.key, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  const C = { kv: {}, taken: {}, staff: [], me: null };
  const snap = { bk: {}, tr: {}, ex: {}, st: {} };
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const toast = m => { try { G7.u.toast(m, 'err'); } catch (e) {} };
  const must = res => { if (res.error) throw res.error; return res.data; };

  let chain = Promise.resolve();
  function queue(fn, what) {
    chain = chain.then(fn).catch(e => {
      console.error('[cloud] save failed:', what, e);
      toast('Could not save ' + what + ' to the server. Check your connection, then reload the page.');
    });
    return chain;
  }

  // ---------- loading ----------
  async function loadPublic() {
    const today = G7.u.today(), to = G7.u.addDays(today, (G7.config.advanceBookingDays || 90) + 2);
    const [st, tr, ex, tk] = await Promise.all([
      sb.from('settings').select('key,value'),
      sb.from('trip_overrides').select('trip_id,data'),
      sb.from('extra_trips').select('data'),
      sb.rpc('taken_seats_range', { p_from: today, p_to: to }),
    ]);
    snap.st = {}; snap.tr = {}; snap.ex = {};
    must(st).forEach(r => { C.kv[r.key] = r.value; snap.st[r.key] = JSON.stringify(r.value); });
    const t = {}; must(tr).forEach(r => { t[r.trip_id] = r.data; snap.tr[r.trip_id] = JSON.stringify(r.data); }); C.kv.trips = t;
    C.kv.extraTrips = must(ex).map(r => { snap.ex[r.data.id] = JSON.stringify(r.data); return r.data; });
    C.taken = {};
    (must(tk) || []).forEach(r => { (C.taken[r.trip_id] = C.taken[r.trip_id] || []).push(r.seat); });
    C.kv.bookings = C.kv.bookings || [];
  }

  async function fetchBookings() {
    const out = []; let from = 0;
    for (;;) {
      const rows = must(await sb.from('bookings').select('ref,data').order('created_at', { ascending: true }).range(from, from + 999));
      rows.forEach(r => out.push(r.data));
      if (rows.length < 1000) break;
      from += 1000;
    }
    return out;
  }
  function setBookings(list) {
    C.kv.bookings = list; snap.bk = {};
    list.forEach(b => { snap.bk[b.ref] = JSON.stringify(b); });
  }
  async function loadStaff() {
    await chain;
    setBookings(await fetchBookings());
    await loadPublic();            // trips, extra trips and every setting (staff can read them all)
    C.taken = {};                  // staff see real bookings instead
    C.staff = must(await sb.from('staff_profiles').select('id,name,role,active').order('name'));
  }
  async function refreshBookings() {
    if (!C.me) return;
    try { await chain; setBookings(await fetchBookings()); } catch (e) { console.error('[cloud] refresh failed', e); }
  }

  // ---------- reads / writes used by storage.js ----------
  const read = (key, fb) => (C.kv[key] === undefined ? fb : clone(C.kv[key]));

  function write(key, value) {
    C.kv[key] = clone(value);
    if (key === 'bookings') {
      const rows = [], seen = {};
      value.forEach(b => {
        seen[b.ref] = 1; const j = JSON.stringify(b);
        if (snap.bk[b.ref] !== j) { snap.bk[b.ref] = j; rows.push({ ref: b.ref, trip_id: b.tripId, trip_date: b.date, status: b.status || 'confirmed', data: b }); }
      });
      const del = Object.keys(snap.bk).filter(r => !seen[r]); del.forEach(r => delete snap.bk[r]);
      return queue(async () => {
        if (rows.length) must(await sb.from('bookings').upsert(rows));
        if (del.length) must(await sb.from('bookings').delete().in('ref', del));
      }, 'bookings');
    }
    if (key === 'trips') {
      const rows = [], seen = {};
      Object.keys(value).forEach(id => { seen[id] = 1; const j = JSON.stringify(value[id]); if (snap.tr[id] !== j) { snap.tr[id] = j; rows.push({ trip_id: id, data: value[id] }); } });
      const del = Object.keys(snap.tr).filter(i => !seen[i]); del.forEach(i => delete snap.tr[i]);
      return queue(async () => {
        if (rows.length) must(await sb.from('trip_overrides').upsert(rows));
        if (del.length) must(await sb.from('trip_overrides').delete().in('trip_id', del));
      }, 'trip changes');
    }
    if (key === 'extraTrips') {
      const rows = [], seen = {};
      value.forEach(t => { seen[t.id] = 1; const j = JSON.stringify(t); if (snap.ex[t.id] !== j) { snap.ex[t.id] = j; rows.push({ id: t.id, trip_date: t.date, data: t }); } });
      const del = Object.keys(snap.ex).filter(i => !seen[i]); del.forEach(i => delete snap.ex[i]);
      return queue(async () => {
        if (rows.length) must(await sb.from('extra_trips').upsert(rows));
        if (del.length) must(await sb.from('extra_trips').delete().in('id', del));
      }, 'extra trips');
    }
    // everything else is a setting
    snap.st[key] = JSON.stringify(value);
    return queue(async () => must(await sb.from('settings').upsert({ key, value })), 'settings');
  }

  async function resetAll() {
    await chain;
    must(await sb.from('bookings').delete().neq('ref', ''));
    must(await sb.from('trip_overrides').delete().neq('trip_id', ''));
    must(await sb.from('extra_trips').delete().neq('id', ''));
    must(await sb.from('settings').delete().in('key', ['farePrices', 'customFares', 'maintenance', 'openDates']));
    ['bookings', 'trips', 'extraTrips', 'farePrices', 'customFares', 'maintenance', 'openDates'].forEach(k => delete C.kv[k]);
    C.kv.bookings = []; C.kv.trips = {}; C.kv.extraTrips = [];
    snap.bk = {}; snap.tr = {}; snap.ex = {}; snap.st = {};
  }

  // ---------- customer functions ----------
  async function createBooking(b) {
    const { data, error } = await sb.rpc('create_booking', { p: b });
    if (error) return { ok: false, reason: String(error.message || 'Could not save the booking.') };
    const saved = data || b;
    C.kv.bookings = (C.kv.bookings || []).filter(x => x.ref !== saved.ref).concat([saved]);
    (saved.passengers || []).forEach(p => { if (p.seat) (C.taken[saved.tripId] = C.taken[saved.tripId] || []).push(p.seat); });
    return { ok: true, booking: clone(saved) };
  }
  async function lookup(ref, phone) {
    ref = String(ref || '').trim().toUpperCase();
    if (!ref) return null;
    const { data, error } = await sb.rpc('lookup_booking', { p_ref: ref, p_phone: String(phone || '') });
    if (error) throw error;
    if (!data) return null;
    C.kv.bookings = (C.kv.bookings || []).filter(x => x.ref !== data.ref).concat([data]);
    return clone(data);
  }
  async function reloadTaken() { try { await loadPublic(); } catch (e) {} }

  // ---------- staff sign-in ----------
  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { C.me = null; return null; }
    const { data } = await sb.from('staff_profiles').select('id,name,role,active').eq('id', session.user.id).maybeSingle();
    if (!data || !data.active) { await sb.auth.signOut(); C.me = null; return null; }
    C.me = data; return data;
  }
  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password: String(password) });
    if (error) return null;
    const me = await loadMe();
    if (me) await loadStaff();
    return me;
  }
  async function signOut() {
    C.me = null; C.staff = []; C.kv.bookings = []; snap.bk = {};
    try { await sb.auth.signOut(); await loadPublic(); } catch (e) {}
  }
  async function loginList() { return must(await sb.rpc('staff_login_list')) || []; }

  // add / edit staff through the server function (administrators only)
  async function invokeStaff(body) {
    const { data, error } = await sb.functions.invoke('staff-admin', { body });
    if (error) {
      let msg = 'Could not reach the server.';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
      return { ok: false, reason: msg };
    }
    if (data && data.error) return { ok: false, reason: data.error };
    await loadStaff().catch(() => {});
    if (C.me) { const m = C.staff.find(s => s.id === C.me.id); if (m) C.me = m; }
    return { ok: true, id: data && data.id };
  }
  async function changeOwnPassword(oldPw, newPw) {
    if (!C.me) return { ok: false, reason: 'Not signed in.' };
    const { data: { session } } = await sb.auth.getSession();
    const email = session && session.user && session.user.email;
    const chk = await sb.auth.signInWithPassword({ email, password: String(oldPw) });
    if (chk.error) return { ok: false, reason: 'Current PIN is wrong.' };
    const { error } = await sb.auth.updateUser({ password: String(newPw) });
    return error ? { ok: false, reason: error.message } : { ok: true };
  }

  const ready = (async function () {
    try { await loadPublic(); const me = await loadMe(); if (me) await loadStaff(); }
    catch (e) { console.error('[cloud] startup failed', e); toast('Cannot reach the server. Check your internet connection.'); }
  })();

  return {
    on: true, ready, sb, read, write, resetAll, loadStaff, refreshBookings, reloadTaken,
    taken: tripId => (C.taken[tripId] || []).slice(),
    createBooking, lookup, signIn, signOut, loginList, invokeStaff, changeOwnPassword,
    me: () => C.me, staff: () => C.staff.map(s => Object.assign({}, s)),
  };
})();
