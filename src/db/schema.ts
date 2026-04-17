import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index, primaryKey, check } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s','now'))`);

export const users = sqliteTable(
  "user",
  {
    id: id(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    defaultScheduleId: text("default_schedule_id"),
    createdAt: createdAt(),
  },
  (t) => ({
    emailUq: uniqueIndex("user_email_uq").on(t.email),
    usernameUq: uniqueIndex("user_username_uq").on(t.username),
  })
);

export const accounts = sqliteTable(
  "account",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    scope: text("scope").notNull(),
    selectedCalendarId: text("selected_calendar_id").notNull().default("primary"),
  },
  (t) => ({
    providerUq: uniqueIndex("account_provider_uq").on(t.provider, t.providerAccountId),
    userIdx: index("account_user_idx").on(t.userId),
  })
);

export const teams = sqliteTable(
  "team",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    slugUq: uniqueIndex("team_slug_uq").on(t.slug),
  })
);

export const memberships = sqliteTable(
  "membership",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("MEMBER"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.userId] }),
  })
);

export const schedules = sqliteTable("schedule", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
});

export const availability = sqliteTable(
  "availability",
  {
    id: id(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => ({
    scheduleIdx: index("availability_schedule_idx").on(t.scheduleId),
  })
);

export const dateOverrides = sqliteTable(
  "date_override",
  {
    id: id(),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
  },
  (t) => ({
    scheduleDateIdx: index("override_schedule_date_idx").on(t.scheduleId, t.date),
  })
);

export const eventTypes = sqliteTable(
  "event_type",
  {
    id: id(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    lengthMinutes: integer("length_minutes").notNull(),
    schedulingType: text("scheduling_type").notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    minBookingNoticeMinutes: integer("min_booking_notice_minutes").notNull().default(0),
    slotIntervalMinutes: integer("slot_interval_minutes"),
    scheduleId: text("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => ({
    ownerSlugIdx: index("et_owner_slug_idx").on(t.ownerUserId, t.slug),
    teamSlugIdx: index("et_team_slug_idx").on(t.teamId, t.slug),
    ownerXorTeam: check(
      "event_type_owner_xor_team",
      sql`(${t.ownerUserId} is not null and ${t.teamId} is null) or (${t.ownerUserId} is null and ${t.teamId} is not null)`
    ),
  })
);

export const eventTypeHosts = sqliteTable(
  "event_type_host",
  {
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventTypeId, t.userId] }),
  })
);

export const bookings = sqliteTable(
  "booking",
  {
    id: id(),
    uid: text("uid").notNull(),
    eventTypeId: text("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "restrict" }),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("ACCEPTED"),
    attendeeName: text("attendee_name").notNull(),
    attendeeEmail: text("attendee_email").notNull(),
    attendeeTimezone: text("attendee_timezone").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    meetUrl: text("meet_url"),
    cancelReason: text("cancel_reason"),
    previousBookingUid: text("previous_booking_uid"),
    createdAt: createdAt(),
  },
  (t) => ({
    uidUq: uniqueIndex("booking_uid_uq").on(t.uid),
    hostStartIdx: index("booking_host_start_idx").on(t.hostUserId, t.startTime),
    eventTypeStartIdx: index("booking_et_start_idx").on(t.eventTypeId, t.startTime),
  })
);

export const bookingReferences = sqliteTable(
  "booking_reference",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    externalId: text("external_id").notNull(),
    externalIcalUid: text("external_ical_uid"),
    meetingUrl: text("meeting_url"),
  },
  (t) => ({
    bookingIdx: index("bref_booking_idx").on(t.bookingId),
  })
);

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingReference = typeof bookingReferences.$inferSelect;
