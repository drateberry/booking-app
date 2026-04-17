-- Initial schema for booking-app. Regenerate with `pnpm db:generate` when schema.ts changes.

CREATE TABLE `user` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `username` text NOT NULL,
  `name` text NOT NULL,
  `timezone` text NOT NULL DEFAULT 'UTC',
  `default_schedule_id` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE UNIQUE INDEX `user_email_uq` ON `user` (`email`);
CREATE UNIQUE INDEX `user_username_uq` ON `user` (`username`);

CREATE TABLE `account` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `provider_account_id` text NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token_encrypted` text NOT NULL,
  `expires_at` integer NOT NULL,
  `scope` text NOT NULL,
  `selected_calendar_id` text NOT NULL DEFAULT 'primary'
);
CREATE UNIQUE INDEX `account_provider_uq` ON `account` (`provider`, `provider_account_id`);
CREATE INDEX `account_user_idx` ON `account` (`user_id`);

CREATE TABLE `team` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE UNIQUE INDEX `team_slug_uq` ON `team` (`slug`);

CREATE TABLE `membership` (
  `team_id` text NOT NULL REFERENCES `team`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `role` text NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (`team_id`, `user_id`)
);

CREATE TABLE `schedule` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `timezone` text NOT NULL
);

CREATE TABLE `availability` (
  `id` text PRIMARY KEY NOT NULL,
  `schedule_id` text NOT NULL REFERENCES `schedule`(`id`) ON DELETE CASCADE,
  `weekday` integer NOT NULL,
  `start_minute` integer NOT NULL,
  `end_minute` integer NOT NULL
);
CREATE INDEX `availability_schedule_idx` ON `availability` (`schedule_id`);

CREATE TABLE `date_override` (
  `id` text PRIMARY KEY NOT NULL,
  `schedule_id` text NOT NULL REFERENCES `schedule`(`id`) ON DELETE CASCADE,
  `date` text NOT NULL,
  `start_minute` integer,
  `end_minute` integer
);
CREATE INDEX `override_schedule_date_idx` ON `date_override` (`schedule_id`, `date`);

CREATE TABLE `event_type` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text REFERENCES `user`(`id`) ON DELETE CASCADE,
  `team_id` text REFERENCES `team`(`id`) ON DELETE CASCADE,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `length_minutes` integer NOT NULL,
  `scheduling_type` text NOT NULL,
  `buffer_before_minutes` integer NOT NULL DEFAULT 0,
  `buffer_after_minutes` integer NOT NULL DEFAULT 0,
  `min_booking_notice_minutes` integer NOT NULL DEFAULT 0,
  `slot_interval_minutes` integer,
  `schedule_id` text REFERENCES `schedule`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now')),
  CONSTRAINT `event_type_owner_xor_team` CHECK (
    (`owner_user_id` IS NOT NULL AND `team_id` IS NULL) OR
    (`owner_user_id` IS NULL AND `team_id` IS NOT NULL)
  )
);
CREATE INDEX `et_owner_slug_idx` ON `event_type` (`owner_user_id`, `slug`);
CREATE INDEX `et_team_slug_idx` ON `event_type` (`team_id`, `slug`);

CREATE TABLE `event_type_host` (
  `event_type_id` text NOT NULL REFERENCES `event_type`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`event_type_id`, `user_id`)
);

CREATE TABLE `booking` (
  `id` text PRIMARY KEY NOT NULL,
  `uid` text NOT NULL,
  `event_type_id` text NOT NULL REFERENCES `event_type`(`id`) ON DELETE RESTRICT,
  `host_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE RESTRICT,
  `team_id` text REFERENCES `team`(`id`) ON DELETE SET NULL,
  `start_time` integer NOT NULL,
  `end_time` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'ACCEPTED',
  `attendee_name` text NOT NULL,
  `attendee_email` text NOT NULL,
  `attendee_timezone` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `meet_url` text,
  `cancel_reason` text,
  `previous_booking_uid` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE UNIQUE INDEX `booking_uid_uq` ON `booking` (`uid`);
CREATE INDEX `booking_host_start_idx` ON `booking` (`host_user_id`, `start_time`);
CREATE INDEX `booking_et_start_idx` ON `booking` (`event_type_id`, `start_time`);

CREATE TABLE `booking_reference` (
  `id` text PRIMARY KEY NOT NULL,
  `booking_id` text NOT NULL REFERENCES `booking`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `external_id` text NOT NULL,
  `external_ical_uid` text,
  `meeting_url` text
);
CREATE INDEX `bref_booking_idx` ON `booking_reference` (`booking_id`);
