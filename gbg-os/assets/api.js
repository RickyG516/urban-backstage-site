/* GBG OS live data. Talks to the gbg-os-api Worker. No secrets here:
   the per-user key comes back from /pin and lives in this browser only. */
(function () {
  var API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://gbg-os-api.ricky-a17.workers.dev';
  var LS_KEY = 'gbg_key', LS_USER = 'gbg_user';
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    catch (e) { return ''; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function api(path, opts) {
    opts = opts || {};
    var h = { 'x-gbg-key': ls(LS_KEY), 'x-gbg-user': ls(LS_USER) };
    if (opts.body) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opts.method || 'GET', headers: h, cache: 'no-store',
      body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        if (r.status === 401) { ls(LS_KEY, null); lock(); throw new Error('locked'); }
        return r.json();
      }).then(function (d) { if (!d.ok) throw new Error(d.error || 'failed'); return d; });
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  /* lock screen */
  function lock() {
    if (document.querySelector('.lock')) return;
    var who = ls(LS_USER) || 'ricky';
    var el = document.createElement('div'); el.className = 'lock';
    el.innerHTML = '<form class="lock-card"><div class="lock-logo">GBG <span>OS</span></div>' +
      '<p>Pick your name and enter your PIN. This device stays unlocked after.</p>' +
      '<div class="who"><label><input type="radio" name="u" value="ricky"' + (who === 'ricky' ? ' checked' : '') + '> Ricky</label>' +
      '<label><input type="radio" name="u" value="doug"' + (who === 'doug' ? ' checked' : '') + '> Doug</label></div>' +
      '<input class="pin" name="pin" type="password" autocomplete="current-password" placeholder="PIN" required>' +
      '<button type="submit">Unlock</button><div class="err"></div></form>';
    document.body.appendChild(el);
    var f = el.querySelector('form');
    f.pin.focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = f.querySelector('input[name=u]:checked').value;
      f.querySelector('button').disabled = true; f.querySelector('.err').textContent = '';
      fetch(API + '/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u, pin: f.pin.value }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) throw new Error('Wrong PIN');
          ls(LS_KEY, d.key); ls(LS_USER, d.user); location.reload();
        })
        .catch(function (err) { f.querySelector('.err').textContent = err.message === 'Wrong PIN' ? 'Wrong PIN. Try again.' : 'Could not reach the server.'; f.querySelector('button').disabled = false; f.pin.value = ''; f.pin.focus(); });
    });
  }

  var NAME = { ricky: 'Ricky', doug: 'Doug', both: 'Both' };
  var STAGE = { lead: 'Lead', consult: 'Consult', estimate: 'Estimate sent', booked: 'Booked', done: 'Done', review: 'Review asked', lost: 'Lost' };
  function fmt(d) { if (!d) return 'No date'; var x = new Date(d + 'T12:00:00'); return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }

  /* ---------- task list ---------- */
  function taskRow(t, today) {
    var late = t.status === 'open' && t.due && t.due < today;
    return '<li class="task' + (t.status === 'done' ? ' done' : '') + (late ? ' late' : '') + '" data-id="' + t.id + '">' +
      '<button class="tick" title="Mark done" aria-label="Mark done"></button>' +
      '<div class="tbody"><div class="ttl">' + esc(t.title) + '</div><div class="tmeta">' +
      '<span class="who ' + esc(t.owner) + '">' + NAME[t.owner] + '</span>' +
      '<span class="due">' + (late ? 'Overdue, ' : '') + fmt(t.due) + '</span>' +
      (t.area ? '<span class="area">' + esc(t.area) + '</span>' : '') +
      (t.key_date ? '<span class="key">Key date</span>' : '') + '</div></div></li>';
  }
  function bindTicks(root, reload) {
    root.querySelectorAll('.task .tick').forEach(function (b) {
      b.addEventListener('click', function () {
        var li = b.closest('.task'), done = li.classList.contains('done');
        li.classList.toggle('done');
        api('/tasks/' + li.dataset.id, { method: 'PATCH', body: { status: done ? 'open' : 'done' } })
          .then(function () { toast(done ? 'Reopened' : 'Done'); if (reload) reload(); })
          .catch(function (e) { li.classList.toggle('done'); if (e.message !== 'locked') toast('Could not save'); });
      });
    });
  }

  function renderTasks(el) {
    var owner = el.dataset.owner || 'mine', status = el.dataset.status || 'open';
    var me = ls(LS_USER);
    var q = '/tasks?status=' + status + (owner === 'mine' ? '&owner=' + me : owner !== 'all' ? '&owner=' + owner : '');
    el.innerHTML = '<p class="loading">Loading…</p>';
    api(q).then(function (d) {
      var T = d.tasks, today = d.today, wk = new Date(new Date(today + 'T12:00:00').getTime() + 7 * 864e5).toISOString().slice(0, 10);
      if (status === 'done') {
        el.innerHTML = T.length ? '<ul class="tasks">' + T.map(function (t) { return taskRow(t, today); }).join('') + '</ul>' : '<p class="loading">Nothing done yet.</p>';
        bindTicks(el, function () { renderTasks(el); }); return;
      }
      var groups = [['Overdue', function (t) { return t.due && t.due < today; }],
        ['This week', function (t) { return t.due && t.due >= today && t.due <= wk; }],
        ['Next 30 days', function (t) { return t.due && t.due > wk && daysBetween(today, t.due) <= 30; }],
        ['Later', function (t) { return !t.due || daysBetween(today, t.due) > 30; }]];
      var used = {}, html = '';
      if (el.dataset.short) groups = groups.slice(0, 2);
      groups.forEach(function (g) {
        var rows = T.filter(function (t) { if (used[t.id]) return false; if (g[1](t)) { used[t.id] = 1; return true; } return false; });
        if (!rows.length) return;
        html += '<div class="tgroup' + (g[0] === 'Overdue' ? ' over' : '') + '"><h4>' + g[0] + ' <b>' + rows.length + '</b></h4><ul class="tasks">' +
          rows.map(function (t) { return taskRow(t, today); }).join('') + '</ul></div>';
      });
      el.innerHTML = html || '<p class="loading">' + (el.dataset.short ? 'Nothing due this week.' : 'Nothing open. Nice.') + '</p>';
      bindTicks(el, null);
    }).catch(function (e) { if (e.message !== 'locked') el.innerHTML = '<p class="loading">Could not load tasks.</p>'; });
  }

  /* ---------- hub ---------- */
  function renderHub() {
    var box = document.querySelector('[data-live=hub]'); if (!box) return;
    api('/summary').then(function (d) {
      var mine = 0; d.open.forEach(function (o) { if (o.owner === d.user || o.owner === 'both') mine += o.n; });
      var total = 0; d.open.forEach(function (o) { total += o.n; });
      var jobs = 0, booked = 0; d.stages.forEach(function (s) { if (s.stage !== 'lost') jobs += s.n; if (s.stage === 'booked') booked = s.n; });
      set('open', total); set('mine', mine); set('overdue', d.overdue); set('week', d.this_week); set('jobs', jobs); set('booked', booked); set('done', d.done);
      var od = document.querySelector('[data-k=overdue]'); if (od) od.classList.toggle('bad', d.overdue > 0);
      var kd = document.querySelector('[data-live=keydates]');
      if (kd) kd.innerHTML = d.key_dates.map(function (t) { return '<li><span>' + fmt(t.due) + '</span>' + esc(t.title) + '</li>'; }).join('') || '<li>None open</li>';
      var ra = document.querySelector('[data-live=recent]');
      if (ra) ra.innerHTML = d.recent.map(function (a) {
        return '<li><span>' + esc(NAME[a.who] || a.who) + '</span>' + esc(a.kind.replace('_', ' ')) + (a.note ? ': ' + esc(a.note) : '') + '</li>';
      }).join('');
      var hi = document.querySelector('[data-live=hello]'); if (hi) hi.textContent = 'Signed in as ' + NAME[d.user];
    }).catch(function () {});
    function set(k, v) { var e = document.querySelector('[data-k=' + k + ']'); if (e) e.textContent = v; }
  }

  /* ---------- jobs board ---------- */
  function renderJobs() {
    var board = document.querySelector('[data-live=board]'); if (!board) return;
    api('/jobs').then(function (d) {
      var order = ['lead', 'consult', 'estimate', 'booked', 'done', 'review'];
      board.innerHTML = order.map(function (st, i) {
        var J = d.jobs.filter(function (j) { return j.stage === st; });
        return '<div class="col"><h4>' + STAGE[st] + '<b>' + J.length + '</b></h4>' +
          (J.length ? J.map(function (j) {
            return '<div class="job" data-id="' + j.id + '"><div class="jn">' + esc(j.name || 'No name') + '</div>' +
              '<div class="js">' + esc(j.service || 'Service not set') + (j.partner ? ' &middot; to ' + esc(j.partner) : '') + '</div>' +
              (j.phone ? '<a class="jp" href="tel:' + esc(j.phone) + '">' + esc(j.phone) + '</a>' : '') +
              '<div class="jm">' + (i > 0 ? '<button data-to="' + order[i - 1] + '">&larr;</button>' : '') +
              (i < order.length - 1 ? '<button data-to="' + order[i + 1] + '">' + STAGE[order[i + 1]] + ' &rarr;</button>' : '') +
              '<button data-to="lost" class="lost">Lost</button></div></div>';
          }).join('') : '<div class="empty">None</div>') + '</div>';
      }).join('');
      board.querySelectorAll('.job button').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.closest('.job').dataset.id;
          api('/jobs/' + id, { method: 'PATCH', body: { stage: b.dataset.to } })
            .then(function () { toast('Moved to ' + STAGE[b.dataset.to]); renderJobs(); })
            .catch(function () { toast('Could not save'); });
        });
      });
    }).catch(function () {});
  }

  function bindForms() {
    var lf = document.querySelector('form[data-form=lead]');
    if (lf) lf.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = {}; new FormData(lf).forEach(function (v, k) { b[k] = v; });
      api('/jobs', { method: 'POST', body: b }).then(function () { lf.reset(); toast('Lead added'); renderJobs(); })
        .catch(function (err) { toast(err.message === 'name required' ? 'Name is required' : 'Could not save'); });
    });
    var tf = document.querySelector('form[data-form=task]');
    if (tf) tf.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = {}; new FormData(tf).forEach(function (v, k) { b[k] = v; });
      api('/tasks', { method: 'POST', body: b }).then(function () { tf.reset(); toast('Task added'); document.querySelectorAll('[data-live=tasks]').forEach(renderTasks); })
        .catch(function () { toast('Could not save'); });
    });
    document.querySelectorAll('[data-filter]').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        bar.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
        var el = document.querySelector('[data-live=tasks]');
        if (b.dataset.owner) el.dataset.owner = b.dataset.owner;
        if (b.dataset.status) { el.dataset.status = b.dataset.status; }
        renderTasks(el);
      });
    });
    var out = document.querySelector('[data-signout]');
    if (out) out.addEventListener('click', function () { ls(LS_KEY, null); location.reload(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!ls(LS_KEY)) { lock(); return; }
    renderHub(); renderJobs();
    document.querySelectorAll('[data-live=tasks]').forEach(renderTasks);
    bindForms();
  });
})();
