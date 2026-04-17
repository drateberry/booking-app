import { nanoid } from "nanoid";
import { addMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bookingReferences, bookings, eventTypes, users } from "@/db/schema";
import { isHostFree } from "@/lib/availability/engine";
import { CalendarClient } from "@/lib/google/calendar-client";
import { pickRoundRobinHost, NoAvailableHostError } from "./round-robin";
import { sendBookingConfirmation } from "@/lib/email/send";

export class SlotUnavailableError extends Error {
  constructor() {
    super("That time is no longer available");
    this.name = "SlotUnavailableError";
  }
}

export type CreateBookingInput = {
  eventTypeId: string;
  start: Date;
  attendeeName: string;
  attendeeEmail: string;
  attendeeTimezone: string;
  notes?: string;
  previousBookingUid?: string;
};

export type CreatedBooking = {
  uid: string;
  hostUserId: string;
  meetUrl: string | null;
  start: Date;
  end: Date;
};

export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const db = getDb();
  const eventType = await db.query.eventTypes.findFirst({
    where: eq(eventTypes.id, input.eventTypeId),
  });
  if (!eventType) throw new Error("Event type not found");

  const start = input.start;
  const end = addMinutes(start, eventType.lengthMinutes);
  const minNoticeMs = eventType.minBookingNoticeMinutes * 60_000;
  if (start.getTime() < Date.now() + minNoticeMs) {
    throw new SlotUnavailableError();
  }

  let hostUserId: string;
  if (eventType.schedulingType === "ROUND_ROBIN") {
    hostUserId = await pickRoundRobinHost(eventType, start, end);
  } else {
    if (!eventType.ownerUserId) throw new Error("Individual event type missing owner");
    hostUserId = eventType.ownerUserId;
    const free = await isHostFree(hostUserId, start, end, eventType.scheduleId);
    if (!free) throw new SlotUnavailableError();
  }

  const host = await db.query.users.findFirst({ where: eq(users.id, hostUserId) });
  if (!host) throw new Error("Host user not found");

  const uid = nanoid(12);
  const bookingId = nanoid(12);
  const title = `${eventType.title} — ${input.attendeeName} & ${host.name}`;
  const description = input.notes ?? eventType.description ?? "";

  await db.insert(bookings).values({
    id: bookingId,
    uid,
    eventTypeId: eventType.id,
    hostUserId,
    teamId: eventType.teamId,
    startTime: start,
    endTime: end,
    status: "ACCEPTED",
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    attendeeTimezone: input.attendeeTimezone,
    title,
    description,
    previousBookingUid: input.previousBookingUid,
  });

  const calendar = await CalendarClient.forUser(hostUserId);
  try {
    const event = await calendar.createEvent({
      summary: title,
      description,
      start,
      end,
      timezone: input.attendeeTimezone,
      attendees: [
        { email: input.attendeeEmail, name: input.attendeeName },
        { email: host.email, name: host.name },
      ],
      createMeet: true,
    });

    await db.insert(bookingReferences).values({
      id: nanoid(12),
      bookingId,
      type: "google_calendar",
      externalId: event.id,
      externalIcalUid: event.iCalUID,
      meetingUrl: event.hangoutLink,
    });

    if (event.hangoutLink) {
      await db.update(bookings).set({ meetUrl: event.hangoutLink }).where(eq(bookings.id, bookingId));
    }

    await sendBookingConfirmation({
      booking: {
        uid,
        title,
        start,
        end,
        meetUrl: event.hangoutLink,
        attendeeName: input.attendeeName,
        attendeeEmail: input.attendeeEmail,
        hostName: host.name,
        hostEmail: host.email,
      },
    });

    return { uid, hostUserId, meetUrl: event.hangoutLink, start, end };
  } catch (err) {
    await db
      .update(bookings)
      .set({ status: "CANCELLED", cancelReason: "Calendar sync failed" })
      .where(eq(bookings.id, bookingId));
    throw err;
  }
}

export { NoAvailableHostError };
