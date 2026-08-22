/* ══════════════════════════════════════════════════════════════════════════
   URBAN BACKSTAGE — mobile nav toggle
   Added 2026-08-13.

   Injects a hamburger button into .ub-nav and lets it toggle .open on the
   nav. All the actual styling lives in mobile.css inside a max-width query.

   HOW DESKTOP STAYS SAFE: the button is created with the `hidden` attribute
   set, so the browser's own stylesheet hides it. Only the rule inside
   mobile.css's media query un-hides it. If mobile.css ever fails to load,
   the button stays invisible and the nav behaves exactly as it did before.

   This script does not move, rename, or remove any existing nav markup. It
   appends one button and toggles one class. Nothing else.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    var nav = document.querySelector('.ub-nav');
    if (!nav) return;
    var links = nav.querySelector('.ub-links');
    if (!links) return;
    if (nav.querySelector('.ub-burger')) return; // already wired

    if (!links.id) links.id = 'ub-links-panel';

    var btn = document.createElement('button');
    btn.className = 'ub-burger';
    btn.type = 'button';
    btn.hidden = true;
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', links.id);
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    function close() {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Tapping a link, tapping outside, or Escape all close it.
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') close();
    });

    // Rotating to landscape past the breakpoint should not leave a stuck panel.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
