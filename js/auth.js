/* ============================================================
 * auth.js  -  Ticket Office staff accounts and sign-in session
 * NOTE: client-side only (localStorage/sessionStorage). It tells
 * staff apart and stamps their name on payments; it is not real
 * security. Use a real backend before relying on it.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.auth = (function () {
  const { store } = G7;
  const KEY = 'g7.staff';

  const all = () => store.staff();
  const active = () => all().filter(s => s.active !== false);
  const find = id => all().find(s => s.id === id) || null;

  function me() {
    try { const s = find(sessionStorage.getItem(KEY)); return s && s.active !== false ? s : null; } catch (e) { return null; }
  }
  function login(id, pin) {
    const s = find(id);
    if (!s || s.active === false || String(pin) !== String(s.pin)) return null;
    try { sessionStorage.setItem(KEY, s.id); } catch (e) {}
    return s;
  }
  function logout() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('g7.admin'); } catch (e) {} }
  const isAdmin = () => { const s = me(); return !!s && s.role === 'admin'; };

  // ---- management (admin only; the UI enforces who can call these) ----
  const admins = () => active().filter(s => s.role === 'admin');
  function validate(list, data, selfId) {
    const name = String(data.name || '').trim();
    if (!name) return 'Enter a name.';
    if (list.some(s => s.id !== selfId && s.name.toLowerCase() === name.toLowerCase())) return 'A staff member with this name already exists.';
    if (!/^\d{4,8}$/.test(String(data.pin || ''))) return 'PIN must be 4 to 8 digits.';
    if (data.role !== 'admin' && data.role !== 'cashier') return 'Choose a role.';
    return '';
  }
  function save(data, id) {
    const list = all().map(s => Object.assign({}, s));
    const err = validate(list, data, id);
    if (err) return { ok: false, reason: err };
    if (id) {
      const s = list.find(x => x.id === id);
      if (!s) return { ok: false, reason: 'Staff not found.' };
      const wasAdmin = s.role === 'admin' && s.active !== false;
      Object.assign(s, { name: data.name.trim(), pin: String(data.pin), role: data.role });
      if (wasAdmin && s.role !== 'admin' && !list.some(x => x.id !== id && x.role === 'admin' && x.active !== false)) return { ok: false, reason: 'There must be at least one active administrator.' };
    } else {
      list.push({ id: 's' + Date.now().toString(36), name: data.name.trim(), pin: String(data.pin), role: data.role, active: true });
    }
    store.saveStaff(list);
    return { ok: true };
  }
  function setActive(id, on) {
    const list = all().map(s => Object.assign({}, s));
    const s = list.find(x => x.id === id);
    if (!s) return { ok: false, reason: 'Staff not found.' };
    if (!on) {
      const m = me();
      if (m && m.id === id) return { ok: false, reason: 'You cannot deactivate your own account.' };
      if (s.role === 'admin' && !list.some(x => x.id !== id && x.role === 'admin' && x.active !== false)) return { ok: false, reason: 'There must be at least one active administrator.' };
    }
    s.active = !!on;
    store.saveStaff(list);
    return { ok: true };
  }
  function changeOwnPin(oldPin, newPin) {
    const m = me();
    if (!m) return { ok: false, reason: 'Not signed in.' };
    if (String(oldPin) !== String(m.pin)) return { ok: false, reason: 'Current PIN is wrong.' };
    if (!/^\d{4,8}$/.test(String(newPin))) return { ok: false, reason: 'PIN must be 4 to 8 digits.' };
    const list = all().map(s => Object.assign({}, s));
    list.find(s => s.id === m.id).pin = String(newPin);
    store.saveStaff(list);
    return { ok: true };
  }

  return { all, active, find, me, login, logout, isAdmin, save, setActive, changeOwnPin };
})();
