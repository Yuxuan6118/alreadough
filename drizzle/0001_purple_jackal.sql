CREATE TABLE `beta_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_hash` text NOT NULL,
	`event_type` text NOT NULL,
	`mode` text,
	`wish_category` text,
	`coach_mode` text,
	`prompt_version` text,
	`feedback` text,
	`rating_before` integer,
	`rating_after` integer,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beta_events_created_idx` ON `beta_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `beta_events_user_idx` ON `beta_events` (`user_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `beta_global_daily` (
	`usage_date` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`failed_requests` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `beta_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `beta_usage_daily` (
	`user_id` text NOT NULL,
	`usage_date` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`chat_requests` integer DEFAULT 0 NOT NULL,
	`revision_requests` integer DEFAULT 0 NOT NULL,
	`story_requests` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`failed_requests` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `usage_date`)
);
--> statement-breakpoint
CREATE TABLE `beta_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`total_requests` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_seen_at` text NOT NULL
);
