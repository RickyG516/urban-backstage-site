/* UNC OS: internal business tasks (not client work) + Hub widgets.
   Data lives in the Sales OS Worker (/os/*, D1). No keys in this file: the workspace
   key is already in this browser from the backstage PIN (unc-key.js). */
(function () {
  var LOCAL = location.hostname === 'localhost';
  var API = LOCAL ? 'http://localhost:8788' : 'https://unc-sales-os-sync.ricky-a17.workers.dev';
  var AREA = { revenue: 'Revenue & Growth', clients: 'Client Success', delivery: 'Delivery & Ops', content: 'Content & Brand', finance: 'Finance & Admin', tech: 'Tech & Systems', goals: 'Goals' };
  var AREAS = ['revenue', 'clients', 'delivery', 'content', 'finance', 'tech', 'goals'];
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function me() { var v = ls('unc_cockpit_current_rep_id'); try { return (JSON.parse(v) || 'ricky'); } catch (e) { return v || 'ricky'; } }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, body) {
    var h = { 'x-unc-key': ls('unc_worker_key') };
    if (body) { h['Content-Type'] = 'application/json'; body.by = me(); }
    return fetch(API + path, { method: body ? 'POST' : 'GET', headers: h, cache: 'no-store', body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (r.status === 401) throw new Error('locked'); return r.json(); })
      .then(function (d) { if (!d.ok) throw new Error(d.error || 'failed'); return d; });
  }
  function fmt(d) { if (!d) return 'No date'; return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function days(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  function ago(a) {
    var d = new Date((a || '').replace(' ', 'T') + (a && a.length <= 19 ? 'Z' : '')); if (isNaN(d)) return '';
    var m = Math.round((Date.now() - d) / 6e4); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd';
  }
  function toast(msg, undo) {
    document.querySelectorAll('.os-toast').forEach(function (x) { x.remove(); });
    var t = document.createElement('div'); t.className = 'os-toast'; t.textContent = msg;
    if (undo) { var b = document.createElement('button'); b.textContent = 'Undo'; b.onclick = function () { t.remove(); undo(); }; t.appendChild(b); }
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, undo ? 6500 : 2600);
  }
  var TASKS = {};
  function row(t, today, opts) {
    opts = opts || {}; TASKS[t.id] = t;
    var late = t.status === 'open' && t.due && t.due < today;
    return '<div class="os-task' + (t.status === 'done' ? ' done' : '') + (late ? ' late' : '') + '" data-id="' + t.id + '"><button class="os-chk" aria-label="Done"></button>' +
      '<div class="os-b"><div class="os-t">' + (t.priority ? '<i class="os-pri" title="Priority"></i>' : '') + esc(t.title) + '</div><div class="os-m">' +
      (opts.noArea ? '' : '<span class="os-area ' + esc(t.area) + '">' + esc(AREA[t.area] || t.area) + '</span>') +
      (t.status === 'done' ? '<span>Closed by ' + esc(cap(t.done_by || '?')) + '</span>' : '<span class="os-due">' + (late ? 'Late, ' : '') + fmt(t.due) + '</span>') +
      (t.owner ? '<span>' + esc(cap(t.owner)) + '</span>' : '') + (t.repeat ? '<span class="os-rep">' + esc(cap(t.repeat)) + '</span>' : '') + '</div></div></div>';
  }
  function wire(root, reload) {
    root.querySelectorAll('.os-chk').forEach(function (b) {
      b.onclick = function () {
        var el = b.closest('.os-task'), id = el.dataset.id, done = el.classList.contains('done');
        el.classList.toggle('done');
        api('/os/tasks/' + id, { status: done ? 'open' : 'done' }).then(function () {
          if (done) toast('Reopened'); else toast('Done. One more W.', function () { api('/os/tasks/' + id, { status: 'open' }).then(reload); });
          reload();
        }).catch(function () { el.classList.toggle('done'); toast('Could not save'); });
      };
    });
    root.querySelectorAll('.os-t').forEach(function (t) { t.onclick = function () { edit(TASKS[t.closest('.os-task').dataset.id], reload); }; });
  }
  function opts(list, cur, labels) { return list.map(function (v, i) { return '<option value="' + esc(v) + '"' + (v === (cur || '') ? ' selected' : '') + '>' + esc(labels ? labels[i] : v) + '</option>'; }).join(''); }
  function edit(t, reload) {
    document.querySelectorAll('.os-drawer').forEach(function (x) { x.remove(); });
    var d = document.createElement('div'); d.className = 'os-drawer';
    d.innerHTML = '<form><div class="os-dh"><b>Task</b><button type="button" data-x>Close</button></div>' +
      '<label>Task<textarea name="title" rows="2">' + esc(t.title) + '</textarea></label>' +
      '<label>Department<select name="area">' + opts(AREAS, t.area, AREAS.map(function (a) { return AREA[a]; })) + '</select></label>' +
      '<div class="os-2"><label>Due<input type="date" name="due" value="' + esc(t.due || '') + '"></label><label>Repeats<select name="repeat">' + opts(['', 'daily', 'weekly', 'monthly'], t.repeat || '', ['No', 'Daily', 'Weekly', 'Monthly']) + '</select></label></div>' +
      '<div class="os-2"><label>Owner<input name="owner" value="' + esc(t.owner || '') + '" placeholder="anyone"></label><label>Priority<select name="priority">' + opts(['0', '1'], String(t.priority || 0), ['Normal', 'High']) + '</select></label></div>' +
      '<label>Notes<textarea name="notes" rows="5" placeholder="What done looks like, links, who you talked to">' + esc(t.notes || '') + '</textarea></label>' +
      (t.source ? '<p class="os-src">From: ' + esc(t.source) + '</p>' : '') +
      '<div class="os-row"><button class="os-btn" type="submit">Save</button><button type="button" class="os-ghost" data-del>Delete</button></div></form>';
    document.body.appendChild(d);
    var f = d.querySelector('form'), close = function () { d.remove(); };
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    d.querySelector('[data-x]').onclick = close;
    f.onsubmit = function (e) { e.preventDefault(); var b = {}; new FormData(f).forEach(function (v, k) { b[k] = v; }); b.priority = b.priority === '1';
      api('/os/tasks/' + t.id, b).then(function () { toast('Saved'); close(); reload(); }).catch(function () { toast('Could not save'); }); };
    var del = d.querySelector('[data-del]'), armed = false;
    del.onclick = function () { if (!armed) { armed = true; del.textContent = 'Tap again to delete'; return; }
      api('/os/tasks/' + t.id + '/delete', {}).then(function () { toast('Deleted'); close(); reload(); }).catch(function () { toast('Could not delete'); }); };
  }

  /* ---------- full task page ---------- */
  var V = { status: 'open', area: '', q: '' };
  function renderList() {
    var el = document.querySelector('[data-os=list]'); if (!el) return;
    var q = '/os/tasks?status=' + (V.q ? 'all' : V.status) + (V.area ? '&area=' + V.area : '') + (V.q ? '&q=' + encodeURIComponent(V.q) : '');
    api(q).then(function (d) {
      var T = d.tasks, today = d.today, wk = new Date(new Date(today + 'T12:00:00').getTime() + 7 * 864e5).toISOString().slice(0, 10);
      var groups = V.status === 'done' && !V.q ? [['Closed, newest first', function () { return true; }]] : [
        ['Overdue', function (t) { return t.status === 'open' && t.due && t.due < today; }],
        ['Today', function (t) { return t.status === 'open' && t.due === today; }],
        ['This week', function (t) { return t.status === 'open' && t.due && t.due > today && t.due <= wk; }],
        ['Next 30 days', function (t) { return t.status === 'open' && t.due && t.due > wk && days(today, t.due) <= 30; }],
        ['Later', function (t) { return t.status === 'open' && t.due && days(today, t.due) > 30; }],
        ['No date yet', function (t) { return t.status === 'open' && !t.due; }],
        ['Closed', function (t) { return t.status === 'done'; }]];
      var used = {}, html = '';
      groups.forEach(function (g) {
        var rows = T.filter(function (t) { if (used[t.id]) return false; if (g[1](t)) { used[t.id] = 1; return true; } return false; });
        if (!rows.length) return;
        html += '<section class="os-group' + (g[0] === 'Overdue' ? ' over' : '') + '"><h3>' + g[0] + ' <b>' + rows.length + '</b></h3>' + rows.map(function (t) { return row(t, today, { noArea: !!V.area }); }).join('') + '</section>';
      });
      el.innerHTML = html || '<p class="os-muted">' + (V.q ? 'No match.' : V.status === 'open' ? 'Nothing open here. Go get one more client.' : 'Nothing closed yet.') + '</p>';
      wire(el, renderAll);
    }).catch(function (e) { el.innerHTML = '<p class="os-muted">' + (e.message === 'locked' ? 'Unlock the backstage first.' : 'Could not load tasks.') + '</p>'; });
  }
  function renderFilters() {
    var el = document.querySelector('[data-os=filters]'); if (!el) return;
    api('/os/summary').then(function (d) {
      var m = {}; d.by_area.forEach(function (a) { m[a.area] = a; });
      el.innerHTML = '<button data-a="" class="' + (V.area ? '' : 'on') + '">All <b>' + d.open + '</b></button>' + AREAS.map(function (a) {
        var x = m[a] || { open: 0, overdue: 0 };
        return '<button data-a="' + a + '" class="os-area ' + a + (V.area === a ? ' on' : '') + '">' + AREA[a] + ' <b>' + x.open + '</b>' + (x.overdue ? '<i>' + x.overdue + ' late</i>' : '') + '</button>'; }).join('');
      el.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { V.area = b.dataset.a; renderAll(); }; });
      var st = document.querySelector('[data-os=stats]');
      if (st) st.innerHTML = '<div><b>' + d.open + '</b><span>open</span></div><div class="' + (d.overdue ? 'bad' : '') + '"><b>' + d.overdue + '</b><span>overdue</span></div><div><b>' + d.week + '</b><span>due this week</span></div><div><b>' + d.closed7 + '</b><span>closed, 7 days</span></div>';
    }).catch(function () {});
  }
  function bindPage() {
    var f = document.querySelector('[data-os=add]'); if (!f) return;
    f.onsubmit = function (e) { e.preventDefault(); var b = {}; new FormData(f).forEach(function (v, k) { b[k] = v; });
      if (!b.area && V.area) b.area = V.area;
      api('/os/tasks', b).then(function () { f.reset(); toast('Task added'); renderAll(); }).catch(function () { toast('Could not add'); }); };
    document.querySelectorAll('[data-os-st]').forEach(function (b) { b.onclick = function () { V.status = b.dataset.osSt; document.querySelectorAll('[data-os-st]').forEach(function (x) { x.classList.toggle('on', x === b); }); renderList(); }; });
    var s = document.querySelector('[data-os=search]'), tt;
    if (s) s.oninput = function () { clearTimeout(tt); tt = setTimeout(function () { V.q = s.value.trim(); renderList(); }, 250); };
    var hash = location.hash.replace('#', ''); if (AREA[hash]) V.area = hash;
  }

  /* ---------- hub ---------- */
  function set(k, v, bad) { var e = document.querySelector('[data-k=' + k + ']'); if (!e) return; e.textContent = v; if (bad !== undefined) e.closest('.kpi').classList.toggle('bad', !!bad); }
  function renderHub() {
    var nx = document.querySelector('[data-os=next]'); if (!nx) return;
    var g = document.querySelector('[data-os=greet]'), h = new Date().getHours();
    if (g) g.textContent = (h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening') + ', ' + cap(me()) + ' · ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    api('/os/summary').then(function (d) {
      set('os-overdue', d.overdue, d.overdue > 0); set('os-week', d.week); set('os-open', d.open); set('os-closed', d.closed7);
      nx.innerHTML = d.next.length ? d.next.slice(0, 8).map(function (t) { return row(t, d.today); }).join('') : '<p class="os-muted">Nothing due in the next 7 days.</p>';
      wire(nx, renderHub);
      var ar = document.querySelector('[data-os=areas]'), m = {}; d.by_area.forEach(function (a) { m[a.area] = a; });
      var mx = Math.max(1, Math.max.apply(null, AREAS.map(function (a) { return (m[a] || {}).open || 0; })));
      if (ar) ar.innerHTML = AREAS.map(function (a) { var x = m[a] || { open: 0, overdue: 0 };
        return '<a class="os-ar" href="/tasks/unc/#' + a + '"><span>' + AREA[a] + '</span><div class="os-bar"><i class="' + a + '" style="width:' + (x.open ? Math.max(6, x.open / mx * 100) : 0) + '%"></i></div><b>' + x.open + '</b>' + (x.overdue ? '<em>' + x.overdue + ' late</em>' : '<em></em>') + '</a>'; }).join('');
      var fd = document.querySelector('[data-os=feed]');
      if (fd) fd.innerHTML = d.recent.length ? d.recent.slice(0, 6).map(function (a) { return '<li><b>' + esc(cap(a.who)) + '</b> ' + esc(a.kind) + ' <span>' + esc(a.note || '') + '</span><em>' + ago(a.at) + '</em></li>'; }).join('') : '<li class="os-muted">Quiet so far.</li>';
    }).catch(function (e) { nx.innerHTML = '<p class="os-muted">' + (e.message === 'locked' ? 'Unlock the backstage to load your tasks.' : 'Could not load tasks.') + '</p>'; });
    // client side (HubSpot via the same Worker). Any failure leaves a dash.
    api('/tasks?status=open').then(function (d) {
      var T = d.tasks || [], late = T.filter(function (t) { return t.due && t.due < d.today; }).length;
      set('hs-open', T.length, late > 0); var s = document.querySelector('[data-k=hs-late]'); if (s) s.textContent = late ? late + ' late' : 'none late';
      var el = document.querySelector('[data-os=client]');
      if (el) el.innerHTML = T.length ? T.slice(0, 5).map(function (t) { var l = t.due && t.due < d.today;
        return '<a class="os-cl' + (l ? ' late' : '') + '" href="' + esc(t.link) + '" target="_blank" rel="noopener"><span>' + esc(t.title) + '</span><em>' + (l ? 'Late, ' : '') + fmt(t.due) + '</em></a>'; }).join('') : '<p class="os-muted">No open client tasks.</p>';
    }).catch(function () { var el = document.querySelector('[data-os=client]'); if (el) el.innerHTML = '<p class="os-muted">Could not reach HubSpot right now.</p>'; });
    api('/stats?range=today&view=team').then(function (d) { set('dials', (d.stats || {}).total != null ? d.stats.total : d.count || 0); }).catch(function () {});
    api('/callbacks').then(function (d) { set('callbacks', (d.callbacks || []).length); }).catch(function () {});
    api('/brief').then(function (d) {
      var el = document.querySelector('[data-os=brief]'); if (!el) return;
      var S = (d.signals || []).filter(function (s) { return s.severity !== 'good'; }).slice(0, 3);
      el.innerHTML = S.length ? S.map(function (s) { return '<div class="os-sig ' + esc(s.severity) + '"><b>' + esc(s.title) + '</b><p>' + esc(s.action || s.detail || '') + '</p></div>'; }).join('') : '<p class="os-muted">' + esc(d.headline || 'All clear.') + '</p>';
    }).catch(function () { var el = document.querySelector('[data-os=brief]'); if (el) el.innerHTML = '<p class="os-muted">Brief is unavailable right now.</p>'; });
  }

  function renderAll() { renderFilters(); renderList(); renderHub(); }
  function boot() { bindPage(); renderAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
