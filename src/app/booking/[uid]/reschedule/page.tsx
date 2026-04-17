import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb, getEnv } from "@/db/client";
import { bookings } from "@/db/schema";
import { verifyActionToken } from "@/lib/crypto/tokens";
import { BookingFlow } from "@/components/booking/BookingFlow";

type Props = {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function ReschedulePage({ params, searchParams }: Props) {
  const { uid } = await params;
  const { token } = await searchParams;
  const { SESSION_SECRET } = getEnv();
  if (!token) notFound();
  const verified = await verifyActionToken(token, "reschedule", SESSION_SECRET);
  if (verified !== uid) notFound();

  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
  if (!booking || booking.status === "CANCELLED") notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Reschedule</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new time for <strong>{booking.title}</strong>.
        </p>
      </div>
      <BookingFlow
        eventTypeId={booking.eventTypeId}
        rescheduleUid={uid}
        rescheduleToken={token}
      />
    </main>
  );
}
