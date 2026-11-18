CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT, email TEXT, address TEXT, neighborhood TEXT,
  source TEXT,              -- form, hanger, facebook, referral, phone, other
  kind TEXT DEFAULT 'customer', -- customer, partner, vendor
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
