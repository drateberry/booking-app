import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { getDb, getEnv } from "@/db/client";
import { bookings } from "@/db/schema";
import { signActionToken } from "@/lib/crypto/tokens";
import { CancelButton } from "@/components/booking/CancelButton";

type Props = {
  params: Promise<{ uid: string }>;
};

export default async function BookingConfirmationPage({ params }: Props) {
  const { uid } = await params;
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
  if (!booking) notFound();
  const { SESSION_SECRET } = getEnv();
  const cancelToken = await signActionToken(uid, "cancel", SESSION_SECRET);
  const rescheduleToken = await signActionToken(uid, "reschedule", SESSION_SECRET);

  const cancelled = booking.status === "CANCELLED";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-8">
      <h1 className="text-3xl font-semibold">
        {cancelled ? "Booking cancelled" : "Booking confirmed"}
      </h1>
      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">{booking.title}</p>
        <p className="text-lg font-medium">
          {formatInTimeZone(booking.startTime, booking.attendeeTimezone, "EEE, MMM d, yyyy")}
        </p>
        <p className="text-lg">
          {formatInTimeZone(booking.startTime, booking.attendeeTimezone, "h:mm a")} –{" "}
          {formatInTimeZone(booking.endTime, booking.attendeeTimezone, "h:mm a zzz")}
        </p>
        {booking.meetUrl && !cancelled && (
          <p className="mt-3 text-sm">
            Google Meet:{" "}
            <a className="underline" href={booking.meetUrl} target="_blank" rel="noreferrer">
              {booking.meetUrl}
            </a>
          </p>
        )}
      </div>
      {!cancelled && (
        <div className="flex gap-2">
          <a
            href={`/booking/${uid}/reschedule?token=${rescheduleToken}`}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Reschedule
          </a>
          <CancelButton uid={uid} token={cancelToken} />
        </div>
      )}
    </main>
  );
}
