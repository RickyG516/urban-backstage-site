/* Petrushka's OS front end. Static page: no real data lives in this file.
 * Everything loads from the queen-os-api Worker after PIN unlock. */
(function () {
  'use strict';

  var API = 'https://queen-os-api.ricky-a17.workers.dev';
  var LS_KEY = 'queen_key', LS_USER = 'queen_user';

  var VENTURES = [
    { slug: 'home', code: 'home', name: 'Home' },
    { slug: 'flowers', code: 'FLWR', name: 'Flower Garden' },
    { slug: 'greens', code: 'MCRG', name: 'Microgreens' },
    { slug: 'gazebo', code: 'GZBO', name: 'Gazebo' },
    { slug: 'airbnb', code: 'ABNB', name: 'Airbnb' }
  ];
  var CODE_NAME = { FLWR: 'Flowers', MCRG: 'Greens', GZBO: 'Gazebo', ABNB: 'Airbnb', SHRD: 'Shared' };
  var VIEWS = [
    { slug: 'today', name: 'Today' },
    { slug: 'build', name: 'Build', only: ['home', 'flowers'] },
    { slug: 'setup', name: 'Setup', only: ['greens', 'gazebo', 'airbnb'] },
    { slug: 'buy', name: 'Buy', only: ['greens', 'flowers', 'gazebo', 'airbnb', 'home'] },
    { slug: 'accounts', name: 'Accounts', only: ['greens', 'gazebo'] },
    { slug: 'projects', name: 'Projects' },
    { slug: 'calendar', name: 'Calendar' },
    { slug: 'money', name: 'Money' }
  ];
  var USERS = { ricky: 'Ricky', petra: 'Petra' };

  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var counts = {};
  var projFilter = 'open';

  /* ── storage ── */
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k) || '';
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return ''; }
  }

  /* ── utils ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayIso() { return new Date().toLocaleDateString('en-CA'); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDue(due, prec) {
    if (!due) return '';
    var y = +due.slice(0, 4), m = +due.slice(5, 7), d = +due.slice(8, 10);
    if (prec === 'month') return MON[m - 1] + ' ' + y;
    var thisYear = new Date().getFullYear();
    return MON[m - 1] + ' ' + d + (y !== thisYear ? ', ' + y : '');
  }
  function isLate(t) { return t.due && t.due_precision !== 'month' && t.status !== 'done' && t.due < todayIso(); }
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function ventureBySlug(s) { for (var i = 0; i < VENTURES.length; i++) if (VENTURES[i].slug === s) return VENTURES[i]; return null; }
  function ventureByCode(c) { for (var i = 0; i < VENTURES.length; i++) if (VENTURES[i].code === c) return VENTURES[i]; return null; }

  /* ── api ── */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'x-queen-key': ls(LS_KEY), 'x-queen-user': ls(LS_USER) };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, {
      method: opts.method || 'GET', headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store'
    }).then(function (r) {
      if (r.status === 401) { ls(LS_KEY, null); showLock(); throw new Error('locked'); }
      return r.json().then(function (d) {
        if (!d.ok) throw new Error(d.error || 'request failed');
        return d;
      });
    });
  }
  function fail(e) { if (e && e.message !== 'locked') toast('Could not save: ' + e.message); }

  /* ── lock screen ── */
  function showLock() {
    if (document.querySelector('.lock')) return;
    var pick = ls(LS_USER) || 'ricky';
    var el = document.createElement('div');
    el.className = 'lock';
    el.innerHTML =
      '<form class="box" autocomplete="off">' +
      '<img src="/petrushkas/logos/petrushkas_Monogram_A.svg" alt="">' +
      '<h2>Petrushka\'s</h2><p class="sub">Enter your PIN to open the OS.</p>' +
      '<div class="who-pick">' +
      Object.keys(USERS).map(function (u) { return '<button type="button" data-u="' + u + '"' + (u === pick ? ' class="on"' : '') + '>' + USERS[u] + '</button>'; }).join('') +
      '</div>' +
      '<input type="password" inputmode="text" placeholder="PIN" aria-label="PIN" required>' +
      '<p class="err"></p><button class="btn" type="submit">Unlock</button></form>';
    document.body.appendChild(el);
    var input = el.querySelector('input'), err = el.querySelector('.err'), btn = el.querySelector('.btn');
    el.querySelectorAll('[data-u]').forEach(function (b) {
      b.onclick = function () {
        pick = b.getAttribute('data-u');
        el.querySelectorAll('[data-u]').forEach(function (x) { x.classList.toggle('on', x === b); });
        input.focus();
      };
    });
    el.querySelector('form').onsubmit = function (ev) {
      ev.preventDefault();
      btn.disabled = true; err.textContent = 'Checking…';
      fetch(API + '/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: pick, pin: input.value }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) { err.textContent = 'That PIN did not match.'; btn.disabled = false; input.select(); return; }
          ls(LS_KEY, d.key); ls(LS_USER, d.user);
          el.remove(); boot();
        })
        .catch(function () { err.textContent = 'Could not reach the server. Try again.'; btn.disabled = false; });
    };
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ── chrome ── */
  function renderChrome(route) {
    // workspace switcher: only on devices that also hold the UNC key
    var ws = $('ws');
    if (ls('unc_worker_key')) {
      ws.hidden = false;
      ws.innerHTML = '<a href="/">Urban Backstage</a><a class="on" href="/queen/">Petrushka\'s</a><a href="/gbg-os/">GBG Services</a>';
    }
    var who = $('who');
    who.hidden = false;
    who.textContent = USERS[ls(LS_USER)] || 'Lock';
    who.onclick = function () {
      if (confirm('Lock Petrushka\'s on this device? You will need your PIN to open it again.')) { ls(LS_KEY, null); location.reload(); }
    };
    var vs = route.v || 'home', view = route.view || 'today';
    $('ventures').innerHTML = VENTURES.map(function (v) {
      var n = v.code === 'home' ? Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0) : (counts[v.code] || 0);
      var target = route.project ? 'projects' : (route.section ? 'build' : view);
      var tv = VIEWS.filter(function (x) { return x.slug === target; })[0];
      if (tv && tv.only && tv.only.indexOf(v.slug) < 0) target = 'today';
      return '<a href="#/' + v.slug + '/' + target + '"' + (v.slug === vs ? ' class="on"' : '') + '>' + esc(v.name) + (n ? '<span class="n">' + n + '</span>' : '') + '</a>';
    }).join('');
    $('views').innerHTML = VIEWS.filter(function (w) { return !w.only || w.only.indexOf(vs) >= 0; }).map(function (w) {
      return '<a href="#/' + vs + '/' + w.slug + '"' + (!route.project && w.slug === view ? ' class="on"' : '') + '>' + w.name + '</a>';
    }).join('');
  }

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'p' && h[1]) return { project: decodeURIComponent(h[1]), v: h[2] || 'home' };
    if (h[0] === 's' && h[1]) return { section: decodeURIComponent(h[1]), v: h[2] || 'flowers', view: 'build' };
    var v = ventureBySlug(h[0]) ? h[0] : 'home';
    var view = ['today', 'build', 'setup', 'buy', 'accounts', 'projects', 'calendar', 'money'].indexOf(h[1]) >= 0 ? h[1] : 'today';
    var vw = VIEWS.filter(function (x) { return x.slug === view; })[0];
    if (vw && vw.only && vw.only.indexOf(v) < 0) view = 'today';
    return { v: v, view: view };
  }

  function route() {
    if (!ls(LS_KEY)) { showLock(); return; }
    var r = parseRoute();
    renderChrome(r);
    window.scrollTo(0, 0);
    if (r.project) return viewProject(r.project, r.v);
    if (r.section) return viewSection(r.section, r.v);
    var v = ventureBySlug(r.v);
    if (r.view === 'build') return viewBuild(v, 'garden');
    if (r.view === 'setup') return viewBuild(v, v.slug === 'gazebo' ? 'gazebo' : v.slug === 'airbnb' ? 'airbnb' : 'greens');
    if (r.view === 'buy') return viewBuy(v);
    if (r.view === 'accounts') return viewAccounts(v);
    if (r.view === 'today') return viewToday(v);
    if (r.view === 'projects') return viewProjects(v);
    return viewSoon(v, r.view);
  }

  /* ── task row ── */
  function taskRow(t, opts) {
    opts = opts || {};
    var meta = [];
    if (opts.showProject) meta.push('<a href="#/p/' + encodeURIComponent(t.project_id) + '/' + (opts.vslug || 'home') + '">' + esc(t.project_name) + '</a>');
    if (opts.showVenture && t.venture) meta.push('<span class="pill v">' + esc(CODE_NAME[t.venture] || t.venture) + '</span>');
    if (t.due) meta.push('<span class="due' + (isLate(t) ? ' late' : '') + '">' + (isLate(t) ? 'Late, ' : 'Due ') + fmtDue(t.due, t.due_precision) + '</span>');
    if (t.status === 'doing' || t.status === 'blocked') meta.push('<span class="pill ' + t.status + '">' + (t.status === 'doing' ? 'In progress' : 'Blocked') + '</span>');
    if (t.owner) meta.push(esc(USERS[t.owner] || t.owner));
    return '<div class="task' + (t.status === 'done' ? ' done' : '') + '" data-id="' + esc(t.id) + '">' +
      '<button class="chk" type="button" aria-label="Mark done"></button>' +
      '<div class="body"><div class="title"' + (opts.editable ? ' data-edit="1" role="button" tabindex="0"' : '') + '>' + esc(t.title) + '</div>' +
      (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') +
      '<div class="editor"></div></div></div>';
  }

  function wireChecks(root, tasksById, after) {
    root.querySelectorAll('.task .chk').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.task'), id = row.getAttribute('data-id'), t = tasksById[id];
        var next = t.status === 'done' ? 'todo' : 'done';
        row.classList.toggle('done', next === 'done');
        api('/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: { status: next } })
          .then(function () { t.status = next; if (next === 'done') toast('Done. One more W.'); if (after) after(); })
          .catch(function (e) { row.classList.toggle('done', t.status === 'done'); fail(e); });
      };
    });
  }

  function loadCounts(d) {
    counts = {};
    (d.counts || []).forEach(function (c) { counts[c.venture] = c.open; });
  }

  /* ── Today ── */
  function viewToday(v) {
    app.innerHTML = '<p class="muted">Loading today…</p>';
    api('/today?v=' + v.code).then(function (d) {
      loadCounts(d); renderChrome(parseRoute());
      var byId = {};
      [d.overdue, d.this_week, d.doing, d.blocked].forEach(function (l) { l.forEach(function (t) { byId[t.id] = t; }); });
      var o = { showProject: true, showVenture: v.code === 'home', vslug: v.slug };
      var sec = function (title, list, empty) {
        return '<section><h2>' + title + '</h2><div class="card">' +
          (list.length ? list.map(function (t) { return taskRow(t, o); }).join('') : '<div class="empty">' + empty + '</div>') + '</div></section>';
      };
      var dt = new Date(d.date + 'T12:00:00');
      var w = d.weather || {};
      var wx = '';
      if (w.days && w.days.length) {
        wx = '<div class="wx">' + w.days.map(function (x, i) {
          var name = i === 0 ? 'Today' : new Date(x.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
          return '<div class="d' + (x.lo <= 32 ? ' cold' : '') + '"><b>' + name + '</b><span class="t">' + x.hi + '° / ' + x.lo + '°</span>' +
            (x.rain_pct != null ? '<br><small class="muted">' + x.rain_pct + '% rain</small>' : '') + '</div>';
        }).join('') + '</div>';
        if (w.flags && w.flags.length) wx += '<div class="flags">' + w.flags.map(function (f) {
          var day = new Date(f.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
          return '<span class="flag ' + f.level + '">' + day + ': ' + esc(f.text) + '</span>';
        }).join('') + '</div>';
      } else { wx = '<p class="muted">Weather is unavailable right now.</p>'; }

      app.innerHTML =
        '<h1>' + (v.code === 'home' ? 'Today at Queen St' : esc(v.name) + ' today') + '</h1>' +
        '<p class="sub">' + dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + (w.now != null ? ' · ' + w.now + '° now' : '') + '</p>' +
        wx +
        (d.working && d.working.length ? '<section><h2>Working on now</h2><div class="card">' + d.working.map(function (w) {
          return '<a class="task" style="text-decoration:none;color:inherit" href="#/s/' + encodeURIComponent(w.id) + '/' + ({ greens: 'greens', gazebo: 'gazebo', airbnb: 'airbnb' }[w.map] || 'flowers') + '">' +
            '<span class="pin s' + w.stage + '">' + esc(w.marker) + '</span><div class="body"><div class="title">' + esc(w.name) + '</div>' +
            '<div class="meta"><span class="pill st' + w.stage + '">' + esc(w.stage_name) + '</span> · ' + w.open_tasks + ' open</div></div></a>';
        }).join('') + '</div></section>' : '') +
        '<div class="cols">' +
        sec('Overdue', d.overdue, 'Nothing late.') +
        sec('Due this week', d.this_week, 'Nothing due this week.') +
        sec('In progress', d.doing, 'Nothing in progress.') +
        sec('Blocked', d.blocked, 'Nothing blocked.') +
        '</div>';
      wireChecks(app, byId);
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  /* ── Projects list ── */
  function viewProjects(v) {
    app.innerHTML = '<p class="muted">Loading projects…</p>';
    api('/projects?v=' + v.code).then(function (d) {
      var list = d.projects.filter(function (p) {
        if (projFilter === 'open') return p.status !== 'done';
        if (projFilter === 'all') return true;
        return p.status === projFilter;
      });
      var filters = [['open', 'Open'], ['active', 'Active'], ['planned', 'Planned'], ['blocked', 'Blocked'], ['done', 'Done'], ['all', 'All']];
      app.innerHTML =
        '<h1>' + (v.code === 'home' ? 'All projects' : esc(v.name) + ' projects') + '</h1>' +
        '<div class="toolbar">' +
        filters.map(function (f) { return '<button class="btn small ' + (projFilter === f[0] ? '' : 'ghost') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
        '<button class="btn small" id="newp" style="margin-left:auto">+ New project</button></div>' +
        '<form class="card edit" id="newform" hidden>' +
        '<label>Name<input name="name" required maxlength="200"></label>' +
        '<div class="grid2"><label>Venture<select name="venture">' +
        ['FLWR', 'MCRG', 'GZBO', 'ABNB', 'SHRD'].map(function (c) { return '<option value="' + c + '"' + (c === v.code ? ' selected' : '') + '>' + CODE_NAME[c] + '</option>'; }).join('') +
        '</select></label><label>Target date<input type="date" name="target"></label></div>' +
        '<button class="btn" type="submit">Create</button></form>' +
        (list.length ? list.map(function (p) {
          var pct = p.task_total ? Math.round(100 * p.task_done / p.task_total) : 0;
          return '<a class="card proj" href="#/p/' + encodeURIComponent(p.id) + '/' + v.slug + '">' +
            '<div class="row"><h3>' + esc(p.name) + '</h3><span class="pill ' + esc(p.status) + '">' + esc(p.status) + '</span></div>' +
            '<div class="task meta" style="border:0;padding:4px 0 0">' +
            (v.code === 'home' ? '<span class="pill v">' + esc(CODE_NAME[p.venture] || p.venture) + '</span> · ' : '') +
            p.task_done + ' of ' + p.task_total + ' done' + (p.task_blocked ? ' · ' + p.task_blocked + ' blocked' : '') +
            (p.target ? ' · Target ' + fmtDue(p.target, p.target_precision) : '') + '</div>' +
            '<div class="bar"><i style="width:' + pct + '%"></i></div></a>';
        }).join('') : '<p class="empty">No projects here yet.</p>');
      app.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { projFilter = b.getAttribute('data-f'); viewProjects(v); }; });
      var form = $('newform');
      $('newp').onclick = function () { form.hidden = !form.hidden; if (!form.hidden) form.name.focus(); };
      form.onsubmit = function (ev) {
        ev.preventDefault();
        api('/projects', { method: 'POST', body: { name: form.name.value, venture: form.venture.value, target: form.target.value || null, status: 'active' } })
          .then(function (r) { location.hash = '#/p/' + encodeURIComponent(r.id) + '/' + v.slug; })
          .catch(fail);
      };
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  /* ── Project detail ── */
  function viewProject(id, vslug) {
    app.innerHTML = '<p class="muted">Loading…</p>';
    api('/projects/' + encodeURIComponent(id)).then(function (d) {
      var p = d.project, byId = {};
      d.tasks.forEach(function (t) { byId[t.id] = t; });
      var done = d.tasks.filter(function (t) { return t.status === 'done'; }).length;
      var phases = d.phases.length ? d.phases : [{ id: '', name: 'Checklist' }];
      var loose = d.tasks.filter(function (t) { return !t.phase_id || !d.phases.some(function (ph) { return ph.id === t.phase_id; }); });
      app.innerHTML =
        '<a class="back" href="#/' + esc(vslug) + '/projects">← Projects</a>' +
        '<div class="card">' +
        '<div class="row" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h1>' + esc(p.name) + '</h1>' +
        '<select class="st" id="pstatus">' + ['planned', 'active', 'blocked', 'done'].map(function (s) { return '<option' + (s === p.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
        '<p class="sub"><span class="pill v">' + esc(CODE_NAME[p.venture] || p.venture) + '</span> · ' + done + ' of ' + d.tasks.length + ' done' +
        (p.target ? ' · Target ' + fmtDue(p.target, p.target_precision) : '') + '</p>' +
        (p.summary ? '<p class="summary">' + esc(p.summary) + '</p>' : '') +
        '<div class="bar"><i style="width:' + (d.tasks.length ? Math.round(100 * done / d.tasks.length) : 0) + '%"></i></div>' +
        '<div class="toolbar" style="margin-top:12px"><button class="btn small ghost" id="pedit">Edit project</button></div>' +
        '<form class="edit" id="pform" hidden>' +
        '<label>Name<input name="name" value="' + esc(p.name) + '" maxlength="200"></label>' +
        '<label>Target date<input type="date" name="target" value="' + esc(p.target || '') + '"></label>' +
        '<label>Notes<textarea name="summary" rows="4">' + esc(p.summary || '') + '</textarea></label>' +
        '<button class="btn" type="submit">Save</button></form></div>' +
        phases.map(function (ph) {
          var ts = d.tasks.filter(function (t) { return ph.id ? t.phase_id === ph.id : true; });
          return '<section class="card phase"><h3>' + esc(ph.name) + '</h3>' +
            (ts.length ? ts.map(function (t) { return taskRow(t, { editable: true }); }).join('') : '<div class="empty">No tasks yet.</div>') +
            '<form class="add" data-phase="' + esc(ph.id) + '"><input placeholder="Add a task" maxlength="300"><button class="btn small" type="submit">Add</button></form></section>';
        }).join('') +
        (loose.length && d.phases.length ? '<section class="card phase"><h3>Other</h3>' + loose.map(function (t) { return taskRow(t, { editable: true }); }).join('') + '</section>' : '') +
        '<div class="toolbar"><button class="btn small ghost" id="addphase">+ Add a phase</button></div>';

      var reload = function () { viewProject(id, vslug); };
      wireChecks(app, byId);
      $('pstatus').onchange = function () {
        api('/projects/' + encodeURIComponent(id), { method: 'PATCH', body: { status: this.value } }).then(function () { toast('Project updated.'); }).catch(fail);
      };
      var pform = $('pform');
      $('pedit').onclick = function () { pform.hidden = !pform.hidden; };
      pform.onsubmit = function (ev) {
        ev.preventDefault();
        api('/projects/' + encodeURIComponent(id), { method: 'PATCH', body: { name: pform.name.value, target: pform.target.value || null, summary: pform.summary.value } })
          .then(reload).catch(fail);
      };
      app.querySelectorAll('form.add').forEach(function (f) {
        f.onsubmit = function (ev) {
          ev.preventDefault();
          var title = f.querySelector('input').value.trim();
          if (!title) return;
          api('/tasks', { method: 'POST', body: { project_id: id, phase_id: f.getAttribute('data-phase') || null, title: title } }).then(reload).catch(fail);
        };
      });
      $('addphase').onclick = function () {
        var name = prompt('Phase name');
        if (name && name.trim()) api('/phases', { method: 'POST', body: { project_id: id, name: name.trim() } }).then(reload).catch(fail);
      };
      app.querySelectorAll('[data-edit]').forEach(function (el) {
        var open = function () {
          var row = el.closest('.task'), t = byId[row.getAttribute('data-id')], box = row.querySelector('.editor');
          if (box.innerHTML) { box.innerHTML = ''; return; }
          box.innerHTML = '<form class="edit">' +
            '<input name="title" value="' + esc(t.title) + '" maxlength="300">' +
            '<div class="grid2"><label>Status<select name="status">' +
            [['todo', 'To do'], ['doing', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']].map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === t.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') +
            '</select></label><label>Who<select name="owner"><option value="">Anyone</option>' +
            Object.keys(USERS).map(function (u) { return '<option value="' + u + '"' + (u === t.owner ? ' selected' : '') + '>' + USERS[u] + '</option>'; }).join('') +
            '</select></label></div>' +
            '<label>Due' + (t.due_precision === 'month' ? ' (month target: ' + fmtDue(t.due, 'month') + ')' : '') + '<input type="date" name="due" value="' + esc(t.due_precision === 'month' ? '' : (t.due || '')) + '"></label>' +
            '<label>Notes<textarea name="notes" rows="2">' + esc(t.notes || '') + '</textarea></label>' +
            '<div class="toolbar"><button class="btn small" type="submit">Save</button><button class="btn small ghost" type="button" data-del>Delete</button></div></form>';
          var f = box.querySelector('form');
          f.onsubmit = function (ev) {
            ev.preventDefault();
            var body = { title: f.title.value, status: f.status.value, owner: f.owner.value || null, notes: f.notes.value };
            if (f.due.value) { body.due = f.due.value; body.due_precision = 'day'; }
            api('/tasks/' + encodeURIComponent(t.id), { method: 'PATCH', body: body }).then(reload).catch(fail);
          };
          f.querySelector('[data-del]').onclick = function () {
            if (confirm('Delete this task?')) api('/tasks/' + encodeURIComponent(t.id), { method: 'DELETE' }).then(reload).catch(fail);
          };
        };
        el.onclick = open;
        el.onkeydown = function (ev) { if (ev.key === 'Enter') open(); };
      });
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }


  /* ── Build map (garden) and Setup map (greens) ── */
  var STAGE_FILL = [['#6f6a60', .82], ['#F2B5C4', .78], ['#F4B43C', .72], ['#8a6a48', .7], ['#1B6A8F', .5], ['#5E7D52', 0]];
  var MAPS = {
    garden: { title: 'Garden build', sub: 'Full Site Plan v4', img: '/queen/map.webp', box: [-44, -44, 170, 89], view: 'build', home: 'flowers', pad: 6, minW: 24, minH: 14, pinR: 1.6, font: 1.5, stroke: 0.25, pointR: 2,
      fill: STAGE_FILL, groups: [['t1', 'Tier 1: garage end'], ['t2', 'Tier 2: middle and pool'], ['gazebo', 'Tier 2: middle and pool'], ['t3', 'Tier 3: upper'], ['t4', 'Tier 4: front yard']] },
    greens: { title: 'Grow room setup', sub: 'Garage grow room layout, 30 x 27 ft. Rack 1 starts in the apartment', img: '/queen/greens-room.svg', box: [0, 0, 440, 500], crop: [32, 30, 376, 352], view: 'setup', home: 'greens', pad: 30, minW: 170, minH: 110, pinR: 8, font: 8, stroke: 1.2, pointR: 9,
      fill: [['#6f6a60', .5], ['#F2B5C4', .7], ['#F4B43C', .65], ['#1B6A8F', .45], ['#5E7D52', 0]], groups: [['garage', 'Grow room']] },
    gazebo: { title: 'Glass Gazebo build', sub: 'Blueprint sheet A-2, 14 x 12 ft, 18 salvaged windows', img: '/queen/gazebo-blueprint.svg?v=a2', box: [0, 0, 1400, 1020], crop: [60, 92, 1300, 760], view: 'setup', home: 'gazebo', pad: 60, minW: 420, minH: 260, pinR: 16, font: 15, stroke: 2.5, pointR: 18,
      fill: [['#9a958b', .6], ['#F4B43C', .6], ['#1B6A8F', .55], ['#5E7D52', 0]], groups: [['gazebo', 'Build steps'], ['t2', 'Around the gazebo']] },
    airbnb: { title: 'Units setup', sub: 'Unit A efficiency on the bottom level, Unit B on the two floors above, laundry in the connecting stairs. Room sizes are placeholders until measured', img: '/queen/airbnb-units.svg?v=2', box: [0, 0, 940, 960], crop: [40, 70, 860, 820], view: 'setup', home: 'airbnb', pad: 40, minW: 300, minH: 200, pinR: 14, font: 12, stroke: 2, pointR: 14,
      fill: [['#9a958b', .45], ['#F2B5C4', .6], ['#F4B43C', .55], ['#1B6A8F', .45], ['#5E7D52', 0]], groups: [['down', 'Unit A: bottom level'], ['up', 'Unit B: floors 2 and 3'], ['yard', 'Shared yard']] }
  };
  var mapMode = 'progress';
  function stFill(M, st) { return M.fill[Math.min(st || 0, M.fill.length - 1)]; }
  function isLast(M, st) { return (st || 0) === M.fill.length - 1; }

  function shapeSvg(M, s, mode, focus) {
    var g = s.geom, st = s.stage || 0, f = stFill(M, st), last = isLast(M, st);
    var fill = mode === 'plan' ? 'transparent' : f[0], op = mode === 'plan' ? 0 : f[1];
    var stroke = focus ? '#F4B43C' : (mode === 'plan' ? 'transparent' : (last ? '#5E7D52' : 'rgba(255,255,255,.6)'));
    var sw = focus ? M.stroke * 2.4 : M.stroke;
    var out = '<g class="sec" data-id="' + esc(s.id) + '">';
    (g.r || []).forEach(function (r) {
      out += '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + (r[2] - r[0]) + '" height="' + (r[3] - r[1]) + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    });
    if (g.f) {
      out += '<path d="' + g.f + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }
    if (g.d) {
      out += '<path d="' + g.d + '" fill="none" stroke="' + (mode === 'plan' ? 'transparent' : f[0]) + '" stroke-opacity="' + op + '" stroke-width="' + (g.w || 4) + '" stroke-linecap="round"/>';
      if (focus) out += '<path d="' + g.d + '" fill="none" stroke="#F4B43C" stroke-width="' + sw + '"/>';
      out += '<path d="' + g.d + '" fill="none" stroke="transparent" stroke-width="' + (g.w || 4) + '"/>';
    }
    (g.p || []).forEach(function (p) {
      out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + M.pointR + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    });
    return out + '</g>';
  }
  function pinSvg(M, s) {
    var st = s.stage || 0, c = isLast(M, st) ? '#5E7D52' : stFill(M, st)[0];
    if (st === 1 && c === '#F2B5C4') c = '#E07A95';
    var long = s.marker.length > 2, r = long ? M.pinR * 1.4 : M.pinR;
    return '<g class="sec" data-id="' + esc(s.id) + '"><circle cx="' + s.mx + '" cy="' + s.my + '" r="' + r + '" fill="' + c + '" stroke="#fff" stroke-width="' + (M.pinR * 0.22) + '"/>' +
      '<text x="' + s.mx + '" y="' + (s.my + M.font * 0.36) + '" font-size="' + (long ? M.font * 0.72 : M.font) + '" font-weight="700" fill="#fff" text-anchor="middle" font-family="DM Sans,Arial">' + esc(s.marker) + '</text>' +
      (s.working ? '<circle cx="' + s.mx + '" cy="' + s.my + '" r="' + (r * 1.4) + '" fill="none" stroke="#F4B43C" stroke-width="' + (M.pinR * 0.28) + '"/>' : '') + '</g>';
  }
  function bbox(g) {
    var xs = [], ys = [];
    (g.r || []).forEach(function (r) { xs.push(r[0], r[2]); ys.push(r[1], r[3]); });
    (g.p || []).forEach(function (p) { xs.push(p[0], p[0]); ys.push(p[1], p[1]); });
    [g.d, g.f].forEach(function (dd) { if (dd) { var n = dd.match(/-?[\d.]+/g).map(Number); for (var i = 0; i < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); } } });
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  }
  function mapSvg(M, sections, mode, focusId, vb) {
    var c = M.crop || M.box;
    return '<svg class="map" viewBox="' + (vb || c.join(' ')) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<image href="' + M.img + '" x="' + M.box[0] + '" y="' + M.box[1] + '" width="' + M.box[2] + '" height="' + M.box[3] + '" preserveAspectRatio="none"/>' +
      sections.map(function (s) { return shapeSvg(M, s, mode, s.id === focusId); }).join('') +
      (mode === 'progress' ? sections.map(function (s) { return pinSvg(M, s); }).join('') : '') + '</svg>';
  }
  function stageLabelClass(M, st) { return 'st' + (isLast(M, st) ? 5 : Math.min(st || 0, 4)); }

  function viewBuild(v, mapName) {
    var M = MAPS[mapName];
    app.innerHTML = '<p class="muted">Loading the map…</p>';
    api('/sections?map=' + mapName).then(function (d) {
      var secs = d.sections, stages = d.stages;
      var tally = stages.map(function (_, i) { return secs.filter(function (s) { return (s.stage || 0) === i; }).length; });
      var done = secs.reduce(function (a, s) { return a + (s.stage || 0); }, 0), max = secs.length * (stages.length - 1);
      var seen = {};
      app.innerHTML =
        '<h1>' + M.title + '</h1><p class="sub">' + M.sub + '. Tap a section to open it. ' + Math.round(100 * done / Math.max(max, 1)) + '% done.</p>' +
        '<div class="toolbar"><button class="btn small ' + (mapMode === 'progress' ? '' : 'ghost') + '" data-m="progress">Progress</button>' +
        '<button class="btn small ' + (mapMode === 'plan' ? '' : 'ghost') + '" data-m="plan">Plan</button></div>' +
        '<div class="legend">' + stages.map(function (n, i) {
          var f = stFill(M, i), last = isLast(M, i);
          return '<span><i style="background:' + (last ? 'transparent;border:2px solid #5E7D52' : f[0]) + '"></i>' + n + ' <b>' + tally[i] + '</b></span>';
        }).join('') + '</div>' +
        '<div class="mapwrap' + ((mapName === 'greens' || mapName === 'airbnb') ? ' room' : mapName === 'gazebo' ? ' gz' : '') + '">' + mapSvg(M, secs, mapMode) + '</div>' +
        M.groups.filter(function (gp) { if (seen[gp[1]]) return false; seen[gp[1]] = 1; return true; }).map(function (gp) {
          var list = secs.filter(function (s) { return M.groups.some(function (x) { return x[0] === s.area_id && x[1] === gp[1]; }); });
          if (!list.length) return '';
          return '<section><h2>' + gp[1] + '</h2><div class="card">' + list.map(function (s) {
            return '<a class="task" style="text-decoration:none;color:inherit" href="#/s/' + encodeURIComponent(s.id) + '/' + v.slug + '">' +
              '<span class="pin s' + (isLast(M, s.stage) ? 5 : Math.min(s.stage || 0, 4)) + '">' + esc(s.marker) + '</span><div class="body"><div class="title">' + esc(s.name) + (s.working ? ' <span class="pill doing">Working on it</span>' : '') + '</div>' +
              '<div class="meta"><span class="pill ' + stageLabelClass(M, s.stage) + '">' + esc(stages[s.stage || 0]) + '</span> · ' + s.open_tasks + ' open of ' + s.total_tasks + '</div></div></a>';
          }).join('') + '</div></section>';
        }).join('');
      app.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { mapMode = b.getAttribute('data-m'); viewBuild(v, mapName); }; });
      app.querySelectorAll('svg.map .sec').forEach(function (g) {
        g.style.cursor = 'pointer';
        g.onclick = function () { location.hash = '#/s/' + encodeURIComponent(g.getAttribute('data-id')) + '/' + v.slug; };
      });
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  function viewSection(id, vslug) {
    app.innerHTML = '<p class="muted">Loading…</p>';
    api('/sections/' + encodeURIComponent(id)).then(function (d) {
      var mapName = MAPS[d.section.map] ? d.section.map : 'garden', M = MAPS[mapName];
      return api('/sections?map=' + mapName).then(function (all) { return [d, all.sections, M]; });
    }).then(function (res) {
      var d = res[0], all = res[1], M = res[2], s = d.section, stages = d.stages, byId = {};
      d.tasks.forEach(function (t) { byId[t.id] = t; });
      var b = bbox(s.geom), pad = M.pad;
      var w = Math.max(b[2] - b[0] + pad * 2, M.minW), h = Math.max(b[3] - b[1] + pad * 2, M.minH);
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      var vb = (cx - w / 2) + ' ' + (cy - h / 2) + ' ' + w + ' ' + h;
      var st = s.stage || 0, grp = (M.groups.filter(function (x) { return x[0] === s.area_id; })[0] || [0, s.area_name || ''])[1];
      app.innerHTML =
        '<a class="back" href="#/' + esc(vslug) + '/' + M.view + '">← ' + M.title + '</a>' +
        '<div class="card">' +
        '<div style="display:flex;gap:12px;align-items:center"><span class="pin big s' + (isLast(M, st) ? 5 : Math.min(st, 4)) + '">' + esc(s.marker) + '</span><div><h1>' + esc(s.name) + '</h1>' +
        '<p class="sub">' + esc(grp) + '</p></div></div>' +
        '<div class="mapwrap close">' + mapSvg(M, all, 'progress', s.id, vb) + '</div>' +
        (s.plants_note ? '<p class="summary">' + esc(s.plants_note) + '</p>' : '') +
        '<h3 style="margin-top:14px">Stage</h3><div class="stepper n' + stages.length + '">' + stages.map(function (n, i) {
          return '<button type="button" data-st="' + i + '" class="' + (i === st ? 'on ' : '') + (i < st ? 'past' : '') + '">' + (i < st ? '✓ ' : '') + n + '</button>';
        }).join('') + '</div>' +
        '<label class="toggle"><input type="checkbox" id="working"' + (s.working ? ' checked' : '') + '> Working on this now (shows on Today)</label>' +
        '</div>' +
        '<section class="card phase"><h3>Checklist</h3>' +
        (d.tasks.length ? d.tasks.map(function (t) { return taskRow(t, {}); }).join('') : '<div class="empty">No tasks yet for this section.</div>') +
        '<form class="add" id="addtask"><input placeholder="Add a task for this section" maxlength="300"><button class="btn small" type="submit">Add</button></form></section>' +
        '<section class="card"><h3>Notes</h3><textarea id="snotes" rows="3" style="width:100%;margin-top:8px" placeholder="Measurements, what you found, what is next">' + esc(s.notes || '') + '</textarea>' +
        '<div class="toolbar"><button class="btn small" id="savenotes">Save notes</button></div></section>' +
        (d.history.length ? '<section class="card"><h3>History</h3>' + d.history.map(function (e) {
          return '<div class="task"><div class="body"><div class="title">' + esc(e.note) + '</div><div class="meta">' + esc(USERS[e.by_user] || e.by_user || '') + ' · ' + new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</div></div></div>';
        }).join('') + '</section>' : '');
      var reload = function () { viewSection(id, vslug); };
      wireChecks(app, byId);
      app.querySelectorAll('[data-st]').forEach(function (btn) {
        btn.onclick = function () {
          var n = +btn.getAttribute('data-st');
          api('/sections/' + encodeURIComponent(id), { method: 'PATCH', body: { stage: n } })
            .then(function () { toast(s.name + ': ' + stages[n]); reload(); }).catch(fail);
        };
      });
      $('working').onchange = function () {
        api('/sections/' + encodeURIComponent(id), { method: 'PATCH', body: { working: this.checked } }).then(function () { toast('Saved.'); }).catch(fail);
      };
      $('addtask').onsubmit = function (ev) {
        ev.preventDefault();
        var title = this.querySelector('input').value.trim(); if (!title) return;
        api('/tasks', { method: 'POST', body: { unit_id: id, title: title } }).then(reload).catch(fail);
      };
      $('savenotes').onclick = function () {
        api('/sections/' + encodeURIComponent(id), { method: 'PATCH', body: { notes: $('snotes').value } }).then(function () { toast('Notes saved.'); }).catch(fail);
      };
      app.querySelectorAll('svg.map .sec').forEach(function (g) {
        g.style.cursor = 'pointer';
        g.onclick = function () { var to = g.getAttribute('data-id'); if (to !== id) location.hash = '#/s/' + encodeURIComponent(to) + '/' + vslug; };
      });
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  /* ── Buy list ── */
  var PSTAT = { to_buy: 'To buy', ordered: 'Ordered', arrived: 'Arrived', skip: 'Skip' };
  var NEXT = { to_buy: 'ordered', ordered: 'arrived', arrived: 'to_buy', skip: 'to_buy' };
  function money(n) { return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function viewBuy(v) {
    app.innerHTML = '<p class="muted">Loading the buy list…</p>';
    api('/purchases?v=' + v.code).then(function (d) {
      var list = d.purchases, groups = {}, order = [];
      list.forEach(function (p) { var g = p.grp || 'Other'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(p); });
      order.sort();
      var line = function (p) { return (p.unit_price != null && p.qty != null) ? p.unit_price * p.qty : null; };
      var sum = function (arr, f) { return arr.reduce(function (a, p) { var l = line(p); return a + (l != null && f(p) ? l : 0); }, 0); };
      app.innerHTML = '<h1>' + (v.code === 'home' ? 'Everything to buy' : esc(v.name) + ': buy list') + '</h1>' +
        '<p class="sub">Tap the box to move an item: to buy, ordered, arrived. Prices marked Verified were checked online; re-check at checkout.</p>' +
        (list.length ? '' : '<p class="empty">Nothing on the list yet.</p>') +
        order.map(function (g) {
          var items = groups[g], vendors = {}, vo = [];
          items.forEach(function (p) { var k = p.vendor || 'Any'; if (!vendors[k]) { vendors[k] = []; vo.push(k); } vendors[k].push(p); });
          var total = sum(items, function () { return true; }), left = sum(items, function (p) { return p.status === 'to_buy'; });
          var unpriced = items.filter(function (p) { return line(p) == null; }).length;
          return '<section><h2>' + esc(g.replace(/^\d+\.\s*/, '')) + '</h2>' +
            '<div class="buysum"><span>Total <b>' + money(total) + '</b></span><span>Still to buy <b>' + money(left) + '</b></span>' + (unpriced ? '<span>' + unpriced + ' need a price</span>' : '') + '<span class="muted">before tax</span></div>' +
            vo.map(function (vn) {
              return '<div class="card"><h3>' + esc(vn) + '</h3>' + vendors[vn].map(function (p) {
                var l = line(p);
                return '<div class="task buy ' + p.status + '" data-id="' + esc(p.id) + '"><button class="chk b" type="button" aria-label="Change status"></button>' +
                  '<div class="body"><div class="title">' + (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(p.item) + '</a>' : esc(p.item)) + '</div>' +
                  '<div class="meta"><span class="pill ' + p.status + '">' + PSTAT[p.status] + '</span>' +
                  (p.qty != null ? ' · ' + p.qty + (p.unit_price != null ? ' × ' + money(p.unit_price) + ' = <b>' + money(l) + '</b>' : '') : '') +
                  (p.price_status ? ' · ' + esc(p.price_status) : '') + (p.why ? ' · ' + esc(p.why) : '') + '</div></div></div>';
              }).join('') + '</div>';
            }).join('') + '</section>';
        }).join('');
      var byId = {}; list.forEach(function (p) { byId[p.id] = p; });
      app.querySelectorAll('.task.buy .chk').forEach(function (b) {
        b.onclick = function () {
          var row = b.closest('.task'), p = byId[row.getAttribute('data-id')], next = NEXT[p.status] || 'ordered';
          api('/purchases/' + encodeURIComponent(p.id), { method: 'PATCH', body: { status: next } })
            .then(function () { toast(p.item.slice(0, 40) + ': ' + PSTAT[next]); viewBuy(v); }).catch(fail);
        };
      });
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  /* ── Accounts ── */
  var ASTAT = ['Not contacted', 'Called', 'Tasting dropped', 'Trial order', 'Weekly account', 'Not now'];
  function viewAccounts(v) {
    app.innerHTML = '<p class="muted">Loading accounts…</p>';
    api('/customers?v=' + v.code).then(function (d) {
      var list = d.customers, tiers = {}, order = [];
      list.forEach(function (c) { var t = c.tier || 'Other'; if (!tiers[t]) { tiers[t] = []; order.push(t); } tiers[t].push(c); });
      order.sort();
      var counts = ASTAT.map(function (s) { return list.filter(function (c) { return (c.status || 'Not contacted') === s; }).length; });
      app.innerHTML = '<h1>Accounts</h1><p class="sub">' + (v.code === 'GZBO' ? 'Photographer and creator targets. Parked until spring 2027.' : 'Restaurant targets from Google, Nov 10. Fit is a judgment, not confirmed with the business.') + '</p>' +
        '<div class="legend">' + ASTAT.map(function (s, i) { return '<span>' + s + ' <b>' + counts[i] + '</b></span>'; }).join('') + '</div>' +
        order.map(function (t) {
          return '<section><h2>' + esc(t.replace(/^\d+\s*/, '') + (t === '0 Warm' ? '' : ' fit')) + '</h2><div class="card">' + tiers[t].map(function (c) {
            return '<div class="task acct" data-id="' + esc(c.id) + '"><div class="body"><div class="title">' + esc(c.name) + (c.rating ? ' <span class="muted" style="font-weight:400">★ ' + c.rating + '</span>' : '') + '</div>' +
              '<div class="meta">' + (c.phone ? '<a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + esc(c.phone.replace('+1 ', '')) + '</a> · ' : '') + esc(c.address || '') + '</div>' +
              (c.notes ? '<div class="meta">' + esc(c.notes) + '</div>' : '') +
              '<div class="acct-edit"><select data-k="status">' + ASTAT.map(function (s) { return '<option' + (s === (c.status || 'Not contacted') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
              '<input data-k="next_step" value="' + esc(c.next_step || '') + '" placeholder="Next step"></div></div></div>';
          }).join('') + '</div></section>';
        }).join('');
      app.querySelectorAll('.task.acct').forEach(function (row) {
        var id = row.getAttribute('data-id');
        row.querySelectorAll('[data-k]').forEach(function (el) {
          el.onchange = function () {
            var body = {}; body[el.getAttribute('data-k')] = el.value;
            api('/customers/' + encodeURIComponent(id), { method: 'PATCH', body: body }).then(function () { toast('Saved.'); }).catch(fail);
          };
        });
      });
    }).catch(function (e) { if (e.message !== 'locked') app.innerHTML = '<p class="muted">Could not load: ' + esc(e.message) + '</p>'; });
  }

  /* ── not built yet ── */
  function viewSoon(v, view) {
    var what = view === 'calendar'
      ? 'One timeline for bookings, shoots, harvests, deliveries and build work, with conflicts flagged. Airbnb calendars sync in here.'
      : 'Income and costs for each venture, margin per tray, bed and booking, and the barter log.';
    app.innerHTML = '<div class="card soon-card"><h3>' + (view === 'calendar' ? 'Calendar' : 'Money') + ' is next</h3><p class="muted">' + what + '</p></div>';
  }

  /* ── boot ── */
  function boot() {
    if (!boot.wired) { window.addEventListener('hashchange', route); boot.wired = true; }
    if (!location.hash) location.hash = '#/home/today'; else route();
  }
  boot();
})();
