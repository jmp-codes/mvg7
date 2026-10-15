/* office-app.js - entry point of g7-staff.html (administrator / ticket office page).
 * The public website lives in index.html in the same folder. */
(function () {
  document.addEventListener('DOMContentLoaded', async function () {
    document.body.classList.add('is-office');
    if (G7.cloud && G7.cloud.ready) await G7.cloud.ready;     // load shared data + restore the staff session
    G7.views.office.render(document.getElementById('view'));

    // Auto sign-out after 15 minutes without activity (protects shared counter computers)
    var IDLE = 15 * 60 * 1000, timer;
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(async function () {
        if (G7.auth.me()) { await G7.auth.logout(); location.reload(); }
      }, IDLE);
    }
    ['click', 'keydown', 'mousemove', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, arm, { passive: true }); });
    arm();

    // Keep bookings fresh when several staff work at once (skipped while a dialog is open or a field is being edited)
    if (G7.cloud && G7.cloud.on) {
      setInterval(async function () {
        if (!G7.auth.me() || document.hidden) return;
        if (document.querySelector('.modal, .of-mod, .ob-modal, dialog[open]')) return;
        var a = document.activeElement;
        if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
        await G7.cloud.refreshBookings();
        var b = document.querySelector('.os-link.on'); if (b) b.click();
      }, 30000);
    }
  });
})();
