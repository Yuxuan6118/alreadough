-- Codes that add Dough Atelier days, one row per account and kind.
--   'invite'  the invitation code (30 days), handed out by the founder; once per account
--   'trial'   the old 7-day code (given out until 2026-11-20); copied from member_referrals so running weeks keep going
-- Days are stored as a window: a code redeemed while Atelier already runs starts when that ends, so no day is lost.
CREATE TABLE IF NOT EXISTS member_codes (
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  code TEXT NOT NULL,
  starts_at_ms INTEGER NOT NULL,
  ends_at_ms INTEGER NOT NULL,
  redeemed_at_ms INTEGER NOT NULL,
  PRIMARY KEY (account_id, kind)
);
INSERT OR IGNORE INTO member_codes (account_id, kind, code, starts_at_ms, ends_at_ms, redeemed_at_ms)
  SELECT account_id, 'trial', code, redeemed_at_ms, redeemed_at_ms + 604800000, redeemed_at_ms FROM member_referrals;
