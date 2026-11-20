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

  function toast(msg, undo) {
    document.querySelectorAll('.toast').forEach(function (x) { x.remove(); });
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    if (undo) {
      var b = document.createElement('button'); b.className = 'undo'; b.textContent = 'Undo';
      b.onclick = function () { t.remove(); undo(); }; t.appendChild(b);
    }
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, undo ? 6500 : 2600);
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
      (t.key_date ? '<span class="key">Key date</span>' : '') +
      (t.status === 'done' && t.done_at ? '<span class="closed">Closed by ' + esc(NAME[t.done_by] || t.done_by || '?') + ', ' + stamp(t.done_at) + '</span>' : '') +
      '</div></div></li>';
  }
  function stamp(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function setStatus(id, st) { return api('/tasks/' + id, { method: 'PATCH', body: { status: st } }); }
  function refreshTaskViews() { document.querySelectorAll('[data-live=tasks]').forEach(renderTasks); renderClosed(); renderHub(); }
  function bindTicks(root, reload) {
    root.querySelectorAll('.task .tick').forEach(function (b) {
      b.addEventListener('click', function () {
        var li = b.closest('.task'), done = li.classList.contains('done');
        li.classList.toggle('done');
        var id = li.dataset.id;
        setStatus(id, done ? 'open' : 'done')
          .then(function () {
            if (done) { toast('Reopened'); }
            else toast('Done', function () { setStatus(id, 'open').then(function () { toast('Reopened'); refreshTaskViews(); }); });
            if (reload) reload(); else renderClosed();
          })
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
      var T = d.tasks; T.forEach(function (t) { TASKS[t.id] = t; }); var today = d.today, wk = new Date(new Date(today + 'T12:00:00').getTime() + 7 * 864e5).toISOString().slice(0, 10);
      if (status === 'done') {
        var cut = Date.now() - 30 * 864e5;
        T = T.filter(function (t) { return t.done_at && new Date(t.done_at).getTime() >= cut; });
        el.innerHTML = T.length ? '<p class="hint2">Closed in the last 30 days, newest first. Tap the green box to reopen.</p><ul class="tasks">' + T.map(function (t) { return taskRow(t, today); }).join('') + '</ul>' : '<p class="loading">Nothing closed in the last 30 days.</p>';
        bindTicks(el, function () { renderTasks(el); }); bindTaskOpen(el); return;
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
      bindTicks(el, null); bindTaskOpen(el);
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

  function renderClosed() {
    var el = document.querySelector('[data-live=closed]'); if (!el) return;
    api('/tasks?status=done').then(function (d) {
      var T = d.tasks.slice(0, 5); T.forEach(function (t) { TASKS[t.id] = t; });
      el.innerHTML = T.length ? '<ul class="tasks">' + T.map(function (t) { return taskRow(t, d.today); }).join('') + '</ul>' : '<p class="loading">Nothing closed yet.</p>';
      bindTicks(el, function () { refreshTaskViews(); }); bindTaskOpen(el);
    }).catch(function () {});
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
      board.querySelectorAll('.job').forEach(function (card) {
        card.addEventListener('click', function (e) { if (e.target.closest('button,a')) return; openJob(+card.dataset.id); });
      });
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

  /* ---------- drawers: job, contact, task ---------- */
  var TASKS = {};
  var SERVICES = ['Permanent lights', 'Driveway sealing', 'Yard spraying', 'Trash can cleaning', 'Epoxy', 'Junk removal', 'Painting (partner)', 'Landscaping (partner)', 'Tree work (partner)'];
  var PARTNERS = ['', 'Fuehrer Painting', 'New View Landscaping', 'Kutsch Tree Service'];
  function opt(list, cur, labels) { return list.map(function (v, i) { return '<option value="' + esc(v) + '"' + (v === (cur || '') ? ' selected' : '') + '>' + esc(labels ? labels[i] : (v || 'None')) + '</option>'; }).join(''); }
  function fld(label, html) { return '<label class="f"><span>' + label + '</span>' + html + '</label>'; }
  function inp(name, val, type) { return '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '">'; }
  function when(a) { var d = new Date((a || '').replace(' ', 'T') + (a && a.length <= 19 ? 'Z' : '')); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function timeline(A) {
    if (!A || !A.length) return '<p class="loading">No history yet.</p>';
    return '<ul class="tl">' + A.map(function (a) {
      return '<li class="' + (a.kind === 'note' ? 'nt' : '') + '"><div class="tlh"><b>' + esc(NAME[a.who] || a.who) + '</b> ' +
        esc(a.kind === 'note' ? 'added a note' : a.kind.replace('_', ' ')) + '<span>' + when(a.at) + '</span></div>' +
        (a.note ? '<div class="tlb">' + esc(a.note) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function drawer(title, html, onClose) {
    var old = document.querySelector('.drawer-wrap'); if (old) old.remove();
    var w = document.createElement('div'); w.className = 'drawer-wrap';
    w.innerHTML = '<div class="drawer-bg"></div><aside class="drawer"><div class="dh"><h2>' + title + '</h2><button class="dx" aria-label="Close">&times;</button></div><div class="db">' + html + '</div></aside>';
    document.body.appendChild(w);
    function close() { w.remove(); if (onClose) onClose(); }
    w.querySelector('.dx').onclick = close; w.querySelector('.drawer-bg').onclick = close;
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', k); close(); } });
    return w.querySelector('.db');
  }
  function formData(f) { var b = {}; new FormData(f).forEach(function (v, k) { b[k] = v; }); return b; }
  function refreshAll() { renderJobs(); renderHub(); document.querySelectorAll('[data-live=tasks]').forEach(renderTasks); renderContacts(); }
  function noteBox(ref, id, after) {
    return { html: '<form class="notef"><textarea name="note" rows="2" placeholder="Add a note: called, left voicemail, quoted $X…"></textarea><button>Add note</button></form>',
      bind: function (root) {
        var f = root.querySelector('.notef'); if (!f) return;
        f.addEventListener('submit', function (e) { e.preventDefault(); var n = f.note.value.trim(); if (!n) return;
          api('/notes', { method: 'POST', body: { ref_type: ref, ref_id: id, note: n } }).then(function () { toast('Note added'); after(); }).catch(function () { toast('Could not save'); }); });
      } };
  }

  function openJob(id) {
    var body = drawer('Job', '<p class="loading">Loading…</p>', refreshAll);
    api('/jobs/' + id).then(function (d) {
      var j = d.job, c = d.contact || {}, nb = noteBox('job', id, function () { openJob(id); });
      body.innerHTML =
        '<form class="dform" data-f="contact">' +
          '<h3>Customer' + (c.id ? ' <button type="button" class="linkbtn" data-open-contact="' + c.id + '">Open profile</button>' : '') + '</h3>' +
          fld('Name', inp('name', c.name)) + fld('Phone', inp('phone', c.phone, 'tel')) + fld('Email', inp('email', c.email, 'email')) + fld('Address', inp('address', c.address)) +
          (c.phone ? '<a class="callbtn" href="tel:' + esc(c.phone) + '">Call ' + esc(c.phone) + '</a>' : '') +
        '</form>' +
        '<form class="dform" data-f="job"><h3>Job</h3>' +
          fld('Stage', '<select name="stage">' + opt(['lead', 'consult', 'estimate', 'booked', 'done', 'review', 'lost'], j.stage, ['Lead', 'Consult', 'Estimate sent', 'Booked', 'Done', 'Review asked', 'Lost']) + '</select>') +
          fld('Service', '<select name="service"><option value="">Not set</option>' + opt(SERVICES, j.service) + '</select>') +
          fld('Owner', '<select name="owner">' + opt(['ricky', 'doug'], j.owner, ['Ricky', 'Doug']) + '</select>') +
          fld('Partner', '<select name="partner">' + opt(PARTNERS, j.partner) + '</select>') +
          fld('Scheduled for', inp('scheduled_for', j.scheduled_for, 'date')) +
          fld('Job notes', '<textarea name="notes" rows="3">' + esc(j.notes || '') + '</textarea>') +
          '<button class="save">Save changes</button></form>' +
        '<h3>Follow ups</h3><ul class="tasks">' + (d.tasks.length ? d.tasks.map(function (t) { TASKS[t.id] = t; return taskRow(t, new Date().toISOString().slice(0, 10)); }).join('') : '') + '</ul>' +
        '<form class="dform inline" data-f="fu">' + inp('title', '') + '<input name="due" type="date"><select name="owner">' + opt(['ricky', 'doug', 'both'], j.owner || ls(LS_USER), ['Ricky', 'Doug', 'Both']) + '</select><button>Add follow up</button></form>' +
        '<h3>History</h3>' + nb.html + timeline(d.activity);
      body.querySelector('[data-f=fu] input[name=title]').placeholder = 'Call back, send estimate…';
      nb.bind(body); bindTicks(body, function () { openJob(id); }); bindTaskOpen(body);
      var oc = body.querySelector('[data-open-contact]'); if (oc) oc.onclick = function () { openContact(+oc.dataset.openContact); };
      body.querySelector('[data-f=job]').addEventListener('submit', function (e) {
        e.preventDefault();
        var cf = formData(body.querySelector('[data-f=contact]')), jf = formData(e.target);
        var jobs = [api('/jobs/' + id, { method: 'PATCH', body: jf })];
        if (c.id) jobs.push(api('/contacts/' + c.id, { method: 'PATCH', body: cf }));
        Promise.all(jobs).then(function () { toast('Saved'); openJob(id); }).catch(function (err) { toast(err.message === 'name required' ? 'Name is required' : 'Could not save'); });
      });
      body.querySelector('[data-f=fu]').addEventListener('submit', function (e) {
        e.preventDefault(); var b = formData(e.target); if (!b.title.trim()) return; b.job_id = id; b.area = 'sales';
        api('/tasks', { method: 'POST', body: b }).then(function () { toast('Follow up added'); openJob(id); }).catch(function () { toast('Could not save'); });
      });
    }).catch(function () { body.innerHTML = '<p class="loading">Could not load this job.</p>'; });
  }

  function openContact(id) {
    var body = drawer('Contact', '<p class="loading">Loading…</p>', refreshAll);
    api('/contacts/' + id).then(function (d) {
      var c = d.contact, nb = noteBox('contact', id, function () { openContact(id); });
      body.innerHTML = '<form class="dform" data-f="c">' +
        fld('Name', inp('name', c.name)) + fld('Phone', inp('phone', c.phone, 'tel')) + fld('Email', inp('email', c.email, 'email')) +
        fld('Address', inp('address', c.address)) + fld('Neighborhood', inp('neighborhood', c.neighborhood)) +
        fld('Type', '<select name="kind">' + opt(['customer', 'partner', 'vendor'], c.kind, ['Customer', 'Partner', 'Vendor']) + '</select>') +
        fld('Found us through', '<select name="source">' + opt(['', 'hanger', 'facebook', 'referral', 'phone', 'form', 'other'], c.source, ['Not set', 'Door hanger', 'Facebook', 'Referral', 'Called in', 'Website', 'Other']) + '</select>') +
        fld('Notes', '<textarea name="notes" rows="3">' + esc(c.notes || '') + '</textarea>') +
        (c.phone ? '<a class="callbtn" href="tel:' + esc(c.phone) + '">Call ' + esc(c.phone) + '</a>' : '') +
        '<button class="save">Save changes</button></form>' +
        '<h3>Jobs</h3>' + (d.jobs.length ? '<ul class="mini jl">' + d.jobs.map(function (j) { return '<li data-job="' + j.id + '"><span>' + esc(STAGE[j.stage]) + '</span>' + esc(j.service || 'Service not set') + '</li>'; }).join('') + '</ul>' : '<p class="loading">No jobs yet.</p>') +
        '<button class="ghost" data-newjob>New job for ' + esc(c.name) + '</button>' +
        '<h3>History</h3>' + nb.html + timeline(d.activity);
      nb.bind(body);
      body.querySelectorAll('[data-job]').forEach(function (li) { li.onclick = function () { openJob(+li.dataset.job); }; });
      body.querySelector('[data-newjob]').onclick = function () {
        api('/jobs', { method: 'POST', body: { contact_id: id, stage: 'lead' } }).then(function (r) { toast('Job created'); openJob(r.id); });
      };
      body.querySelector('[data-f=c]').addEventListener('submit', function (e) {
        e.preventDefault();
        api('/contacts/' + id, { method: 'PATCH', body: formData(e.target) }).then(function () { toast('Saved'); openContact(id); })
          .catch(function (err) { toast(err.message === 'name required' ? 'Name is required' : 'Could not save'); });
      });
    }).catch(function () { body.innerHTML = '<p class="loading">Could not load this contact.</p>'; });
  }

  function openTask(t) {
    var body = drawer('Task', '', function () { document.querySelectorAll('[data-live=tasks]').forEach(renderTasks); renderHub(); });
    body.innerHTML = '<form class="dform" data-f="t">' + fld('Task', '<textarea name="title" rows="2">' + esc(t.title) + '</textarea>') +
      fld('Owner', '<select name="owner">' + opt(['ricky', 'doug', 'both'], t.owner, ['Ricky', 'Doug', 'Both']) + '</select>') +
      fld('Due', inp('due', t.due, 'date')) + fld('Notes', '<textarea name="notes" rows="4" placeholder="Who you talked to, what they said…">' + esc(t.notes || '') + '</textarea>') +
      '<div class="meta">' + (t.source ? 'From: ' + esc(t.source) : '') + (t.gate ? ' &middot; Gate ' + esc(t.gate) : '') + (t.done_by ? ' &middot; Done by ' + esc(NAME[t.done_by] || t.done_by) : '') + '</div>' +
      '<div class="row"><button class="save">Save</button><button type="button" class="ghost" data-toggle>' + (t.status === 'done' ? 'Reopen' : 'Mark done') + '</button>' +
      (t.job_id ? '<button type="button" class="ghost" data-job>Open job</button>' : '') + '</div></form>';
    var f = body.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault();
      api('/tasks/' + t.id, { method: 'PATCH', body: formData(f) }).then(function () { toast('Saved'); document.querySelector('.dx').click(); }).catch(function () { toast('Could not save'); }); });
    body.querySelector('[data-toggle]').onclick = function () {
      var was = t.status;
      setStatus(t.id, was === 'done' ? 'open' : 'done').then(function () {
        document.querySelector('.dx').click();
        if (was === 'done') toast('Reopened');
        else toast('Done', function () { setStatus(t.id, 'open').then(function () { toast('Reopened'); refreshTaskViews(); }); });
      });
    };
    var jb = body.querySelector('[data-job]'); if (jb) jb.onclick = function () { openJob(t.job_id); };
  }
  function bindTaskOpen(root) {
    root.querySelectorAll('.task .tbody').forEach(function (b) {
      b.style.cursor = 'pointer';
      b.addEventListener('click', function () { var t = TASKS[b.closest('.task').dataset.id]; if (t) openTask(t); });
    });
  }

  /* ---------- contacts page ---------- */
  function renderContacts() {
    var el = document.querySelector('[data-live=contacts]'); if (!el) return;
    var q = (document.querySelector('[data-search]') || {}).value || '';
    api('/contacts' + (q ? '?q=' + encodeURIComponent(q) : '')).then(function (d) {
      el.innerHTML = d.contacts.length ? '<table class="ct"><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Type</th><th>Latest</th></tr></thead><tbody>' +
        d.contacts.map(function (c) {
          return '<tr data-c="' + c.id + '"><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.phone || '') + '</td><td>' + esc(c.address || '') + '</td><td>' + esc(c.kind || '') + '</td><td>' + esc(c.last_stage ? STAGE[c.last_stage] : '') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="loading">' + (q ? 'No match.' : 'No contacts yet. Add one below or wait for the first website lead.') + '</p>';
      el.querySelectorAll('tr[data-c]').forEach(function (tr) { tr.onclick = function () { openContact(+tr.dataset.c); }; });
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
    var cf = document.querySelector('form[data-form=contact]');
    if (cf) cf.addEventListener('submit', function (e) {
      e.preventDefault();
      api('/contacts', { method: 'POST', body: formData(cf) }).then(function (r) { cf.reset(); toast('Contact added'); renderContacts(); openContact(r.id); })
        .catch(function (err) { toast(err.message === 'name required' ? 'Name is required' : 'Could not save'); });
    });
    var sb = document.querySelector('[data-search]'), st;
    if (sb) sb.addEventListener('input', function () { clearTimeout(st); st = setTimeout(renderContacts, 250); });
    var out = document.querySelector('[data-signout]');
    if (out) out.addEventListener('click', function () { ls(LS_KEY, null); location.reload(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!ls(LS_KEY)) { lock(); return; }
    renderHub(); renderJobs(); renderContacts(); renderClosed();
    document.querySelectorAll('[data-live=tasks]').forEach(renderTasks);
    bindForms();
  });
})();
