-- Screenshot import for TA: single uses bought one at a time (member_orders.plan = 'screenshots'),
-- and the weekly count of uses that paid Dough Atelier includes.
CREATE TABLE IF NOT EXISTS member_credits (account_id TEXT NOT NULL, kind TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, updated_at_ms INTEGER NOT NULL, PRIMARY KEY (account_id, kind));
CREATE TABLE IF NOT EXISTS member_feature_usage (account_id TEXT NOT NULL, feature TEXT NOT NULL, week_start_ms INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (account_id, feature));
