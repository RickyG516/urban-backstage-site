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
      { id: 'tasks',    name: 'Tasks',    href: '/gbg-os/tasks/' },
      { id: 'launch',   name: 'Launch',   href: '/gbg-os/launch/' },
      { id: 'services', name: 'Services', href: '/gbg-os/services/' },
      { id: 'jobs',     name: 'Jobs',     href: '/gbg-os/jobs/' },
      { id: 'playbook', name: 'Playbook', href: '/gbg-os/playbook/' },
      { id: 'web',      name: 'Website & Content', href: '/gbg-os/web/' },
      { id: 'finance',  name: 'Finance',  href: '/gbg-os/finance/' }
    ]
  };
  window.BACKSTAGE_VENTURES = window.BACKSTAGE_VENTURES || {};
  window.BACKSTAGE_VENTURES.gbg = GBG;

  var LOGO = '<svg viewBox="0 0 90 90" aria-hidden="true"><g fill="#e36b1e">' +
    '<rect x="8" y="58" width="22" height="22" rx="2"/><rect x="34" y="58" width="22" height="22" rx="2"/>' +
    '<rect x="60" y="58" width="22" height="22" rx="2"/><rect x="21" y="33" width="22" height="22" rx="2"/>' +
    '<rect x="47" y="33" width="22" height="22" rx="2"/><rect x="34" y="8" width="22" height="22" rx="2"/></g></svg>';

  function drawNav() {
    var nav = document.getElementById('os-nav');
    if (!nav || nav.dataset.switcher === 'on') return; // switcher took over
    var page = document.body.getAttribute('data-page') || 'hub';
    var links = GBG.sections.map(function (s) {
      return '<a href="' + s.href + '"' + (s.id === page ? ' class="active"' : '') + '>' + s.name + '</a>';
    }).join('');
    nav.innerHTML = '<a class="os-brand" href="/gbg-os/">' + LOGO + '<b style="font-weight:700">GBG <span>OS</span></b></a>' +
      '<div class="os-links">' + links + '</div>' +
      '<nav class="ws-switch" aria-label="Workspaces"><a href="/">Urban Backstage</a>' +
      '<a class="pk" href="/queen/">Petrushka\'s</a><a class="on" href="/gbg-os/">GBG Services</a></nav>';
  }

  // Days until launch (target April 1, 2027, Central)
  function drawCountdown() {
    var target = new Date('2027-04-01T00:00:00-05:00').getTime();
    var days = Math.max(0, Math.ceil((target - Date.now()) / 86400000));
    document.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = days; });
  }

  document.addEventListener('DOMContentLoaded', function () { drawNav(); drawCountdown(); });
})();
