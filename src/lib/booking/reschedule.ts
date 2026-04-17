import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bookings } from "@/db/schema";
import { cancelBookingByUid } from "./cancel";
import { createBooking, type CreatedBooking } from "./create";

export async function rescheduleBookingByUid(
  uid: string,
  newStart: Date
): Promise<CreatedBooking> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") throw new Error("Booking is already cancelled");

  const fresh = await createBooking({
    eventTypeId: booking.eventTypeId,
    start: newStart,
    attendeeName: booking.attendeeName,
    attendeeEmail: booking.attendeeEmail,
    attendeeTimezone: booking.attendeeTimezone,
    notes: booking.description,
    previousBookingUid: booking.uid,
  });

  await cancelBookingByUid(uid, "Rescheduled");

  return fresh;
}
