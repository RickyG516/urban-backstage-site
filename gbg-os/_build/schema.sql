CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, neighborhood TEXT,
  source TEXT,              -- form, hanger, facebook, referral, phone, other
  kind TEXT DEFAULT 'customer', -- customer, partner, vendor
  archived INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id),
  service TEXT,             -- lights, sealing, spraying, trash, epoxy, junk, painting, landscaping, tree
  stage TEXT NOT NULL DEFAULT 'lead', -- lead, consult, estimate, booked, done, review, lost
  owner TEXT,               -- ricky, doug
  partner TEXT,             -- set when routed to a partner
  scheduled_for TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'ricky', -- ricky, doug, both
  due TEXT,                 -- YYYY-MM-DD
  area TEXT,                -- compliance, legal, admin, finance, marketing, website, partners, ops
  gate TEXT, source TEXT,
  key_date INTEGER DEFAULT 0,
  job_id INTEGER REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'open', -- open, done
  notes TEXT,
  done_at TEXT, done_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT (datetime('now')),
  who TEXT, kind TEXT, ref_type TEXT, ref_id INTEGER, note TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(status, due);
CREATE INDEX IF NOT EXISTS idx_jobs_stage ON jobs(stage);

CREATE TABLE IF NOT EXISTS gear (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, services TEXT, category TEXT, priority TEXT DEFAULT 'must', qty TEXT, est_low REAL, est_high REAL, buy_status TEXT DEFAULT 'need', buy_by TEXT, notes TEXT, sort INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS gear_owners (gear_id INTEGER NOT NULL, user TEXT NOT NULL, note TEXT, at TEXT DEFAULT (datetime('now')), PRIMARY KEY (gear_id, user));
CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, blurb TEXT, sort INTEGER DEFAULT 0, owner TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS role_scores (role_id INTEGER NOT NULL, user TEXT NOT NULL, skill INTEGER, want INTEGER, at TEXT DEFAULT (datetime('now')), PRIMARY KEY (role_id, user));
CREATE TABLE IF NOT EXISTS role_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT NOT NULL, name TEXT NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'open', role_id INTEGER, at TEXT DEFAULT (datetime('now')), decided_at TEXT);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
