/* ============================================================
 * auth.js  -  Ticket Office staff accounts and sign-in session
 * With the shared database configured (cloud.js) this uses real
 * Supabase sign-in: PINs are the account passwords (6 to 8 digits)
 * and the database enforces who may do what.
 * Without it (local demo mode) it is client-side only and NOT secure.
 * ============================================================ */
window.G7 = window.G7 || {};

G7.auth = (function () {
  const { store } = G7;
  const KEY = 'g7.staff';
  const cloud = () => G7.cloud && G7.cloud.on;
  const PIN_RE = () => (cloud() ? /^\d{6,8}$/ : /^\d{4,8}$/);
  const PIN_MSG = () => (cloud() ? 'PIN must be 6 to 8 digits.' : 'PIN must be 4 to 8 digits.');

  const all = () => store.staff();
  const active = () => all().filter(s => s.active !== false);
  const find = id => all().find(s => s.id === id) || null;

  function me() {
    if (cloud()) return G7.cloud.me();
    try { const s = find(sessionStorage.getItem(KEY)); return s && s.active !== false ? s : null; } catch (e) { return null; }
  }
  // Staff shown on the sign-in screen: [{ id, name, email? }]. email is set only for accounts that sign in with a real email.
  async function loginOptions() {
    if (!cloud()) return active().map(s => ({ id: s.id, name: s.name, email: 'local' }));
    const list = await G7.cloud.loginList();
    return list.map(s => ({ id: s.id, name: s.name, email: s.login_email || '' }));
  }
  // cloud: id is the option's email (or an email typed in); local: staff id
  async function login(id, pin, email) {
    if (cloud()) return await G7.cloud.signIn(email || id, pin);
    const s = find(id);
    if (!s || s.active === false || String(pin) !== String(s.pin)) return null;
    try { sessionStorage.setItem(KEY, s.id); } catch (e) {}
    return s;
  }
  function logout() {
    if (cloud()) return G7.cloud.signOut();
    try { sessionStorage.removeItem(KEY); sessionStorage.removeItem('g7.admin'); } catch (e) {}
  }
  const isAdmin = () => { const s = me(); return !!s && s.role === 'admin'; };

  // ---- management (admin only; the UI and, in cloud mode, the database enforce who can call these) ----
  const admins = () => active().filter(s => s.role === 'admin');
  function validate(list, data, selfId, needPin) {
    const name = String(data.name || '').trim();
    if (!name) return 'Enter a name.';
    if (list.some(s => s.id !== selfId && s.name.toLowerCase() === name.toLowerCase())) return 'A staff member with this name already exists.';
    if ((needPin || data.pin) && !PIN_RE().test(String(data.pin || ''))) return PIN_MSG();
    if (data.role !== 'admin' && data.role !== 'cashier') return 'Choose a role.';
    return '';
  }
  async function save(data, id) {
    const list = all().map(s => Object.assign({}, s));
    const err = validate(list, data, id, !id || !cloud());
    if (err) return { ok: false, reason: err };
    if (cloud()) {
      return id
        ? await G7.cloud.invokeStaff({ action: 'update', id, name: data.name.trim(), role: data.role, pin: data.pin ? String(data.pin) : '' })
        : await G7.cloud.invokeStaff({ action: 'create', name: data.name.trim(), role: data.role, pin: String(data.pin) });
    }
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
  async function setActive(id, on) {
    const list = all().map(s => Object.assign({}, s));
    const s = list.find(x => x.id === id);
    if (!s) return { ok: false, reason: 'Staff not found.' };
    if (!on) {
      const m = me();
      if (m && m.id === id) return { ok: false, reason: 'You cannot deactivate your own account.' };
      if (s.role === 'admin' && !list.some(x => x.id !== id && x.role === 'admin' && x.active !== false)) return { ok: false, reason: 'There must be at least one active administrator.' };
    }
    if (cloud()) return await G7.cloud.invokeStaff({ action: 'update', id, active: !!on });
    s.active = !!on;
    store.saveStaff(list);
    return { ok: true };
  }
  async function changeOwnPin(oldPin, newPin) {
    const m = me();
    if (!m) return { ok: false, reason: 'Not signed in.' };
    if (!PIN_RE().test(String(newPin))) return { ok: false, reason: PIN_MSG() };
    if (cloud()) return await G7.cloud.changeOwnPassword(oldPin, newPin);
    if (String(oldPin) !== String(m.pin)) return { ok: false, reason: 'Current PIN is wrong.' };
    const list = all().map(s => Object.assign({}, s));
    list.find(s => s.id === m.id).pin = String(newPin);
    store.saveStaff(list);
    return { ok: true };
  }

  return { all, active, find, me, loginOptions, login, logout, isAdmin, save, setActive, changeOwnPin, pinMsg: PIN_MSG };
})();
