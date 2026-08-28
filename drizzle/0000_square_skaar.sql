CREATE TABLE `board_members` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`opinion_id` text NOT NULL,
	`rank` integer NOT NULL,
	`member_status` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `board_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opinion_id`) REFERENCES `opinions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_board_members_snapshot_rank` ON `board_members` (`snapshot_id`,`rank`);--> statement-breakpoint
CREATE INDEX `idx_board_members_opinion` ON `board_members` (`opinion_id`);--> statement-breakpoint
CREATE TABLE `board_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`board_date` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`verification_status` text NOT NULL,
	`data_as_of` text NOT NULL,
	`published_at` text,
	`conflict_count` integer DEFAULT 0 NOT NULL,
	`approved_by` text,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_board_snapshots_date_version` ON `board_snapshots` (`board_date`,`version`);--> statement-breakpoint
CREATE INDEX `idx_board_snapshots_status_date` ON `board_snapshots` (`status`,`board_date`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`card_date` text NOT NULL,
	`region` text NOT NULL,
	`meeting` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cards_portfolio` ON `cards` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_date` ON `cards` (`card_date`);--> statement-breakpoint
CREATE TABLE `daily_performance` (
	`date` text PRIMARY KEY NOT NULL,
	`recommendations` integer NOT NULL,
	`settled` integer NOT NULL,
	`unresolved` integer NOT NULL,
	`settled_stake_cents` integer NOT NULL,
	`gross_return_cents` integer NOT NULL,
	`profit_loss_cents` integer NOT NULL,
	`roi` real,
	`wins` integer NOT NULL,
	`losses` integer NOT NULL,
	`voids` integer NOT NULL,
	`fully_settled` integer NOT NULL,
	`data_as_of` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_daily_performance_data_as_of` ON `daily_performance` (`data_as_of`);--> statement-breakpoint
CREATE TABLE `decision_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`opinion_id` text NOT NULL,
	`bet_context` text NOT NULL,
	`stage` text NOT NULL,
	`colour` text NOT NULL,
	`operating_state` text NOT NULL,
	`eligibility` text NOT NULL,
	`price_verified_at` text,
	`reason` text,
	FOREIGN KEY (`opinion_id`) REFERENCES `opinions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_decision_contexts_opinion` ON `decision_contexts` (`opinion_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_date` text NOT NULL,
	`title` text NOT NULL,
	`observation` text NOT NULL,
	`evidence` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`rule_version` text NOT NULL,
	`source_ref` text,
	`approved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_lessons_status_date` ON `lessons` (`status`,`lesson_date`);--> statement-breakpoint
CREATE TABLE `opinions` (
	`id` text PRIMARY KEY NOT NULL,
	`logical_id` text NOT NULL,
	`version` integer NOT NULL,
	`race_id` text NOT NULL,
	`horse_name` text NOT NULL,
	`tier` text,
	`confidence` text,
	`observed_odds` text,
	`fair_odds` text,
	`minimum_odds` text,
	`verdict` text NOT NULL,
	`why_ranked` text NOT NULL,
	`biggest_risk` text NOT NULL,
	`verification_status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_opinions_logical_version` ON `opinions` (`logical_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_opinions_race` ON `opinions` (`race_id`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`decision_date` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notional_cap_cents` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_portfolios_decision_date` ON `portfolios` (`decision_date`);--> statement-breakpoint
CREATE TABLE `publication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text,
	`event_type` text NOT NULL,
	`event_at` text NOT NULL,
	`actor` text NOT NULL,
	`previous_version` integer,
	`change_summary` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `board_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_publication_events_snapshot` ON `publication_events` (`snapshot_id`);--> statement-breakpoint
CREATE INDEX `idx_publication_events_time` ON `publication_events` (`event_at`);--> statement-breakpoint
CREATE TABLE `race_results` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`horse_name` text NOT NULL,
	`outcome` text NOT NULL,
	`finish_position` integer,
	`official_at` text NOT NULL,
	`source_observation_id` text,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_observation_id`) REFERENCES `source_observations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_race_results_race_horse` ON `race_results` (`race_id`,`horse_name`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`post_time` text NOT NULL,
	`race_name` text NOT NULL,
	`race_code` text,
	`going` text,
	`field_size` integer,
	`status` text NOT NULL,
	`last_observed_at` text,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_races_card_post_time` ON `races` (`card_id`,`post_time`);--> statement-breakpoint
CREATE INDEX `idx_races_status` ON `races` (`status`);--> statement-breakpoint
CREATE TABLE `source_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`data_type` text NOT NULL,
	`reliability_tier` text NOT NULL,
	`observed_at` text NOT NULL,
	`verification_status` text NOT NULL,
	`payload_hash` text
);
--> statement-breakpoint
CREATE INDEX `idx_source_observations_entity` ON `source_observations` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_source_observations_observed_at` ON `source_observations` (`observed_at`);--> statement-breakpoint
CREATE TABLE `ticket_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`opinion_id` text NOT NULL,
	`leg_number` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opinion_id`) REFERENCES `opinions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ticket_legs_ticket_number` ON `ticket_legs` (`ticket_id`,`leg_number`);--> statement-breakpoint
CREATE TABLE `ticket_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`gross_return_cents` integer NOT NULL,
	`profit_loss_cents` integer NOT NULL,
	`settled_at` text NOT NULL,
	`verification_status` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ticket_settlements_ticket` ON `ticket_settlements` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`ticket_type` text NOT NULL,
	`activity_type` text NOT NULL,
	`notional_stake_cents` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `board_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_portfolio` ON `tickets` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_activity_type` ON `tickets` (`activity_type`);--> statement-breakpoint
CREATE TABLE `update_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_type` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`input_as_of` text,
	`records_accepted` integer DEFAULT 0 NOT NULL,
	`records_rejected` integer DEFAULT 0 NOT NULL,
	`error_summary` text
);
--> statement-breakpoint
CREATE INDEX `idx_update_runs_status_started` ON `update_runs` (`status`,`started_at`);