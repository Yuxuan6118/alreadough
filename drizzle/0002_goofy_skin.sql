CREATE TABLE `beta_request_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_hash` text NOT NULL,
	`usage_date` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`created_at` text NOT NULL,
	`settled_at` text
);
--> statement-breakpoint
CREATE INDEX `beta_reservations_user_idx` ON `beta_request_reservations` (`user_id`,`created_at`);