/* ===================================================================
   UNC SALES OPS — Unified Top Nav + Command Palette
   v1.0 — 2026-05-12
   Auto-injects on every page that includes this script.
   =================================================================== */

(function() {
  'use strict';

  // ============================================================
  // FORCE MOBILE LAYOUT DETECTION
  // Uses screen.width (physical device, can't be faked by Safari Desktop Mode)
  // Sets <html data-mobile="true"> when device is actually narrow.
  // CSS rules targeting [data-mobile="true"] apply regardless of viewport reporting.
  // ============================================================
  (function detectMobile() {
    const physicalWidth = (window.screen && window.screen.width) || window.innerWidth;
    const isPhone = physicalWidth < 600 || /iPhone|Android.*Mobile|iPod/i.test(navigator.userAgent);
    const isTablet = physicalWidth < 900;
    if (isPhone) document.documentElement.setAttribute('data-mobile', 'phone');
    else if (isTablet) document.documentElement.setAttribute('data-mobile', 'tablet');
  })();

  const NAV = [
    {
      label: 'Cockpits',
      icon: '🎯',
      items: [
        { path: '/sales-ops/cold-call/',      label: 'Cold Call',         status: 'live' },
        { path: '/sales-ops/niche-outreach/',  label: 'Niche Outreach',    status: 'live' },
        { path: '/sales-ops/inbound/',        label: 'Inbound',           status: 'live' },
        { path: '/sales-ops/discovery/',      label: 'Discovery',         status: 'live' },
        { path: '/sales-ops/service-pitch/',  label: 'Service Pitch',     status: 'live' },
        { path: '/sales-ops/renewal-upsell/', label: 'Renewal / Upsell',  status: 'live' },
        { path: '/sales-ops/proposal-walkthrough/', label: 'Proposal Walkthrough', status: 'live' },
        { path: '/sales-ops/referral-ask/',   label: 'Referral Ask',      status: 'live' },
        { path: '/sales-ops/win-back/',       label: 'Win-Back',          status: 'live' },
        { path: '/sales-ops/onboarding-kickoff/', label: 'Onboarding Kickoff', status: 'live' }
      ]
    },
    {
      label: 'Dashboards',
      icon: '📊',
      items: [
        { path: '/sales-ops/dashboards/pipeline/',  label: 'Pipeline',           status: 'live' },
        { path: '/sales-ops/dashboards/activity/',  label: 'Activity (Today/Week)', status: 'live' },
        { path: '/sales-ops/dashboards/heatmap/',   label: 'Best Dial Windows',  status: 'live' },
        { path: '/sales-ops/dashboards/reps/',        label: 'Rep Dashboard',       status: 'live' },
        { path: '/sales-ops/leaderboard/',            label: 'Leaderboard',         status: 'live' },
        { path: '/sales-ops/map/',                    label: 'Intel Map',           status: 'live' }
      ]
    },
    {
      label: 'Tools',
      icon: '🛠',
      items: [
        { path: '/sales-ops/tools/pricing/',         label: 'Pricing Calculator',  status: 'live' },
        { path: '/sales-ops/tools/objections/',      label: 'Objection Library',   status: 'live' },
        { path: '/sales-ops/tools/voicemails/',      label: 'Voicemail Library',   status: 'live' },
        { path: '/sales-ops/tools/trade-reference/', label: 'Trade Reference Sheet', status: 'live' },
        { path: '/sales-ops/tools/snippets/',        label: 'Snippet Library',     status: 'live' },
        { path: '/library/',                            label: 'Vertical Pitch Pages', status: 'live' },
        { path: '/sales-ops/tools/commission/',          label: 'Commission Tracker',   status: 'live' },
        { path: '/sales-ops/tools/email-launcher/',      label: 'Email Launcher',       status: 'live' },
        { path: '/sales-ops/tools/prospect-lookup/',     label: 'Prospect Lookup',      status: 'live' },
        { path: '/sales-ops/tools/callbacks/',             label: 'Callback Queue',       status: 'live' },
        { path: '/sales-ops/tools/today/',                 label: 'Start My Day',         status: 'live' }
      ]
    },
    {
      label: 'System',
      icon: '⚙',
      items: [
        { path: '/sales-ops/workspace/', label: 'Hub Home',          status: 'live' },
        { path: '/sales-ops/guide/',     label: 'Guide & Training', status: 'live' },
        { path: '/sales-ops/academy/',   label: 'Academy — Certification', status: 'live' },
        { path: '/sales-ops/demo/',      label: 'Recruiting Demo Hub', status: 'live' },
        { path: '/sales-ops/settings/', label: 'Settings',          status: 'live' },
        { path: '/sales-ops/roadmap/',  label: 'Roadmap & Changelog', status: 'live' }
      ]
    }
  ];

  function navHTML() {
    const path = window.location.pathname;
    return `
      <nav class="global-nav" role="navigation" aria-label="Sales Ops global nav">
        <div class="global-nav__inner">
          <a href="/sales-ops/" class="global-nav__brand" title="Sales Ops Home">
            <span class="global-nav__brand-dot"></span>
            <span class="global-nav__brand-text">UNC <b>Sales OS</b></span>
          </a>
          <button class="global-nav__hamburger" id="mobile-nav-toggle" aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
          <div class="global-nav__sections">
            ${NAV.map(section => `
              <div class="global-nav__section">
                <button class="global-nav__trigger" data-section="${section.label}">
                  <span class="global-nav__icon">${section.icon}</span>
                  <span>${section.label}</span>
                  <span class="global-nav__caret">▾</span>
                </button>
                <div class="global-nav__menu">
                  ${section.items.map(it => `
                    <a href="${it.path}" class="global-nav__item ${path === it.path ? 'active' : ''}" data-status="${it.status}">
                      <span>${it.label}</span>
                      ${it.status !== 'live' ? `<span class="global-nav__badge">${it.status}</span>` : ''}
                    </a>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="global-nav__right">
            <button class="global-nav__cmd" id="cmd-palette-trigger" title="Open command palette (Ctrl+K)" aria-label="Command palette">
              <span>⌘</span>
              <kbd>K</kbd>
            </button>
          </div>
        </div>
      </nav>

      <!-- Mobile slide-in drawer -->
      <div id="mobile-nav-drawer" class="mobile-drawer" hidden aria-label="Mobile navigation">
        <div class="mobile-drawer__overlay" data-drawer-close></div>
        <aside class="mobile-drawer__panel">
          <div class="mobile-drawer__head">
            <span class="mobile-drawer__title">Sales OS</span>
            <button class="mobile-drawer__close" data-drawer-close aria-label="Close menu">✕</button>
          </div>
          <div class="mobile-drawer__body">
            ${NAV.map(section => `
              <div class="mobile-drawer__section">
                <div class="mobile-drawer__section-title">${section.icon} ${section.label}</div>
                ${section.items.map(it => `
                  <a href="${it.path}" class="mobile-drawer__item ${path === it.path ? 'active' : ''}">${it.label}</a>
                `).join('')}
              </div>
            `).join('')}
            <button class="mobile-drawer__cmd" id="mobile-cmd-trigger">⌘ Search / Command palette</button>
          </div>
        </aside>
      </div>

      <div id="cmd-palette" class="cmd-palette" hidden role="dialog" aria-label="Command palette">
        <div class="cmd-palette__overlay" data-cmd-close></div>
        <div class="cmd-palette__box">
          <div class="cmd-palette__head">
            <span class="cmd-palette__icon">🔎</span>
            <input id="cmd-palette-input" class="cmd-palette__input" placeholder="Jump to anything — type a cockpit, dashboard, or tool…" autocomplete="off" spellcheck="false">
            <kbd class="cmd-palette__esc">ESC</kbd>
          </div>
          <div id="cmd-palette-results" class="cmd-palette__results"></div>
          <div class="cmd-palette__foot">
            <span>↑ ↓ to navigate</span>
            <span>↵ to open</span>
            <span>ESC to close</span>
          </div>
        </div>
      </div>
    `;
  }

  function wireMobileDrawer() {
    const ham = document.getElementById('mobile-nav-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    if (!ham || !drawer) return;
    function open() { drawer.hidden = false; document.body.style.overflow = 'hidden'; ham.setAttribute('aria-expanded', 'true'); ham.classList.add('open'); }
    function close() { drawer.hidden = true; document.body.style.overflow = ''; ham.setAttribute('aria-expanded', 'false'); ham.classList.remove('open'); }
    ham.addEventListener('click', () => drawer.hidden ? open() : close());
    drawer.querySelectorAll('[data-drawer-close]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });
    const cmdBtn = document.getElementById('mobile-cmd-trigger');
    if (cmdBtn) cmdBtn.addEventListener('click', () => { close(); setTimeout(() => { const p = document.getElementById('cmd-palette'); if (p && p.hidden) document.getElementById('cmd-palette-trigger').click(); }, 200); });
  }

  function injectNav() {
    // Inject CSS link if not present
    if (!document.querySelector('link[data-nav-shell]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/sales-ops/shared/nav-shell.css?v=10';
      link.dataset.navShell = 'true';
      document.head.appendChild(link);
    }
    // Inject nav at top of body
    const navWrap = document.createElement('div');
    navWrap.id = 'global-nav-wrap';
    navWrap.innerHTML = navHTML();
    document.body.insertBefore(navWrap, document.body.firstChild);

    // Wire dropdowns (hover/click)
    const sections = document.querySelectorAll('.global-nav__section');
    sections.forEach(sec => {
      const trigger = sec.querySelector('.global-nav__trigger');
      const menu = sec.querySelector('.global-nav__menu');
      let openTimer = null;
      sec.addEventListener('mouseenter', () => { clearTimeout(openTimer); sec.classList.add('open'); });
      sec.addEventListener('mouseleave', () => { openTimer = setTimeout(() => sec.classList.remove('open'), 150); });
      trigger.addEventListener('click', (e) => { e.preventDefault(); sec.classList.toggle('open'); });
    });
    // Close menus on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-nav__section')) {
        document.querySelectorAll('.global-nav__section.open').forEach(s => s.classList.remove('open'));
      }
    });

    wireCommandPalette();
    wireMobileDrawer();
  }

  function wireCommandPalette() {
    const palette = document.querySelector('#cmd-palette');
    const input = document.querySelector('#cmd-palette-input');
    const results = document.querySelector('#cmd-palette-results');
    const trigger = document.querySelector('#cmd-palette-trigger');
    if (!palette || !input || !results) return;

    // Flatten all nav items for searching
    const allItems = [];
    NAV.forEach(section => section.items.forEach(it => allItems.push({ ...it, section: section.label, icon: section.icon })));

    let selected = 0;

    function render(query) {
      const q = (query || '').toLowerCase().trim();
      const matched = q
        ? allItems.filter(it => it.label.toLowerCase().includes(q) || it.section.toLowerCase().includes(q))
        : allItems;
      if (selected >= matched.length) selected = 0;
      results.innerHTML = matched.length ? matched.map((it, i) => `
        <a href="${it.path}" class="cmd-palette__result ${i === selected ? 'selected' : ''}" data-idx="${i}">
          <span class="cmd-palette__result-icon">${it.icon}</span>
          <div class="cmd-palette__result-text">
            <div class="cmd-palette__result-label">${it.label}</div>
            <div class="cmd-palette__result-section">${it.section}</div>
          </div>
          <kbd>↵</kbd>
        </a>
      `).join('') : '<div class="cmd-palette__empty">No matches.</div>';
    }

    function open() { palette.hidden = false; selected = 0; render(''); setTimeout(() => input.focus(), 30); }
    function close() { palette.hidden = true; input.value = ''; selected = 0; }

    trigger && trigger.addEventListener('click', open);
    palette.querySelectorAll('[data-cmd-close]').forEach(b => b.addEventListener('click', close));

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (palette.hidden) open(); else close();
        return;
      }
      if (palette.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = results.querySelectorAll('.cmd-palette__result');
        if (items.length) { selected = (selected + 1) % items.length; render(input.value); }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = results.querySelectorAll('.cmd-palette__result');
        if (items.length) { selected = (selected - 1 + items.length) % items.length; render(input.value); }
      }
      if (e.key === 'Enter') {
        const item = results.querySelector('.cmd-palette__result.selected');
        if (item) { e.preventDefault(); window.location.href = item.href; }
      }
    });

    input.addEventListener('input', () => render(input.value));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectNav);
  else injectNav();
})();
