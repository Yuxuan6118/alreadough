-- Page crashes reported by browsers: the error message, a short stack, the page path and the kind of device.
-- No account, device id or user content. Kept 30 days (the daily cleanup in lib/maintenance.ts removes older rows).
CREATE TABLE IF NOT EXISTS client_errors (
  id TEXT PRIMARY KEY NOT NULL,
  created_at_ms INTEGER NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  device TEXT,
  os TEXT,
  browser TEXT
);
CREATE INDEX IF NOT EXISTS client_errors_created ON client_errors (created_at_ms);

-- Which devices an account has been used on, so "clear everything" also removes what its other devices left behind
-- (chat samples, feedback, reports and usage counters are recorded per device).
CREATE TABLE IF NOT EXISTS account_devices (
  account_id TEXT NOT NULL,
  device_key TEXT NOT NULL,
  first_seen_ms INTEGER NOT NULL,
  PRIMARY KEY (account_id, device_key)
);

-- When a sign-in limit counter was last used, so the daily cleanup can drop old ones (rows from before this have none).
ALTER TABLE member_auth_limits ADD COLUMN updated_at_ms INTEGER;
