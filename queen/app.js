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
      return '<a href="#/' + v.slug + '/' + (route.project ? 'projects' : view) + '"' + (v.slug === vs ? ' class="on"' : '') + '>' + esc(v.name) + (n ? '<span class="n">' + n + '</span>' : '') + '</a>';
    }).join('');
    $('views').innerHTML = VIEWS.map(function (w) {
      return '<a href="#/' + vs + '/' + w.slug + '"' + (!route.project && w.slug === view ? ' class="on"' : '') + '>' + w.name + '</a>';
    }).join('');
  }

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'p' && h[1]) return { project: decodeURIComponent(h[1]), v: h[2] || 'home' };
    var v = ventureBySlug(h[0]) ? h[0] : 'home';
    var view = ['today', 'projects', 'calendar', 'money'].indexOf(h[1]) >= 0 ? h[1] : 'today';
    return { v: v, view: view };
  }

  function route() {
    if (!ls(LS_KEY)) { showLock(); return; }
    var r = parseRoute();
    renderChrome(r);
    window.scrollTo(0, 0);
    if (r.project) return viewProject(r.project, r.v);
    var v = ventureBySlug(r.v);
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
