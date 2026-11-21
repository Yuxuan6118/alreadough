-- TA chats are kept like the main chat (mode = 'persona') so the founder chat page can show them.
-- Which TA a turn was with: the persona's id on her device and the name she gave it.
ALTER TABLE beta_conversations ADD COLUMN persona_id TEXT;
ALTER TABLE beta_conversations ADD COLUMN persona_name TEXT;
