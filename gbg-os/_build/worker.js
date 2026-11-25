/* gbg-os-api: GBG Dubuque CRM backend.
 * D1 binding: DB (gbg-os). Email Service binding: EMAIL (sends from gbg.urbanbackstage.com).
 * Secrets: PIN_RICKY, PIN_DOUG, PIN_KEVIN, TOKEN_SECRET, FORM_TOKEN, RETELL_TOKEN,
 *   USER_EMAILS (JSON {ricky,doug,kevin} for the Monday email).
 * Cron: Mondays 13:00 UTC (7 AM Central) sends each owner their week.
 * No secrets live in this file. Browser sends x-gbg-user + x-gbg-key (HMAC of user).
 * Deploy runbook: gbg-os/_build/WORKER.md */

const ORIGINS = ['https://urbanbackstage.com', 'http://localhost:8765'];
const USERS = ['ricky', 'doug', 'kevin'];
const OWNERS = ['ricky', 'doug', 'kevin', 'both']; // 'both' = all owners (label only, kept for old rows)
const STAGES = ['lead', 'consult', 'estimate', 'booked', 'done', 'review', 'lost'];
const LAUNCH = '2027-04-01';
const ALERT_FROM = 'alerts@gbg.urbanbackstage.com';
const ALERT_TO = ['ricky@urbannicheco.com', 'Jaxt3@icloud.com'];

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, x-gbg-user, x-gbg-key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
}
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('gbg:' + msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function authed(req, env) {
  const u = (req.headers.get('x-gbg-user') || '').toLowerCase();
  const k = req.headers.get('x-gbg-key') || '';
  if (!USERS.includes(u)) return null;
  return same(k, await hmac(env.TOKEN_SECRET, u)) ? u : null;
}
const today = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10); // Central, close enough
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const s = v => (v === undefined || v === null || v === '') ? null : String(v).slice(0, 2000);

async function log(env, who, kind, ref_type, ref_id, note) {
  await env.DB.prepare('INSERT INTO activity (who,kind,ref_type,ref_id,note) VALUES (?,?,?,?,?)')
    .bind(who, kind, ref_type, ref_id, s(note)).run();
}
async function body(req) { try { return await req.json(); } catch (e) { return {}; } }

async function sendCallAlert(env, { name, phone, city, svc, notes }) {
  if (!env.EMAIL) return;
  const subject = 'GBG call: ' + name + (svc ? ' (' + svc + ')' : '');
  const text = [
    'Name: ' + name,
    phone ? 'Phone: ' + phone : null,
    city ? 'City: ' + city : null,
    svc ? 'Need: ' + svc : null,
    notes ? '' : null,
    notes || null
  ].filter(v => v !== null).join('\n');
  for (const to of ALERT_TO) {
    try { await env.EMAIL.send({ to, from: ALERT_FROM, subject, text }); }
    catch (e) { /* email failure never blocks the CRM write */ }
  }
}

/* ---------- inbound lead (Netlify form webhook) ---------- */
async function inbound(req, env, url) {
  if (!env.FORM_TOKEN || !same(url.searchParams.get('token') || '', env.FORM_TOKEN)) return json(req, { ok: false, error: 'forbidden' }, 403);
  const b = await body(req);
  const d = b.data || b;
  const name = s(d.name || [d.first_name, d.last_name].filter(Boolean).join(' ')) || 'Website lead';
  const svc = s(d.service || d.services);
  const notes = [s(d.message), d.address ? 'Address: ' + d.address : null, b.form_name ? 'Form: ' + b.form_name : null].filter(Boolean).join('\n');
  const c = await env.DB.prepare('INSERT INTO contacts (name,phone,email,address,source,notes) VALUES (?,?,?,?,?,?)')
    .bind(name, s(d.phone), s(d.email), s(d.address), 'form', notes || null).run();
  const cid = c.meta.last_row_id;
  const j = await env.DB.prepare("INSERT INTO jobs (contact_id,service,stage,notes) VALUES (?,?,'lead',?)").bind(cid, svc, notes || null).run();
  await env.DB.prepare("INSERT INTO tasks (title,owner,due,area,source,job_id) VALUES (?,?,?,?,?,?)")
    .bind('Respond to new website lead: ' + name, 'both', today(), 'sales', 'Website form', j.meta.last_row_id).run();
  await log(env, 'website', 'lead', 'job', j.meta.last_row_id, name + (svc ? ' (' + svc + ')' : ''));
  return json(req, { ok: true });
}

/* ---------- inbound call (Retell AI post-call webhook) ---------- */
async function inboundCall(req, env, url) {
  if (!env.RETELL_TOKEN || !same(url.searchParams.get('token') || '', env.RETELL_TOKEN)) return json(req, { ok: false, error: 'forbidden' }, 403);
  const b = await body(req);
  if (b.event && b.event !== 'call_analyzed') return json(req, { ok: true, skipped: b.event || 'no event' });
  const call = b.call || b;
  const ca = call.call_analysis || {};
  const d = ca.custom_analysis_data || call.custom_analysis_data || {};
  const callerType = s(d.caller_type) || 'other';
  if (['wrong_number', 'spam'].includes(callerType)) {
    await log(env, 'gbg-receptionist', 'call_skip', null, null, callerType);
    return json(req, { ok: true, skipped: callerType });
  }
  const name = s(d.caller_name) || 'Phone caller';
  const phone = s(d.callback_number) || s(call.from_number);
  const city = s(d.city);
  const need = s(d.need);
  const notes = [s(ca.call_summary), need ? 'Need: ' + need : null, d.best_time ? 'Best time: ' + s(d.best_time) : null,
    d.urgent ? 'Urgent: ' + s(d.urgent) : null, callerType === 'partner_inquiry' ? 'Asked about painting/landscaping/tree (partner referral)' : null]
    .filter(Boolean).join('\n') || null;
  const c = await env.DB.prepare('INSERT INTO contacts (name,phone,neighborhood,source,notes) VALUES (?,?,?,?,?)')
    .bind(name, phone, city, 'phone', notes).run();
  const cid = c.meta.last_row_id;
  const svc = callerType === 'partner_inquiry' ? (need || 'partner referral') : need;
  const j = await env.DB.prepare("INSERT INTO jobs (contact_id,service,stage,notes) VALUES (?,?,'lead',?)").bind(cid, svc, notes).run();
  await env.DB.prepare("INSERT INTO tasks (title,owner,due,area,source,job_id) VALUES (?,?,?,?,?,?)")
    .bind('Call back: ' + name + (svc ? ' (' + svc + ')' : ''), 'both', today(), 'sales', 'GBG phone', j.meta.last_row_id).run();
  await log(env, 'gbg-receptionist', 'call_lead', 'job', j.meta.last_row_id, name + (svc ? ' (' + svc + ')' : ''));
  await sendCallAlert(env, { name, phone, city, svc, notes });
  return json(req, { ok: true });
}

/* ---------- week helpers ---------- */
// the Sunday this week's check in happens on (today if it is Sunday)
function sundayOf(d) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + (7 - x.getUTCDay()) % 7); return x.toISOString().slice(0, 10); }
const REPEAT = ['weekly', 'monthly'];
function nextDue(due, rep) {
  const base = due || today();
  if (rep === 'weekly') return addDays(base, 7);
  const x = new Date(base + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + 1); return x.toISOString().slice(0, 10);
}

/* ---------- Monday email ---------- */
async function digestFor(env, user) {
  const DB = env.DB, t = today(), wk = addDays(t, 7), since = addDays(t, -7);
  const mine = "(owner=? OR owner='both')";
  const over = (await DB.prepare(`SELECT title,due,owner FROM tasks WHERE status='open' AND ${mine} AND due < ? ORDER BY due`).bind(user, t).all()).results;
  const week = (await DB.prepare(`SELECT title,due,owner FROM tasks WHERE status='open' AND ${mine} AND due >= ? AND due <= ? ORDER BY due`).bind(user, t, wk).all()).results;
  const others = (await DB.prepare("SELECT title,done_by FROM tasks WHERE status='done' AND done_by IS NOT NULL AND done_by<>? AND substr(done_at,1,10) >= ? ORDER BY done_at DESC").bind(user, since).all()).results;
  const mineDone = (await DB.prepare("SELECT COUNT(*) n FROM tasks WHERE status='done' AND done_by=? AND substr(done_at,1,10) >= ?").bind(user, since).first()).n;
  const nm = { ricky: 'Ricky', doug: 'Doug', kevin: 'Kevin', both: 'All owners' };
  const md = d => { const x = new Date(d + 'T12:00:00Z'); return x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
  const line = r => '  - ' + r.title + (r.due ? ' (' + md(r.due) + (r.owner === 'both' ? ', all owners' : '') + ')' : '');
  const L = ['Morning ' + nm[user] + ',', '', 'Here is your GBG week. Open the OS to check things off: https://urbanbackstage.com/gbg-os/', ''];
  L.push('OVERDUE (' + over.length + ')'); L.push(...(over.length ? over.map(line) : ['  Nothing. Nice.'])); L.push('');
  L.push('DUE THIS WEEK (' + week.length + ')'); L.push(...(week.length ? week.map(line) : ['  Nothing due this week.'])); L.push('');
  L.push('WHAT THE OTHERS CLOSED LAST WEEK (' + others.length + ')');
  L.push(...(others.length ? others.slice(0, 25).map(r => '  - ' + (nm[r.done_by] || r.done_by) + ': ' + r.title) : ['  Nothing yet.'])); L.push('');
  L.push('You closed ' + mineDone + ' last week.'); L.push('');
  L.push('Sunday check in is 8:30 PM. Agenda builds itself: https://urbanbackstage.com/gbg-os/checkin/');
  return { subject: 'GBG week: ' + over.length + ' overdue, ' + week.length + ' due this week', text: L.join('\n') };
}
async function sendDigests(env, only) {
  let emails = {}; try { emails = JSON.parse(env.USER_EMAILS || '{}'); } catch (e) { }
  const sent = [];
  for (const u of USERS) {
    if (only && u !== only) continue;
    if (!emails[u] || !env.EMAIL) continue;
    const d = await digestFor(env, u);
    try { await env.EMAIL.send({ to: emails[u], from: ALERT_FROM, subject: d.subject, text: d.text }); sent.push(u); }
    catch (e) { await log(env, 'system', 'digest_fail', null, null, u); }
  }
  if (sent.length) await log(env, 'system', 'digest', null, null, 'Monday email to ' + sent.join(', '));
  return sent;
}

/* ---------- contact archive / delete ---------- */
async function contactAction(env, DB, who, id, action) {
  const c = await DB.prepare('SELECT id,name,archived FROM contacts WHERE id=?').bind(id).first();
  if (!c) return false;
  if (action === 'archive' || action === 'unarchive') {
    const v = action === 'archive' ? 1 : 0;
    if (c.archived === v) return true;
    await DB.prepare("UPDATE contacts SET archived=?, updated_at=datetime('now') WHERE id=?").bind(v, id).run();
    await log(env, who, action === 'archive' ? 'contact_archive' : 'contact_unarchive', 'contact', id, c.name);
    return true;
  }
  if (action === 'delete') {
    const jobs = await DB.prepare('SELECT id FROM jobs WHERE contact_id=?').bind(id).all();
    const jids = jobs.results.map(j => j.id);
    const stmts = [];
    if (jids.length) {
      const ph = jids.map(() => '?').join(',');
      stmts.push(DB.prepare('DELETE FROM tasks WHERE job_id IN (' + ph + ')').bind(...jids));
      stmts.push(DB.prepare('DELETE FROM jobs WHERE id IN (' + ph + ')').bind(...jids));
    }
    stmts.push(DB.prepare('DELETE FROM contacts WHERE id=?').bind(id));
    await DB.batch(stmts);
    await log(env, who, 'contact_delete', null, null, c.name + (jids.length ? ' (+' + jids.length + ' job' + (jids.length > 1 ? 's' : '') + ')' : ''));
    return true;
  }
  return false;
}

/* ---------- routes ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    try {
      if (p === '/') return json(req, { ok: true, service: 'gbg-os-api' });
      if (p === '/inbound' && req.method === 'POST') return inbound(req, env, url);
      if (p === '/inbound-call' && req.method === 'POST') return inboundCall(req, env, url);

      if (p === '/pin' && req.method === 'POST') {
        const b = await body(req);
        const u = String(b.user || '').toLowerCase();
        const want = u === 'ricky' ? env.PIN_RICKY : u === 'doug' ? env.PIN_DOUG : u === 'kevin' ? env.PIN_KEVIN : null;
        if (!want || !same(String(b.pin || ''), want)) {
          await new Promise(r => setTimeout(r, 1500));
          return json(req, { ok: false, error: 'wrong PIN' }, 401);
        }
        await log(env, u, 'login', null, null, null);
        return json(req, { ok: true, user: u, key: await hmac(env.TOKEN_SECRET, u) });
      }

      const who = await authed(req, env);
      if (!who) return json(req, { ok: false, error: 'locked' }, 401);
      const DB = env.DB;

      /* summary for hub */
      if (p === '/summary') {
        const t = today(), wk = addDays(t, 7);
        const q = (sql, ...a) => DB.prepare(sql).bind(...a);
        const [open, overdue, week, stages, contacts, keys, recent] = await DB.batch([
          q("SELECT owner, COUNT(*) n FROM tasks WHERE status='open' GROUP BY owner"),
          q("SELECT COUNT(*) n FROM tasks WHERE status='open' AND due < ?", t),
          q("SELECT COUNT(*) n FROM tasks WHERE status='open' AND due >= ? AND due <= ?", t, wk),
          q("SELECT j.stage, COUNT(*) n FROM jobs j LEFT JOIN contacts c ON c.id=j.contact_id WHERE IFNULL(c.archived,0)=0 GROUP BY j.stage"),
          q("SELECT COUNT(*) n FROM contacts WHERE kind='customer' AND archived=0"),
          q("SELECT id,title,due,owner,status FROM tasks WHERE key_date=1 AND status='open' ORDER BY due LIMIT 5"),
          q("SELECT at,who,kind,note FROM activity ORDER BY id DESC LIMIT 8")
        ]);
        const done = await q("SELECT COUNT(*) n FROM tasks WHERE status='done'").first();
        const board = (await q("SELECT done_by, COUNT(*) n FROM tasks WHERE status='done' AND done_by IS NOT NULL AND substr(done_at,1,10) >= ? GROUP BY done_by", addDays(t, -6)).all()).results;
        return json(req, {
          ok: true, user: who, today: t, launch: LAUNCH,
          open: open.results, overdue: overdue.results[0].n, this_week: week.results[0].n, done: done.n,
          stages: stages.results, contacts: contacts.results[0].n, key_dates: keys.results, recent: recent.results, board
        });
      }

      /* tasks */
      if (p === '/tasks' && req.method === 'GET') {
        const st = url.searchParams.get('status') || 'open';
        const owner = url.searchParams.get('owner');
        let sql = 'SELECT * FROM tasks WHERE 1=1', a = [];
        if (st !== 'all') { sql += ' AND status=?'; a.push(st); }
        if (owner && owner !== 'all') { sql += " AND (owner=? OR owner='both')"; a.push(owner); }
        const tq = s(url.searchParams.get('q'));
        if (tq) { sql += ' AND (title LIKE ? OR notes LIKE ? OR area LIKE ? OR source LIKE ?)'; const l = '%' + tq + '%'; a.push(l, l, l, l); }
        sql += st === 'done' ? ' ORDER BY done_at DESC LIMIT 200' : st === 'all' ? " ORDER BY status='done', due IS NULL, due, id LIMIT 500" : ' ORDER BY due IS NULL, due, id LIMIT 500';
        const r = await DB.prepare(sql).bind(...a).all();
        return json(req, { ok: true, today: today(), tasks: r.results });
      }
      if (p === '/tasks' && req.method === 'POST') {
        const b = await body(req);
        if (!s(b.title)) return json(req, { ok: false, error: 'title required' }, 400);
        const r = await DB.prepare('INSERT INTO tasks (title,owner,due,area,notes,job_id,key_date,source,repeat) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(s(b.title), OWNERS.includes(b.owner) ? b.owner : who, s(b.due), s(b.area), s(b.notes), b.job_id || null, b.key_date ? 1 : 0, 'Added by ' + who, REPEAT.includes(b.repeat) ? b.repeat : null).run();
        await log(env, who, 'task_add', b.job_id ? 'job' : 'task', b.job_id || r.meta.last_row_id, b.title);
        return json(req, { ok: true, id: r.meta.last_row_id });
      }
      let m = p.match(/^\/tasks\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
        const n = {
          title: b.title !== undefined ? s(b.title) : cur.title,
          owner: OWNERS.includes(b.owner) ? b.owner : cur.owner,
          due: b.due !== undefined ? s(b.due) : cur.due,
          notes: b.notes !== undefined ? s(b.notes) : cur.notes,
          status: ['open', 'done'].includes(b.status) ? b.status : cur.status,
          repeat: b.repeat !== undefined ? (REPEAT.includes(b.repeat) ? b.repeat : null) : cur.repeat
        };
        const doneAt = n.status === 'done' ? (cur.done_at || new Date().toISOString()) : null;
        await DB.prepare('UPDATE tasks SET title=?,owner=?,due=?,notes=?,status=?,done_at=?,done_by=?,repeat=? WHERE id=?')
          .bind(n.title, n.owner, n.due, n.notes, n.status, doneAt, n.status === 'done' ? (cur.done_by || who) : null, n.repeat, id).run();
        const kind = n.status !== cur.status ? (n.status === 'done' ? 'task_done' : 'task_reopen') : 'task_edit';
        await log(env, who, kind, cur.job_id ? 'job' : 'task', cur.job_id || id, n.title);
        let next = null;
        if (n.repeat && n.status === 'done' && cur.status !== 'done' && !cur.next_id) {
          const nx = await DB.prepare('INSERT INTO tasks (title,owner,due,area,notes,key_date,source,repeat,role_id) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind(n.title, n.owner, nextDue(n.due, n.repeat), cur.area, n.notes, cur.key_date || 0, 'Repeats ' + n.repeat, n.repeat, cur.role_id || null).run();
          next = nx.meta.last_row_id;
          await DB.prepare('UPDATE tasks SET next_id=? WHERE id=?').bind(next, id).run();
        }
        if (n.status === 'open' && cur.status === 'done' && cur.next_id) {
          // undo of a repeating task: remove the copy it made if nobody touched it yet
          await DB.prepare("DELETE FROM tasks WHERE id=? AND status='open'").bind(cur.next_id).run();
          await DB.prepare('UPDATE tasks SET next_id=NULL WHERE id=?').bind(id).run();
        }
        return json(req, { ok: true, next });
      }

      /* contacts */
      if (p === '/contacts' && req.method === 'GET') {
        const qs = s(url.searchParams.get('q'));
        const view = url.searchParams.get('view') || 'active';
        const kind = url.searchParams.get('kind');
        let where = ' WHERE 1=1', a = [];
        if (view === 'active') where += ' AND c.archived=0';
        else if (view === 'archived') where += ' AND c.archived=1';
        if (kind && ['customer', 'partner', 'vendor'].includes(kind)) { where += ' AND c.kind=?'; a.push(kind); }
        if (qs) {
          const l = '%' + qs + '%';
          where += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ? OR c.neighborhood LIKE ? OR c.notes LIKE ?)';
          a.push(l, l, l, l, l, l);
        }
        const r = await DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM jobs j WHERE j.contact_id=c.id) jobs,
            (SELECT stage FROM jobs j WHERE j.contact_id=c.id ORDER BY j.id DESC LIMIT 1) last_stage,
            (SELECT COUNT(*) FROM tasks t JOIN jobs j ON j.id=t.job_id WHERE j.contact_id=c.id AND t.status='open') open_tasks
            FROM contacts c` + where + ' ORDER BY c.updated_at DESC, c.id DESC LIMIT 500').bind(...a).all();
        const counts = await DB.prepare(`SELECT SUM(archived=0 AND kind='customer') customers, SUM(archived=0 AND kind='partner') partners,
            SUM(archived=0 AND kind='vendor') vendors, SUM(archived=1) archived FROM contacts`).first();
        return json(req, { ok: true, contacts: r.results, counts });
      }
      if (p === '/contacts/bulk' && req.method === 'POST') {
        const b = await body(req);
        const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(n => n > 0).slice(0, 200);
        if (!ids.length || !['archive', 'unarchive', 'delete'].includes(b.action)) return json(req, { ok: false, error: 'bad request' }, 400);
        let n = 0;
        for (const id of ids) n += (await contactAction(env, DB, who, id, b.action)) ? 1 : 0;
        return json(req, { ok: true, changed: n });
      }
      if (p === '/contacts' && req.method === 'POST') {
        const b = await body(req);
        if (!s(b.name)) return json(req, { ok: false, error: 'name required' }, 400);
        const r = await DB.prepare('INSERT INTO contacts (name,phone,email,address,neighborhood,source,kind,notes) VALUES (?,?,?,?,?,?,?,?)')
          .bind(s(b.name), s(b.phone), s(b.email), s(b.address), s(b.neighborhood), s(b.source), s(b.kind) || 'customer', s(b.notes)).run();
        await log(env, who, 'contact_add', 'contact', r.meta.last_row_id, b.name);
        return json(req, { ok: true, id: r.meta.last_row_id });
      }

      /* jobs */
      if (p === '/jobs' && req.method === 'GET') {
        const all = url.searchParams.get('all') === '1';
        const r = await DB.prepare(`SELECT j.*, c.name, c.phone, c.email, c.address, c.source, c.archived
          FROM jobs j LEFT JOIN contacts c ON c.id=j.contact_id` + (all ? '' : ' WHERE IFNULL(c.archived,0)=0') + ' ORDER BY j.updated_at DESC LIMIT 300').all();
        return json(req, { ok: true, stages: STAGES, jobs: r.results });
      }
      if (p === '/jobs' && req.method === 'POST') {
        const b = await body(req);
        let cid = b.contact_id;
        if (!cid) {
          if (!s(b.name)) return json(req, { ok: false, error: 'name required' }, 400);
          const c = await DB.prepare('INSERT INTO contacts (name,phone,email,address,source) VALUES (?,?,?,?,?)')
            .bind(s(b.name), s(b.phone), s(b.email), s(b.address), s(b.source) || 'other').run();
          cid = c.meta.last_row_id;
        }
        const r = await DB.prepare('INSERT INTO jobs (contact_id,service,stage,owner,partner,notes) VALUES (?,?,?,?,?,?)')
          .bind(cid, s(b.service), STAGES.includes(b.stage) ? b.stage : 'lead', s(b.owner) || who, s(b.partner), s(b.notes)).run();
        await log(env, who, 'job_add', 'job', r.meta.last_row_id, (b.name || '') + (b.service ? ' (' + b.service + ')' : ''));
        return json(req, { ok: true, id: r.meta.last_row_id });
      }
      m = p.match(/^\/jobs\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
        const stage = STAGES.includes(b.stage) ? b.stage : cur.stage;
        await DB.prepare("UPDATE jobs SET stage=?,service=?,owner=?,partner=?,scheduled_for=?,notes=?,updated_at=datetime('now') WHERE id=?")
          .bind(stage, b.service !== undefined ? s(b.service) : cur.service, b.owner !== undefined ? s(b.owner) : cur.owner,
            b.partner !== undefined ? s(b.partner) : cur.partner, b.scheduled_for !== undefined ? s(b.scheduled_for) : cur.scheduled_for,
            b.notes !== undefined ? s(b.notes) : cur.notes, id).run();
        if (stage !== cur.stage) await log(env, who, 'job_stage', 'job', id, cur.stage + ' to ' + stage);
        else await log(env, who, 'job_edit', 'job', id, null);
        if (stage === 'done' && cur.stage !== 'done') {
          await DB.prepare("INSERT INTO tasks (title,owner,due,area,source,job_id) VALUES (?,?,?,?,?,?)")
            .bind('Closeout: photos, thank you card, review ask (job #' + id + ')', cur.owner || who, today(), 'sales', 'Closeout SOP', id).run();
        }
        return json(req, { ok: true });
      }

      m = p.match(/^\/contacts\/(\d+)$/);
      if (m && req.method === 'GET') {
        const id = +m[1];
        const c = await DB.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first();
        if (!c) return json(req, { ok: false, error: 'not found' }, 404);
        const jobs = await DB.prepare('SELECT * FROM jobs WHERE contact_id=? ORDER BY id DESC').bind(id).all();
        const ids = jobs.results.map(j => j.id);
        const act = await DB.prepare(`SELECT * FROM activity WHERE (ref_type='contact' AND ref_id=?)` +
          (ids.length ? ` OR (ref_type='job' AND ref_id IN (${ids.map(() => '?').join(',')}))` : '') + ' ORDER BY id DESC LIMIT 100').bind(id, ...ids).all();
        return json(req, { ok: true, contact: c, jobs: jobs.results, activity: act.results });
      }
      if (m && req.method === 'DELETE') {
        const ok = await contactAction(env, DB, who, +m[1], 'delete');
        return ok ? json(req, { ok: true }) : json(req, { ok: false, error: 'not found' }, 404);
      }
      if (m && req.method === 'PATCH') {
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
        if (b.archived !== undefined && Object.keys(b).length === 1) {
          await contactAction(env, DB, who, id, b.archived ? 'archive' : 'unarchive');
          return json(req, { ok: true });
        }
        const f = ['name', 'phone', 'email', 'address', 'neighborhood', 'source', 'kind', 'notes'];
        const v = f.map(k => b[k] !== undefined ? s(b[k]) : cur[k]);
        if (!v[0]) return json(req, { ok: false, error: 'name required' }, 400);
        await DB.prepare("UPDATE contacts SET name=?,phone=?,email=?,address=?,neighborhood=?,source=?,kind=?,notes=?,updated_at=datetime('now') WHERE id=?").bind(...v, id).run();
        await log(env, who, 'contact_edit', 'contact', id, v[0]);
        return json(req, { ok: true });
      }
      m = p.match(/^\/jobs\/(\d+)$/);
      if (m && req.method === 'GET') {
        const id = +m[1];
        const j = await DB.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
        if (!j) return json(req, { ok: false, error: 'not found' }, 404);
        const c = j.contact_id ? await DB.prepare('SELECT * FROM contacts WHERE id=?').bind(j.contact_id).first() : null;
        const t = await DB.prepare('SELECT * FROM tasks WHERE job_id=? ORDER BY status, due').bind(id).all();
        const a = await DB.prepare("SELECT * FROM activity WHERE (ref_type='job' AND ref_id=?) OR (ref_type='contact' AND ref_id=?) ORDER BY id DESC LIMIT 100").bind(id, j.contact_id || -1).all();
        return json(req, { ok: true, job: j, contact: c, tasks: t.results, activity: a.results });
      }
      if (p === '/notes' && req.method === 'POST') {
        const b = await body(req);
        if (!['job', 'contact', 'task'].includes(b.ref_type) || !b.ref_id || !s(b.note)) return json(req, { ok: false, error: 'note required' }, 400);
        await log(env, who, 'note', b.ref_type, +b.ref_id, b.note);
        if (b.ref_type === 'job') await DB.prepare("UPDATE jobs SET updated_at=datetime('now') WHERE id=?").bind(+b.ref_id).run();
        return json(req, { ok: true });
      }

      /* roles: blind 1-10 ratings, Ricky locks owners */
      if (p === '/roles' && req.method === 'GET') {
        const roles = (await DB.prepare('SELECT * FROM roles WHERE active=1 ORDER BY sort, id').all()).results;
        const ids = new Set(roles.map(r => r.id));
        const sc = (await DB.prepare('SELECT * FROM role_scores').all()).results.filter(x => ids.has(x.role_id));
        const progress = {};
        for (const u of USERS) progress[u] = sc.filter(x => x.user === u && x.skill && x.want && x.vote).length;
        let revealed = !!(await DB.prepare("SELECT v FROM settings WHERE k='roles_revealed'").first());
        if (!revealed && roles.length && USERS.every(u => progress[u] >= roles.length)) {
          await DB.prepare("INSERT OR REPLACE INTO settings (k,v) VALUES ('roles_revealed', datetime('now'))").run();
          await log(env, 'system', 'roles_reveal', null, null, 'Everyone finished rating roles');
          revealed = true;
        }
        const sug = (await DB.prepare('SELECT * FROM role_suggestions ORDER BY id DESC LIMIT 100').all()).results;
        const tc = (await DB.prepare("SELECT role_id, COUNT(*) n, SUM(owner='both') unassigned FROM tasks WHERE status='open' AND role_id IS NOT NULL GROUP BY role_id").all()).results;
        const tcm = {}; for (const x of tc) tcm[x.role_id] = x;
        roles.forEach(r => { r.tasks_open = tcm[r.id] ? tcm[r.id].n : 0; r.tasks_unassigned = tcm[r.id] ? tcm[r.id].unassigned : 0; });
        return json(req, { ok: true, user: who, roles, total: roles.length, progress, revealed,
          mine: sc.filter(x => x.user === who), scores: revealed ? sc : [], suggestions: sug });
      }
      m = p.match(/^\/roles\/(\d+)\/score$/);
      if (m && req.method === 'POST') {
        const id = +m[1], b = await body(req);
        const r = await DB.prepare('SELECT id FROM roles WHERE id=? AND active=1').bind(id).first();
        if (!r) return json(req, { ok: false, error: 'not found' }, 404);
        const n = v => { const x = parseInt(v, 10); return x >= 1 && x <= 10 ? x : null; };
        const cur = await DB.prepare('SELECT * FROM role_scores WHERE role_id=? AND user=?').bind(id, who).first();
        const skill = b.skill !== undefined ? n(b.skill) : (cur ? cur.skill : null);
        const want = b.want !== undefined ? n(b.want) : (cur ? cur.want : null);
        const vote = b.vote !== undefined ? (USERS.includes(b.vote) ? b.vote : null) : (cur ? cur.vote : null);
        await DB.prepare("INSERT INTO role_scores (role_id,user,skill,want,vote) VALUES (?,?,?,?,?) ON CONFLICT(role_id,user) DO UPDATE SET skill=excluded.skill, want=excluded.want, vote=excluded.vote, at=datetime('now')")
          .bind(id, who, skill, want, vote).run();
        const tot = await DB.prepare('SELECT COUNT(*) n FROM roles WHERE active=1').first();
        const mineDone = await DB.prepare('SELECT COUNT(*) n FROM role_scores s JOIN roles r ON r.id=s.role_id WHERE r.active=1 AND s.user=? AND s.skill IS NOT NULL AND s.want IS NOT NULL AND s.vote IS NOT NULL').bind(who).first();
        const wasDone = cur && cur.skill && cur.want && cur.vote;
        if (!wasDone && skill && want && vote && mineDone.n === tot.n) await log(env, who, 'roles_done', null, null, 'Finished rating every role');
        return json(req, { ok: true, done: mineDone.n, total: tot.n });
      }
      m = p.match(/^\/roles\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        if (who !== 'ricky') return json(req, { ok: false, error: 'Ricky makes the final call' }, 403);
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM roles WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
        const owner = b.owner !== undefined ? (USERS.includes(b.owner) || b.owner === 'shared' ? b.owner : null) : cur.owner;
        const active = b.active !== undefined ? (b.active ? 1 : 0) : cur.active;
        await DB.prepare('UPDATE roles SET owner=?, notes=?, active=? WHERE id=?').bind(owner, b.notes !== undefined ? s(b.notes) : cur.notes, active, id).run();
        if (owner !== cur.owner) await log(env, who, 'role_owner', 'role', id, cur.name + ': ' + (owner ? (owner === 'shared' ? 'shared' : owner) : 'open'));
        if (active !== cur.active) await log(env, who, active ? 'role_restore' : 'role_remove', 'role', id, cur.name);
        return json(req, { ok: true });
      }
      m = p.match(/^\/roles\/(\d+)\/assign$/);
      if (m && req.method === 'POST') {
        if (who !== 'ricky') return json(req, { ok: false, error: 'Ricky makes the final call' }, 403);
        const role = await DB.prepare('SELECT * FROM roles WHERE id=?').bind(+m[1]).first();
        if (!role) return json(req, { ok: false, error: 'not found' }, 404);
        if (!USERS.includes(role.owner)) return json(req, { ok: false, error: 'pick one person as owner first' }, 400);
        const r = await DB.prepare("UPDATE tasks SET owner=? WHERE role_id=? AND status='open' AND owner='both'").bind(role.owner, role.id).run();
        await log(env, who, 'role_assign', 'role', role.id, role.name + ': ' + r.meta.changes + ' tasks to ' + role.owner);
        return json(req, { ok: true, moved: r.meta.changes });
      }

      /* Sunday check in */
      if (p === '/checkin' && req.method === 'GET') {
        const t = today(), wk = sundayOf(t), since = addDays(t, -7), ahead = addDays(t, 7);
        const closed = (await DB.prepare("SELECT id,title,done_by,done_at,owner FROM tasks WHERE status='done' AND substr(done_at,1,10) >= ? ORDER BY done_by, done_at DESC").bind(since).all()).results;
        const due = (await DB.prepare("SELECT id,title,due,owner,area FROM tasks WHERE status='open' AND due >= ? AND due <= ? ORDER BY owner, due").bind(t, ahead).all()).results;
        const over = (await DB.prepare("SELECT id,title,due,owner,area FROM tasks WHERE status='open' AND due < ? ORDER BY due").bind(t).all()).results;
        const leads = (await DB.prepare("SELECT COUNT(*) n FROM jobs WHERE substr(created_at,1,10) >= ?").bind(since).first()).n;
        const roles = (await DB.prepare('SELECT COUNT(*) n FROM roles WHERE active=1').first()).n;
        const rated = (await DB.prepare("SELECT s.user, COUNT(*) n FROM role_scores s JOIN roles r ON r.id=s.role_id WHERE r.active=1 AND s.skill IS NOT NULL AND s.want IS NOT NULL AND s.vote IS NOT NULL GROUP BY s.user").all()).results;
        const revealed = !!(await DB.prepare("SELECT v FROM settings WHERE k='roles_revealed'").first());
        const notes = (await DB.prepare('SELECT * FROM checkin_notes ORDER BY week DESC LIMIT 6').all()).results;
        return json(req, { ok: true, user: who, today: t, week: wk, closed, due, overdue: over, new_leads: leads, roles: { total: roles, rated, revealed }, notes });
      }
      if (p === '/checkin/notes' && req.method === 'POST') {
        const b = await body(req);
        const wk = /^\d{4}-\d{2}-\d{2}$/.test(b.week || '') ? b.week : sundayOf(today());
        await DB.prepare("INSERT INTO checkin_notes (week,notes,updated_by,updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(week) DO UPDATE SET notes=excluded.notes, updated_by=excluded.updated_by, updated_at=excluded.updated_at")
          .bind(wk, s(b.notes) || '', who).run();
        await log(env, who, 'checkin_notes', null, null, 'Week of ' + wk);
        return json(req, { ok: true, week: wk });
      }
      if (p === '/digest/test' && req.method === 'POST') {
        if (who !== 'ricky') return json(req, { ok: false, error: 'Ricky only' }, 403);
        const sent = await sendDigests(env, 'ricky');
        return json(req, { ok: true, sent });
      }

      if (p === '/roles/suggest' && req.method === 'POST') {
        const b = await body(req);
        if (!s(b.name)) return json(req, { ok: false, error: 'name required' }, 400);
        const r = await DB.prepare('INSERT INTO role_suggestions (who,name,note) VALUES (?,?,?)').bind(who, s(b.name).slice(0, 120), s(b.note)).run();
        await log(env, who, 'role_suggest', 'role_suggestion', r.meta.last_row_id, b.name);
        return json(req, { ok: true, id: r.meta.last_row_id });
      }
      m = p.match(/^\/roles\/suggest\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        if (who !== 'ricky') return json(req, { ok: false, error: 'Ricky makes the final call' }, 403);
        const id = +m[1], b = await body(req);
        const sg = await DB.prepare('SELECT * FROM role_suggestions WHERE id=?').bind(id).first();
        if (!sg) return json(req, { ok: false, error: 'not found' }, 404);
        if (!['added', 'passed', 'open'].includes(b.status)) return json(req, { ok: false, error: 'bad status' }, 400);
        let roleId = sg.role_id;
        if (b.status === 'added' && !roleId) {
          const r = await DB.prepare('INSERT INTO roles (name,blurb,sort) VALUES (?,?,(SELECT IFNULL(MAX(sort),0)+1 FROM roles))').bind(sg.name, sg.note).run();
          roleId = r.meta.last_row_id;
        }
        await DB.prepare("UPDATE role_suggestions SET status=?, role_id=?, decided_at=datetime('now') WHERE id=?").bind(b.status, roleId, id).run();
        await log(env, who, 'role_suggest_' + b.status, 'role_suggestion', id, sg.name);
        return json(req, { ok: true, role_id: roleId });
      }

      /* gear inventory */
      if (p === '/gear' && req.method === 'GET') {
        const items = await DB.prepare('SELECT * FROM gear ORDER BY sort, id').all();
        const own = await DB.prepare('SELECT gear_id, user, note, at FROM gear_owners').all();
        const by = {};
        for (const o of own.results) (by[o.gear_id] = by[o.gear_id] || []).push(o);
        return json(req, { ok: true, items: items.results.map(i => ({ ...i, owners: by[i.id] || [] })) });
      }
      if (p === '/gear' && req.method === 'POST') {
        const b = await body(req);
        if (!s(b.name)) return json(req, { ok: false, error: 'name required' }, 400);
        const svc = ',' + (Array.isArray(b.services) ? b.services : String(b.services || 'shared').split(',')).map(x => String(x).trim()).filter(Boolean).join(',') + ',';
        const r = await DB.prepare('INSERT INTO gear (name,services,category,priority,qty,notes,sort) VALUES (?,?,?,?,?,?,999)')
          .bind(s(b.name), svc, s(b.category) || 'Other', b.priority === 'nice' ? 'nice' : 'must', s(b.qty), s(b.notes)).run();
        await log(env, who, 'gear_add', 'gear', r.meta.last_row_id, b.name);
        return json(req, { ok: true, id: r.meta.last_row_id });
      }
      m = p.match(/^\/gear\/(\d+)\/have$/);
      if (m && req.method === 'POST') {
        const id = +m[1], b = await body(req);
        const g = await DB.prepare('SELECT name FROM gear WHERE id=?').bind(id).first();
        if (!g) return json(req, { ok: false, error: 'not found' }, 404);
        if (b.have) {
          await DB.prepare("INSERT INTO gear_owners (gear_id,user,note) VALUES (?,?,?) ON CONFLICT(gear_id,user) DO UPDATE SET note=excluded.note, at=datetime('now')").bind(id, who, s(b.note)).run();
          await log(env, who, 'gear_have', 'gear', id, g.name);
        } else {
          await DB.prepare('DELETE FROM gear_owners WHERE gear_id=? AND user=?').bind(id, who).run();
          await log(env, who, 'gear_unhave', 'gear', id, g.name);
        }
        return json(req, { ok: true });
      }
      m = p.match(/^\/gear\/(\d+)$/);
      if (m && req.method === 'PATCH') {
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM gear WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
        const num = v => (v === '' || v === null) ? null : (isNaN(+v) ? null : +v);
        const svc = b.services !== undefined ? ',' + (Array.isArray(b.services) ? b.services : String(b.services).split(',')).map(x => String(x).trim()).filter(Boolean).join(',') + ',' : cur.services;
        const bs = ['need', 'buying', 'bought'].includes(b.buy_status) ? b.buy_status : cur.buy_status;
        await DB.prepare("UPDATE gear SET name=?,services=?,category=?,priority=?,qty=?,est_low=?,est_high=?,buy_status=?,buy_by=?,notes=?,updated_at=datetime('now') WHERE id=?")
          .bind(b.name !== undefined ? (s(b.name) || cur.name) : cur.name, svc, b.category !== undefined ? s(b.category) : cur.category,
            b.priority === 'nice' || b.priority === 'must' ? b.priority : cur.priority, b.qty !== undefined ? s(b.qty) : cur.qty,
            b.est_low !== undefined ? num(b.est_low) : cur.est_low, b.est_high !== undefined ? num(b.est_high) : cur.est_high,
            bs, bs !== cur.buy_status ? who : cur.buy_by, b.notes !== undefined ? s(b.notes) : cur.notes, id).run();
        await log(env, who, bs !== cur.buy_status ? 'gear_' + bs : 'gear_edit', 'gear', id, cur.name);
        return json(req, { ok: true });
      }
      if (m && req.method === 'DELETE') {
        const g = await DB.prepare('SELECT name FROM gear WHERE id=?').bind(+m[1]).first();
        if (!g) return json(req, { ok: false, error: 'not found' }, 404);
        await DB.batch([DB.prepare('DELETE FROM gear_owners WHERE gear_id=?').bind(+m[1]), DB.prepare('DELETE FROM gear WHERE id=?').bind(+m[1])]);
        await log(env, who, 'gear_delete', null, null, g.name);
        return json(req, { ok: true });
      }

      if (p === '/activity') {
        const r = await DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 50').all();
        return json(req, { ok: true, activity: r.results });
      }
      return json(req, { ok: false, error: 'not found' }, 404);
    } catch (e) {
      return json(req, { ok: false, error: 'server error' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    if (event.cron === '0 13 * * 1') ctx.waitUntil(sendDigests(env));
  }
};
