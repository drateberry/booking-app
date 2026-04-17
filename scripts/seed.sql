-- Seed data for local dev. Run with:
--   wrangler d1 execute booking-app --local --file=./scripts/seed.sql
-- Users must still sign in via Google OAuth to populate the `account` table
-- (refresh tokens, etc.). The seed just creates the shapes so the UI works.

INSERT OR IGNORE INTO user (id, email, username, name, timezone, default_schedule_id)
VALUES
  ('usr_alice', 'alice@example.com', 'alice', 'Alice Example', 'America/Los_Angeles', 'sch_alice'),
  ('usr_bob',   'bob@example.com',   'bob',   'Bob Example',   'America/New_York',    'sch_bob');

INSERT OR IGNORE INTO schedule (id, user_id, name, timezone) VALUES
  ('sch_alice', 'usr_alice', 'Working hours', 'America/Los_Angeles'),
  ('sch_bob',   'usr_bob',   'Working hours', 'America/New_York');

-- Mon-Fri 9-17 for both
INSERT OR IGNORE INTO availability (id, schedule_id, weekday, start_minute, end_minute) VALUES
  ('av_alice_mon', 'sch_alice', 1, 540, 1020),
  ('av_alice_tue', 'sch_alice', 2, 540, 1020),
  ('av_alice_wed', 'sch_alice', 3, 540, 1020),
  ('av_alice_thu', 'sch_alice', 4, 540, 1020),
  ('av_alice_fri', 'sch_alice', 5, 540, 1020),
  ('av_bob_mon',   'sch_bob',   1, 540, 1020),
  ('av_bob_tue',   'sch_bob',   2, 540, 1020),
  ('av_bob_wed',   'sch_bob',   3, 540, 1020),
  ('av_bob_thu',   'sch_bob',   4, 540, 1020),
  ('av_bob_fri',   'sch_bob',   5, 540, 1020);

INSERT OR IGNORE INTO team (id, slug, name) VALUES
  ('tm_sales', 'sales', 'Sales');

INSERT OR IGNORE INTO membership (team_id, user_id, role) VALUES
  ('tm_sales', 'usr_alice', 'OWNER'),
  ('tm_sales', 'usr_bob',   'MEMBER');

INSERT OR IGNORE INTO event_type
  (id, owner_user_id, team_id, slug, title, description, length_minutes, scheduling_type, schedule_id)
VALUES
  ('et_alice_30', 'usr_alice', NULL, '30min', '30 Minute Meeting', 'Quick sync', 30, 'INDIVIDUAL', 'sch_alice'),
  ('et_team_intro', NULL, 'tm_sales', 'intro', 'Sales Intro', '15 min discovery call', 15, 'ROUND_ROBIN', NULL);

INSERT OR IGNORE INTO event_type_host (event_type_id, user_id) VALUES
  ('et_team_intro', 'usr_alice'),
  ('et_team_intro', 'usr_bob');
