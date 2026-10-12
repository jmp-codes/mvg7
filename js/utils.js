/* ============================================================
 * utils.js  -  Small shared helpers (formatting, toast, modal)
 * ============================================================ */
window.G7 = window.G7 || {};

G7.u = (function () {
  const pad2 = n => String(n).padStart(2, '0');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function money(n) {
    return G7.config.currency + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function dateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function today() { return dateStr(new Date()); }
  function addDays(str, n) {
    const d = new Date(str + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }
  function fmtDate(s) {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(t) {
    const [h, m] = t.split(':').map(Number);
    return ((h % 12) || 12) + ':' + pad2(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  // Booking reference, e.g. G7-261012-K3F9 (no look-alike characters)
  function newRef(date) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    for (let i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return 'G7-' + date.slice(2).replace(/-/g, '') + '-' + r;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function toast(msg, type) {
    let box = $('#toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // Opens a modal; returns { el, close }
  function modal(html, cls) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true">
      <button class="modal-x no-print" aria-label="Close">&times;</button>
      <div class="modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    $('.modal-x', wrap).addEventListener('click', close);
    return { el: $('.modal-body', wrap), close };
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  return { esc, money, today, addDays, dateStr, fmtDate, fmtTime, newRef, $, $$, toast, modal, download, csvCell };
})();
