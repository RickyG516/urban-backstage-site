/* Task board: pulls open tasks from UNC (HubSpot via the Sales OS Worker), GBG OS and
   Petrushka's OS, color codes them, and closes them back in their home system.
   No keys in this file: each system's key is already in this browser's localStorage
   from signing in to that system. Mount: <div id="board" data-sources="unc,gbg,pet"></div> */
(function () {
  var SRC = {
    unc: { name: 'UNC', base: 'https://unc-sales-os-sync.ricky-a17.workers.dev', key: 'unc_worker_key', login: '/sales-ops/settings/',
      hdr: function (k) { return { 'x-unc-key': k }; },
      list: function (st) { return '/tasks?status=' + st; },
      set: function (t, done) { return ['/tasks/' + t.id, 'POST', { status: done ? 'done' : 'open' }]; } },
    os: { name: 'UNC business', base: 'https://unc-sales-os-sync.ricky-a17.workers.dev', key: 'unc_worker_key', login: '/sales-ops/settings/',
      hdr: function (k) { return { 'x-unc-key': k }; },
      list: function (st) { return '/os/tasks?status=' + st; },
      set: function (t, done) { return ['/os/tasks/' + t.id, 'POST', { status: done ? 'done' : 'open' }]; } },
    gbg: { name: 'GBG', base: 'https://gbg-os-api.ricky-a17.workers.dev', key: 'gbg_key', user: 'gbg_user', login: '/gbg-os/',
      hdr: function (k, u) { return { 'x-gbg-key': k, 'x-gbg-user': u }; },
      list: function (st, u) { return '/tasks?status=' + st + '&owner=' + (u || 'ricky'); },
      set: function (t, done) { return ['/tasks/' + t.id, 'PATCH', { status: done ? 'done' : 'open' }]; } },
    pet: { name: "Petrushka's", base: 'https://queen-os-api.ricky-a17.workers.dev', key: 'queen_key', user: 'queen_user', login: '/queen/',
      hdr: function (k, u) { return { 'x-queen-key': k, 'x-queen-user': u || 'ricky' }; },
      list: function (st) { return '/tasks?status=' + st; },
      set: function (t, done) { return ['/tasks/' + encodeURIComponent(t.id), 'PATCH', { status: done ? 'done' : 'todo' }]; } }
  };
  var LANES = {
    UNC: { name: 'UNC clients', color: '#e36b1e' }, UNCB: { name: 'UNC business', color: '#f0a875' }, GBG: { name: 'GBG', color: '#5b8bd0' },
    FLWR: { name: 'Flowers', color: '#d9779a' }, MCRG: { name: 'Greens', color: '#6fae5c' },
    GZBO: { name: 'Gazebo', color: '#c9a227' }, ABNB: { name: 'Airbnb', color: '#2f8fbf' }, SHRD: { name: "Petrushka's", color: '#9a958b' }
  };
  var PET_LINK = { FLWR: 'flowers', MCRG: 'greens', GZBO: 'gazebo', ABNB: 'airbnb', SHRD: 'home' };

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function req(src, path, method, body) {
    var h = src.hdr(ls(src.key), ls(src.user || ''));
    if (body) h['Content-Type'] = 'application/json';
    return fetch(src.base + path, { method: method || 'GET', headers: h, cache: 'no-store', body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (r.status === 401) throw new Error('locked'); return r.json(); })
      .then(function (d) { if (!d.ok) throw new Error(d.error || 'failed'); return d; });
  }
  function todayCT() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); }
  function addDays(d, n) { return new Date(new Date(d + 'T12:00:00').getTime() + n * 864e5).toISOString().slice(0, 10); }
  function effDue(t) {
    if (!t.due) return null;
    if (t.due_precision !== 'month') return t.due.slice(0, 10);
    var d = new Date(t.due.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10);
  }
  function fmt(d, prec) {
    if (!d) return '';
    var x = new Date(d.slice(0, 10) + 'T12:00:00');
    return prec === 'month' ? x.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function toast(msg, undo) {
    document.querySelectorAll('.tb-toast').forEach(function (x) { x.remove(); });
    var t = document.createElement('div'); t.className = 'tb-toast'; t.textContent = msg;
    if (undo) { var b = document.createElement('button'); b.textContent = 'Undo'; b.onclick = function () { t.remove(); undo(); }; t.appendChild(b); }
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, undo ? 6500 : 2600);
  }

  var root, sources, status = 'open', items = [], errors = {}, off = {}, petProjects = [];
  try { off = JSON.parse(ls('tb_off') || '{}'); } catch (e) { off = {}; }

  function normalize(s, t) {
    if (s === 'unc') return { src: s, lane: 'UNC', id: t.id, title: t.title, due: t.due, prec: 'day', done: t.status === 'done', where: 'HubSpot', link: t.link, raw: t };
    if (s === 'os') return { src: s, lane: 'UNCB', id: t.id, title: t.title, due: t.due, prec: 'day', done: t.status === 'done', where: t.area || '', link: '/tasks/unc/#' + (t.area || ''), raw: t };
    if (s === 'gbg') return { src: s, lane: 'GBG', id: t.id, title: t.title, due: t.due, prec: 'day', done: t.status === 'done', where: (t.area || '') + (t.owner === 'both' ? ' · both' : ''), link: '/gbg-os/tasks/', raw: t };
    var lane = LANES[t.venture] ? t.venture : 'SHRD';
    var link = '/queen/#/' + (t.unit_id ? 's/' + encodeURIComponent(t.unit_id) + '/' + (PET_LINK[lane] || 'home') : 'p/' + encodeURIComponent(t.project_id) + '/' + (PET_LINK[lane] || 'home'));
    return { src: s, lane: lane, id: t.id, title: t.title, due: t.due, prec: t.due_precision, done: t.status === 'done', where: (t.unit_name ? t.unit_name + ' · ' : '') + (t.project_name || ''), link: link, raw: t };
  }

  function load() {
    root.innerHTML = '<p class="tb-muted">Loading…</p>';
    items = []; errors = {};
    var jobs = sources.map(function (s) {
      var src = SRC[s];
      if (!ls(src.key)) { errors[s] = 'nokey'; return Promise.resolve(); }
      return req(src, src.list(status, ls(src.user || ''))).then(function (d) {
        (d.tasks || []).forEach(function (t) {
          if (s === 'pet' && t.owner && t.owner !== 'ricky') return;
          items.push(normalize(s, t));
        });
      }).catch(function (e) { errors[s] = e.message === 'locked' ? 'nokey' : 'down'; });
    });
    if (sources.indexOf('pet') >= 0 && ls(SRC.pet.key)) jobs.push(req(SRC.pet, '/projects').then(function (d) { petProjects = (d.projects || []).filter(function (p) { return p.status !== 'done'; }); }).catch(function () {}));
    Promise.all(jobs).then(render);
  }

  function render() {
    var today = todayCT(), wk = addDays(today, 7), m30 = addDays(today, 30);
    var lanesHere = {}; items.forEach(function (i) { lanesHere[i.lane] = (lanesHere[i.lane] || 0) + 1; });
    var vis = items.filter(function (i) { return !off[i.lane]; });
    vis.sort(function (a, b) { var x = ed(a) || '9999', y = ed(b) || '9999'; return x < y ? -1 : x > y ? 1 : a.lane < b.lane ? -1 : 1; });
    function ed(i) { return effDue({ due: i.due, due_precision: i.prec }); }
    var groups = status === 'done' ? [['Closed in the last 30 days', function () { return true; }]] : [
      ['Overdue', function (i) { var e = ed(i); return e && e < today; }],
      ['Today', function (i) { return ed(i) === today; }],
      ['This week', function (i) { var e = ed(i); return e && e > today && e <= wk; }],
      ['Next 30 days', function (i) { var e = ed(i); return e && e > wk && e <= m30; }],
      ['Later', function (i) { var e = ed(i); return e && e > m30; }],
      ['No date yet', function (i) { return !i.due; }]];
    var over = vis.filter(function (i) { var e = ed(i); return status === 'open' && e && e < today; }).length;
    var wkN = vis.filter(function (i) { var e = ed(i); return status === 'open' && e && e >= today && e <= wk; }).length;
    var html = '<div class="tb-stats"><div><b>' + vis.length + '</b><span>' + (status === 'open' ? 'open' : 'closed') + '</span></div>' +
      (status === 'open' ? '<div class="' + (over ? 'bad' : '') + '"><b>' + over + '</b><span>overdue</span></div><div><b>' + wkN + '</b><span>due this week</span></div>' : '') + '</div>';
    html += '<div class="tb-bar"><button data-st="open" class="' + (status === 'open' ? 'on' : '') + '">Open</button><button data-st="done" class="' + (status === 'done' ? 'on' : '') + '">Closed</button><span class="tb-sep"></span>' +
      Object.keys(LANES).filter(function (l) { return lanesHere[l]; }).map(function (l) {
        return '<button class="tb-chip' + (off[l] ? ' off' : '') + '" data-lane="' + l + '" style="--c:' + LANES[l].color + '"><i></i>' + esc(LANES[l].name) + ' <b>' + lanesHere[l] + '</b></button>';
      }).join('') + '</div>';
    var errs = Object.keys(errors).map(function (s) {
      return '<p class="tb-err">' + esc(SRC[s].name) + ': ' + (errors[s] === 'nokey' ? 'not signed in on this device. <a href="' + SRC[s].login + '">Sign in</a>, then come back.' : 'could not load right now.') + '</p>';
    }).join('');
    html += errs;
    var used = {};
    groups.forEach(function (g) {
      var rows = vis.filter(function (i) { var k = i.src + i.id; if (used[k]) return false; if (g[1](i)) { used[k] = 1; return true; } return false; });
      if (!rows.length) return;
      html += '<section class="tb-group' + (g[0] === 'Overdue' ? ' over' : '') + '"><h3>' + g[0] + ' <b>' + rows.length + '</b></h3>' + rows.map(function (i) {
        var e = ed(i), late = status === 'open' && e && e < today;
        return '<div class="tb-task' + (i.done ? ' done' : '') + '" style="--c:' + LANES[i.lane].color + '" data-k="' + esc(i.src + '|' + i.id) + '">' +
          '<button class="tb-chk" aria-label="Done"></button><div class="tb-body"><a class="tb-title" href="' + esc(i.link) + '"' + (i.src === 'unc' ? ' target="_blank" rel="noopener"' : '') + '>' + esc(i.title) + '</a>' +
          '<div class="tb-meta"><span class="tb-lane">' + esc(LANES[i.lane].name) + '</span>' + (i.where ? ' · ' + esc(i.where) : '') +
          (i.due ? ' · <span class="' + (late ? 'late' : '') + '">' + (late ? 'Late, ' : '') + fmt(i.due, i.prec) + '</span>' : '') + '</div></div></div>';
      }).join('') + '</section>';
    });
    if (!vis.length) html += '<p class="tb-muted">' + (status === 'open' ? 'Nothing open. Go get one more client.' : 'Nothing closed in the last 30 days.') + '</p>';
    html += addForm();
    root.innerHTML = html;
    wire();
  }

  function addForm() {
    var opts = [];
    if (sources.indexOf('unc') >= 0 && ls(SRC.unc.key)) opts.push('<option value="unc|">UNC client (HubSpot)</option>');
    if (sources.indexOf('os') >= 0 && ls(SRC.os.key)) opts.push('<option value="os|">UNC business</option>');
    if (sources.indexOf('gbg') >= 0 && ls(SRC.gbg.key)) opts.push('<option value="gbg|">GBG</option>');
    petProjects.forEach(function (p) { opts.push('<option value="pet|' + esc(p.id) + '">' + esc((LANES[p.venture] || {}).name || "Petrushka's") + ': ' + esc(p.name) + '</option>'); });
    if (!opts.length) return '';
    return '<form class="tb-add"><input name="title" placeholder="Add a task" required maxlength="250"><select name="dest">' + opts.join('') + '</select><input name="due" type="date"><button type="submit">Add</button></form>';
  }

  function wire() {
    root.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { status = b.getAttribute('data-st'); load(); }; });
    root.querySelectorAll('[data-lane]').forEach(function (b) {
      b.onclick = function () { var l = b.getAttribute('data-lane'); off[l] = !off[l]; if (!off[l]) delete off[l]; ls('tb_off', JSON.stringify(off)); render(); };
    });
    root.querySelectorAll('.tb-chk').forEach(function (b) {
      b.onclick = function () {
        var row = b.closest('.tb-task'), k = row.getAttribute('data-k').split('|'), s = k[0], id = k.slice(1).join('|');
        var it = items.filter(function (i) { return i.src === s && String(i.id) === id; })[0]; if (!it) return;
        var done = !it.done, c = SRC[s].set(it, done);
        row.classList.toggle('done', done);
        req(SRC[s], c[0], c[1], c[2]).then(function () {
          it.done = done;
          toast(done ? 'Done. Stack it.' : 'Reopened', done ? function () { var u = SRC[s].set(it, false); req(SRC[s], u[0], u[1], u[2]).then(function () { it.done = false; row.classList.remove('done'); toast('Reopened'); }); } : null);
        }).catch(function () { row.classList.toggle('done', it.done); toast('Could not save'); });
      };
    });
    var f = root.querySelector('.tb-add');
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var d = f.dest.value.split('|'), s = d[0], body = { title: f.title.value.trim() };
      if (f.due.value) body.due = f.due.value;
      if (s === 'gbg') body.owner = ls('gbg_user') || 'ricky';
      if (s === 'pet') body.project_id = d[1];
      req(SRC[s], '/tasks', 'POST', body).then(function () { toast('Added'); load(); }).catch(function () { toast('Could not add'); });
    };
  }

  function boot() {
    root = document.getElementById('board'); if (!root) return;
    sources = (root.getAttribute('data-sources') || 'unc,os,gbg,pet').split(',');
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
