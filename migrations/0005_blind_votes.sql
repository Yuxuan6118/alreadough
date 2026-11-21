-- Votes from the public blind tests at /test. Anonymous: `voter` is a random id the visitor's browser makes for itself;
-- no account, device id, address or message text is kept. One row per test, voter and question; voting again replaces it.
CREATE TABLE IF NOT EXISTS blind_votes (
  test_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  item_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('m1', 'm2', 'tie')),
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (test_id, voter, item_id)
);
CREATE INDEX IF NOT EXISTS blind_votes_test ON blind_votes (test_id, item_id);
