import { and, eq, gte, lt, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { availability, bookings, dateOverrides, eventTypes, schedules, users } from "@/db/schema";
import { CalendarClient } from "@/lib/google/calendar-client";
import { expandWorkingHours } from "./schedule";
import { subtractIntervals, unionIntervals, type Interval } from "@/lib/time/intervals";

export type HostBusy = {
  userId: string;
  busy: Interval[];
};

export async function getHostBusy(userId: string, from: Date, to: Date): Promise<HostBusy> {
  const db = getDb();
  const dbBookings = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.hostUserId, userId),
        eq(bookings.status, "ACCEPTED"),
        lt(bookings.startTime, to),
        gte(bookings.endTime, from)
      )
    );

  const dbBusy: Interval[] = dbBookings.map((b) => ({ start: b.startTime, end: b.endTime }));

  const calendar = await CalendarClient.forUser(userId);
  const gBusy = await calendar.freeBusy(from, to);

  return { userId, busy: unionIntervals([dbBusy, gBusy]) };
}

export async function getHostWorkingHours(userId: string, eventTypeScheduleId: string | null, from: Date, to: Date): Promise<Interval[]> {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return [];

  const scheduleId = eventTypeScheduleId ?? user.defaultScheduleId;
  if (!scheduleId) return [];

  const schedule = await db.query.schedules.findFirst({ where: eq(schedules.id, scheduleId) });
  if (!schedule) return [];

  const [rules, overrides] = await Promise.all([
    db.query.availability.findMany({ where: eq(availability.scheduleId, scheduleId) }),
    db.query.dateOverrides.findMany({ where: eq(dateOverrides.scheduleId, scheduleId) }),
  ]);

  return expandWorkingHours({
    timezone: schedule.timezone,
    weeklyRules: rules,
    dateOverrides: overrides,
    from,
    to,
  });
}

export async function getHostFreeIntervals(
  userId: string,
  eventTypeScheduleId: string | null,
  from: Date,
  to: Date
): Promise<Interval[]> {
  const [working, busy] = await Promise.all([
    getHostWorkingHours(userId, eventTypeScheduleId, from, to),
    getHostBusy(userId, from, to),
  ]);
  return subtractIntervals(working, busy.busy);
}

export async function isHostFree(
  userId: string,
  start: Date,
  end: Date,
  eventTypeScheduleId: string | null
): Promise<boolean> {
  const free = await getHostFreeIntervals(userId, eventTypeScheduleId, start, end);
  return free.some((f) => f.start <= start && f.end >= end);
}

export async function getEventTypeById(eventTypeId: string) {
  const db = getDb();
  return db.query.eventTypes.findFirst({ where: eq(eventTypes.id, eventTypeId) });
}

// Exclude a specific booking UID from busy time (used for reschedule).
export async function getHostBusyExcluding(
  userId: string,
  from: Date,
  to: Date,
  excludeBookingUid: string
): Promise<HostBusy> {
  const db = getDb();
  const dbBookings = await db
    .select({ startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.hostUserId, userId),
        eq(bookings.status, "ACCEPTED"),
        lt(bookings.startTime, to),
        gte(bookings.endTime, from),
        ne(bookings.uid, excludeBookingUid)
      )
    );
  const dbBusy: Interval[] = dbBookings.map((b) => ({ start: b.startTime, end: b.endTime }));
  const calendar = await CalendarClient.forUser(userId);
  const gBusy = await calendar.freeBusy(from, to);
  return { userId, busy: unionIntervals([dbBusy, gBusy]) };
}
