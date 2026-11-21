-- How much of each AI call's input the provider served from its prompt cache (billed at about an eighth of the input
-- price on qwen3.8-max). Lets the founder cockpit show the real cache hit rate instead of pricing every token at full.
ALTER TABLE beta_events ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0;
