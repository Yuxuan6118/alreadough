ALTER TABLE `beta_events` ADD `language` text;--> statement-breakpoint
ALTER TABLE `beta_events` ADD `duration_seconds` integer DEFAULT 0 NOT NULL;