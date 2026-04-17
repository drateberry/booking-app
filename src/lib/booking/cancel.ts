import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bookingReferences, bookings, users } from "@/db/schema";
import { CalendarClient } from "@/lib/google/calendar-client";
import { sendBookingCancelled } from "@/lib/email/send";

export async function cancelBookingByUid(uid: string, reason?: string): Promise<void> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") return;

  const host = await db.query.users.findFirst({ where: eq(users.id, booking.hostUserId) });
  const refs = await db.query.bookingReferences.findMany({
    where: eq(bookingReferences.bookingId, booking.id),
  });

  for (const ref of refs) {
    if (ref.type !== "google_calendar") continue;
    try {
      const calendar = await CalendarClient.forUser(booking.hostUserId);
      await calendar.deleteEvent(ref.externalId);
    } catch (err) {
      console.error("Failed to delete Google event during cancel", err);
    }
  }

  await db
    .update(bookings)
    .set({ status: "CANCELLED", cancelReason: reason ?? null })
    .where(eq(bookings.id, booking.id));

  if (host) {
    await sendBookingCancelled({
      booking: {
        uid: booking.uid,
        title: booking.title,
        start: booking.startTime,
        end: booking.endTime,
        attendeeName: booking.attendeeName,
        attendeeEmail: booking.attendeeEmail,
        hostName: host.name,
        hostEmail: host.email,
      },
      reason,
    });
  }
}
