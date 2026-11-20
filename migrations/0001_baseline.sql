-- Baseline: every table the app used before migrations existed, exactly as production had them on 2026-11-20.
-- IF NOT EXISTS makes this a no-op on production and creates everything on a fresh (local or test) database.

CREATE TABLE IF NOT EXISTS beta_conversations (id TEXT PRIMARY KEY NOT NULL, user_hash TEXT NOT NULL, created_at TEXT NOT NULL, mode TEXT NOT NULL, coach_mode TEXT, wish_category TEXT, lang TEXT, context TEXT, user_text TEXT NOT NULL, ai_reply TEXT NOT NULL, model TEXT, feedback TEXT, feedback_at TEXT);
CREATE TABLE IF NOT EXISTS beta_events (id TEXT PRIMARY KEY NOT NULL, user_hash TEXT NOT NULL, event_type TEXT NOT NULL, mode TEXT, wish_category TEXT, coach_mode TEXT, prompt_version TEXT, feedback TEXT, rating_before INTEGER, rating_after INTEGER, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS beta_global_daily (usage_date TEXT PRIMARY KEY NOT NULL, request_count INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, failed_requests INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS beta_profiles (user_hash TEXT PRIMARY KEY NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 1, country TEXT, region TEXT, city TEXT, timezone TEXT, lang TEXT, device TEXT, os TEXT, browser TEXT);
CREATE TABLE IF NOT EXISTS beta_reports (id TEXT PRIMARY KEY NOT NULL, user_hash TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT, reply_excerpt TEXT, lang TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, handled_at TEXT);
CREATE TABLE IF NOT EXISTS beta_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS beta_usage_daily (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, request_count INTEGER NOT NULL DEFAULT 0, chat_requests INTEGER NOT NULL DEFAULT 0, revision_requests INTEGER NOT NULL DEFAULT 0, story_requests INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, failed_requests INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, usage_date));
CREATE TABLE IF NOT EXISTS beta_users (user_id TEXT PRIMARY KEY NOT NULL, started_at TEXT NOT NULL, expires_at TEXT NOT NULL, total_requests INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, last_seen_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS letters (id TEXT PRIMARY KEY NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mail_contacts (email TEXT PRIMARY KEY NOT NULL, account_id TEXT, subscribed INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mail_sends (id TEXT PRIMARY KEY NOT NULL, audience TEXT NOT NULL, subject TEXT NOT NULL, recipients INTEGER NOT NULL, delivered INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_accounts (provider_id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_auth_limits (key TEXT PRIMARY KEY NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_orders (order_id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, plan TEXT NOT NULL, amount_fen INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', provider_trade_no TEXT, created_at_ms INTEGER NOT NULL, paid_at_ms INTEGER);
CREATE TABLE IF NOT EXISTS member_referrals (account_id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL, redeemed_at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_sessions (token_hash TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_state (account_id TEXT PRIMARY KEY NOT NULL, plan TEXT NOT NULL DEFAULT 'soft', period_end_ms INTEGER, trial_end_ms INTEGER, updated_at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS member_story_usage (account_id TEXT PRIMARY KEY NOT NULL, week_start_ms INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS member_usage (account_id TEXT PRIMARY KEY NOT NULL, five_start_ms INTEGER NOT NULL, five_units INTEGER NOT NULL DEFAULT 0, week_start_ms INTEGER NOT NULL, week_units INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS user_spaces ( user_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS user_voices (user_id TEXT PRIMARY KEY NOT NULL, voice_id TEXT NOT NULL, model TEXT NOT NULL, consented_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS voice_global_daily (usage_date TEXT PRIMARY KEY NOT NULL, chars INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS voice_usage_daily (user_id TEXT NOT NULL, usage_date TEXT NOT NULL, chars INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0, enrolls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, usage_date));
CREATE INDEX IF NOT EXISTS beta_conversations_created_idx ON beta_conversations(created_at);
CREATE INDEX IF NOT EXISTS beta_events_created_idx ON beta_events(created_at);
CREATE INDEX IF NOT EXISTS beta_events_user_idx ON beta_events(user_hash, created_at);
CREATE INDEX IF NOT EXISTS beta_reports_created_idx ON beta_reports(created_at);
CREATE INDEX IF NOT EXISTS member_orders_account ON member_orders (account_id, created_at_ms);
CREATE INDEX IF NOT EXISTS member_sessions_expiry ON member_sessions (expires_at);

-- Card / Stripe payment tables (never created on production yet: the Stripe path is off).
CREATE TABLE IF NOT EXISTS entitlements (device_id TEXT PRIMARY KEY NOT NULL, plan TEXT NOT NULL, billing TEXT NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL, period_end TEXT NOT NULL, stripe_customer TEXT, stripe_subscription TEXT, last_reference TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS entitlements_subscription ON entitlements (stripe_subscription);
CREATE TABLE IF NOT EXISTS payment_events (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, received_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payment_interest (device_id TEXT PRIMARY KEY NOT NULL, plan TEXT NOT NULL, billing TEXT NOT NULL, contact TEXT, country TEXT, lang TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
