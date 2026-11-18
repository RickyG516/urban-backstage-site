/* gbg-os-api: GBG Dubuque CRM backend.
 * D1 binding: DB (gbg-os). Secrets: PIN_RICKY, PIN_DOUG, TOKEN_SECRET, FORM_TOKEN.
 * No secrets live in this file. Browser sends x-gbg-user + x-gbg-key (HMAC of user).
 * Deploy runbook: gbg-os/_build/WORKER.md */

const ORIGINS = ['https://urbanbackstage.com', 'http://localhost:8765'];
const USERS = ['ricky', 'doug'];
const STAGES = ['lead', 'consult', 'estimate', 'booked', 'done', 'review', 'lost'];
const LAUNCH = '2027-04-01';

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, x-gbg-user, x-gbg-key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

/* ---------- routes ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    try {
      if (p === '/') return json(req, { ok: true, service: 'gbg-os-api' });
      if (p === '/inbound' && req.method === 'POST') return inbound(req, env, url);

      if (p === '/pin' && req.method === 'POST') {
        const b = await body(req);
        const u = String(b.user || '').toLowerCase();
        const want = u === 'ricky' ? env.PIN_RICKY : u === 'doug' ? env.PIN_DOUG : null;
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
          q("SELECT stage, COUNT(*) n FROM jobs GROUP BY stage"),
          q("SELECT COUNT(*) n FROM contacts WHERE kind='customer'"),
          q("SELECT id,title,due,owner,status FROM tasks WHERE key_date=1 AND status='open' ORDER BY due LIMIT 5"),
          q("SELECT at,who,kind,note FROM activity ORDER BY id DESC LIMIT 8")
        ]);
        const done = await q("SELECT COUNT(*) n FROM tasks WHERE status='done'").first();
        return json(req, {
          ok: true, user: who, today: t, launch: LAUNCH,
          open: open.results, overdue: overdue.results[0].n, this_week: week.results[0].n, done: done.n,
          stages: stages.results, contacts: contacts.results[0].n, key_dates: keys.results, recent: recent.results
        });
      }

      /* tasks */
      if (p === '/tasks' && req.method === 'GET') {
        const st = url.searchParams.get('status') || 'open';
        const owner = url.searchParams.get('owner');
        let sql = 'SELECT * FROM tasks WHERE 1=1', a = [];
        if (st !== 'all') { sql += ' AND status=?'; a.push(st); }
        if (owner && owner !== 'all') { sql += " AND (owner=? OR owner='both')"; a.push(owner); }
        sql += st === 'done' ? ' ORDER BY done_at DESC LIMIT 200' : ' ORDER BY due IS NULL, due, id LIMIT 500';
        const r = await DB.prepare(sql).bind(...a).all();
        return json(req, { ok: true, today: today(), tasks: r.results });
      }
      if (p === '/tasks' && req.method === 'POST') {
        const b = await body(req);
        if (!s(b.title)) return json(req, { ok: false, error: 'title required' }, 400);
        const r = await DB.prepare('INSERT INTO tasks (title,owner,due,area,notes,job_id,key_date,source) VALUES (?,?,?,?,?,?,?,?)')
          .bind(s(b.title), ['ricky', 'doug', 'both'].includes(b.owner) ? b.owner : who, s(b.due), s(b.area), s(b.notes), b.job_id || null, b.key_date ? 1 : 0, 'Added by ' + who).run();
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
          owner: ['ricky', 'doug', 'both'].includes(b.owner) ? b.owner : cur.owner,
          due: b.due !== undefined ? s(b.due) : cur.due,
          notes: b.notes !== undefined ? s(b.notes) : cur.notes,
          status: ['open', 'done'].includes(b.status) ? b.status : cur.status
        };
        const doneAt = n.status === 'done' ? (cur.done_at || new Date().toISOString()) : null;
        await DB.prepare('UPDATE tasks SET title=?,owner=?,due=?,notes=?,status=?,done_at=?,done_by=? WHERE id=?')
          .bind(n.title, n.owner, n.due, n.notes, n.status, doneAt, n.status === 'done' ? (cur.done_by || who) : null, id).run();
        const kind = n.status !== cur.status ? (n.status === 'done' ? 'task_done' : 'task_reopen') : 'task_edit';
        await log(env, who, kind, cur.job_id ? 'job' : 'task', cur.job_id || id, n.title);
        return json(req, { ok: true });
      }

      /* contacts */
      if (p === '/contacts' && req.method === 'GET') {
        const qs = url.searchParams.get('q');
        const r = qs
          ? await DB.prepare("SELECT * FROM contacts WHERE name LIKE ? OR phone LIKE ? OR address LIKE ? ORDER BY id DESC LIMIT 100").bind('%' + qs + '%', '%' + qs + '%', '%' + qs + '%').all()
          : await DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM jobs j WHERE j.contact_id=c.id) jobs,
              (SELECT stage FROM jobs j WHERE j.contact_id=c.id ORDER BY j.id DESC LIMIT 1) last_stage
              FROM contacts c ORDER BY c.updated_at DESC, c.id DESC LIMIT 300`).all();
        return json(req, { ok: true, contacts: r.results });
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
        const r = await DB.prepare(`SELECT j.*, c.name, c.phone, c.email, c.address, c.source
          FROM jobs j LEFT JOIN contacts c ON c.id=j.contact_id ORDER BY j.updated_at DESC LIMIT 300`).all();
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
      if (m && req.method === 'PATCH') {
        const id = +m[1], b = await body(req);
        const cur = await DB.prepare('SELECT * FROM contacts WHERE id=?').bind(id).first();
        if (!cur) return json(req, { ok: false, error: 'not found' }, 404);
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

      if (p === '/activity') {
        const r = await DB.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 50').all();
        return json(req, { ok: true, activity: r.results });
      }
      return json(req, { ok: false, error: 'not found' }, 404);
    } catch (e) {
      return json(req, { ok: false, error: 'server error' }, 500);
    }
  }
};
