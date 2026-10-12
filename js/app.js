/* ============================================================
 * app.js  -  App shell: hash router + navigation
 * Routes: #/home  #/book  #/ticket   (the Ticket Office is its own page: g7-staff.html)
 * Home sections can be targeted with  #/home?s=routes  (id of the section)
 * Loaded last, after every module has registered its view.
 * ============================================================ */
(function () {
  const { u } = G7;
  const ROUTES = ['home', 'book', 'ticket'];
  let lastView = null;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const name = ROUTES.indexOf(path) >= 0 ? path : 'home';
    const section = query ? new URLSearchParams(query).get('s') : null;
    return { name, section };
  }

  function scrollToSection(id) {
    const el = id && document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function show() {
    const { name, section } = parse();
    u.$$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
    document.body.classList.toggle('is-home', name === 'home');
    document.body.classList.toggle('is-book', name === 'book' || name === 'ticket');
    document.body.classList.toggle('is-office', name === 'office');

    // Same page, different section: just scroll, don't rebuild the page
    if (name === 'home' && lastView === 'home' && section) return scrollToSection(section);

    document.body.classList.remove('is-office-app'); // set again by the Ticket Office when signed in
    const main = u.$('#view');
    try {
      G7.views[name].render(main);
    } catch (err) {
      console.error('[app] view failed:', name, err);
      main.innerHTML = '<div class="card"><p class="msg err">Something went wrong loading this page. Open the browser console (F12) for details.</p></div>';
    }
    lastView = name;
    window.scrollTo(0, 0);
    if (section) setTimeout(() => scrollToSection(section), 30);
  }

  window.addEventListener('hashchange', show);
  document.addEventListener('DOMContentLoaded', function () {
    // wait for the shared database (trips, fares, taken seats) before the first render
    var ready = G7.cloud && G7.cloud.ready ? G7.cloud.ready : Promise.resolve();
    ready.then(show, show);
  });
})();
