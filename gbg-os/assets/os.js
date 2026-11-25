/* GBG OS shell.
   Merge seam for the backstage venture switcher: this file registers GBG in
   window.BACKSTAGE_VENTURES. The switcher (built in the Petrushkas session) can
   read that registry to draw the venture row and swap nav links. Until it ships,
   this file draws its own GBG nav into #os-nav. */
(function () {
  var GBG = {
    id: 'gbg',
    name: 'GBG',
    label: 'GBG Dubuque',
    home: '/gbg-os/',
    color: '#e36b1e',
    sections: [
      { id: 'hub',      name: 'Hub',      href: '/gbg-os/' },
      { id: 'start',    name: 'Start here', href: '/gbg-os/start/' },
      { id: 'tasks',    name: 'Tasks',    href: '/gbg-os/tasks/' },
      { id: 'checkin',  name: 'Check in', href: '/gbg-os/checkin/' },
      { id: 'jobs',     name: 'Jobs',     href: '/gbg-os/jobs/' },
      { id: 'contacts', name: 'Contacts', href: '/gbg-os/contacts/' },
      { id: 'services', name: 'Services', href: '/gbg-os/services/' },
      { id: 'playbook', name: 'Playbook', href: '/gbg-os/playbook/' },
      { id: 'web',      name: 'Web & Content', href: '/gbg-os/web/' },
      { id: 'finance',  name: 'Finance',  href: '/gbg-os/finance/' }
    ],
    // Launch prep pages: temporary, shown in the left column until launch
    side: [
      { id: 'launch', name: 'Launch', href: '/gbg-os/launch/', note: 'Road to April 1, open decisions, what to verify.' },
      { id: 'gear',   name: 'Gear',   href: '/gbg-os/gear/',   note: 'What we own, what we still need, cheapest service to start.' },
      { id: 'roles',  name: 'Roles',  href: '/gbg-os/roles/',  note: 'Rate every role. Scores open when all three finish.' }
    ]
  };
  window.BACKSTAGE_VENTURES = window.BACKSTAGE_VENTURES || {};
  window.BACKSTAGE_VENTURES.gbg = GBG;

  var LOGO = '<svg viewBox="0 0 90 90" aria-hidden="true"><g fill="#e36b1e">' +
    '<rect x="8" y="58" width="22" height="22" rx="2"/><rect x="34" y="58" width="22" height="22" rx="2"/>' +
    '<rect x="60" y="58" width="22" height="22" rx="2"/><rect x="21" y="33" width="22" height="22" rx="2"/>' +
    '<rect x="47" y="33" width="22" height="22" rx="2"/><rect x="34" y="8" width="22" height="22" rx="2"/></g></svg>';

  // Workspace buttons are Ricky's only. Cosmetic: the other workspaces have their own Access lock.
  function isRicky() { try { return localStorage.getItem('gbg_user') === 'ricky'; } catch (e) { return false; } }
  function drawSide(page) {
    if (document.querySelector('.os-side')) return;
    var side = document.createElement('aside'); side.className = 'os-side';
    side.innerHTML = '<div class="side-h">Launch prep</div>' + GBG.side.map(function (s) {
      return '<a href="' + s.href + '"' + (s.id === page ? ' class="active"' : '') + '><b>' + s.name + '</b><span>' + s.note + '</span></a>';
    }).join('');
    var nav = document.getElementById('os-nav');
    nav.parentNode.insertBefore(side, nav.nextSibling);
    document.body.classList.add('has-side');
    var act = side.querySelector('a.active'); if (act && side.scrollWidth > side.clientWidth) side.scrollLeft = act.offsetLeft - 16;
  }

  function drawNav() {
    var nav = document.getElementById('os-nav');
    if (!nav || nav.dataset.switcher === 'on') return; // switcher took over
    var page = document.body.getAttribute('data-page') || 'hub';
    var links = GBG.sections.map(function (s) {
      return '<a href="' + s.href + '"' + (s.id === page ? ' class="active"' : '') + '>' + s.name + '</a>';
    }).join('');
    nav.innerHTML = '<a class="os-brand" href="/gbg-os/">' + LOGO + '<b style="font-weight:700">GBG <span>OS</span></b></a>' +
      '<div class="os-links">' + links + '</div>' +
      (isRicky() ? '<nav class="ws-switch" aria-label="Workspaces"><a href="/">Urban Backstage</a>' +
      '<a class="pk" href="/queen/">Petrushka\'s</a><a class="on" href="/gbg-os/">GBG Services</a></nav>' : '');
    drawSide(page);
    drawMenu(page, nav);
  }

  // Phones: one Menu button opens every page, launch prep in its own section
  function drawMenu(page, nav) {
    var cur = GBG.sections.concat(GBG.side).filter(function (s) { return s.id === page; })[0];
    var btn = document.createElement('button'); btn.className = 'os-menubtn'; btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="cur">' + (cur ? cur.name : 'Menu') + '</span><span class="bars"><i></i><i></i><i></i></span>';
    nav.appendChild(btn);
    var panel = document.createElement('div'); panel.className = 'os-menu'; panel.hidden = true;
    var item = function (s) { return '<a href="' + s.href + '"' + (s.id === page ? ' class="active"' : '') + '>' + s.name + (s.note ? '<span>' + s.note + '</span>' : '') + '</a>'; };
    panel.innerHTML = '<div class="mh">Pages</div>' + GBG.sections.map(item).join('') +
      '<div class="mh">Launch prep</div>' + GBG.side.map(item).join('') +
      (isRicky() ? '<div class="mh">Workspaces</div><a href="/">Urban Backstage</a><a href="/queen/">Petrushka\'s</a>' : '');
    nav.parentNode.insertBefore(panel, nav.nextSibling);
    btn.addEventListener('click', function () {
      var open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
    });
  }

  // Days until launch (target April 1, 2027, Central)
  function drawCountdown() {
    var target = new Date('2027-04-01T00:00:00-05:00').getTime();
    var days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
    document.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = days; });
  }

  document.addEventListener('DOMContentLoaded', function () { drawNav(); drawCountdown(); });
})();
