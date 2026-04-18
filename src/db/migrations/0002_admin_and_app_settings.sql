-- Add admin flag and app-level settings (singleton row).

ALTER TABLE `user` ADD COLUMN `is_admin` integer NOT NULL DEFAULT 0;

-- Promote the oldest existing user to admin so deployments with data retain
-- a way into /dashboard/settings. New installs get their first user promoted
-- by the OAuth callback.
UPDATE `user`
SET `is_admin` = 1
WHERE `id` = (SELECT `id` FROM `user` ORDER BY `created_at` ASC LIMIT 1);

CREATE TABLE `app_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `default_event_type_id` text REFERENCES `event_type`(`id`) ON DELETE SET NULL,
  `updated_at` integer NOT NULL DEFAULT (strftime('%s','now')),
  `updated_by_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL
);

INSERT INTO `app_settings` (`id`) VALUES ('singleton');
