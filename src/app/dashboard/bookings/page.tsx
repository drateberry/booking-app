import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { getDb } from "@/db/client";
import { bookings, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";

export default async function HostBookingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) redirect("/login");

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.hostUserId, userId), gte(bookings.startTime, now)))
      .orderBy(asc(bookings.startTime)),
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.hostUserId, userId), lt(bookings.startTime, now)))
      .orderBy(desc(bookings.startTime))
      .limit(20),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Bookings</h1>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
        <BookingList items={upcoming} tz={user.timezone} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past</h2>
        <BookingList items={past} tz={user.timezone} />
      </section>
    </main>
  );
}

function BookingList({
  items,
  tz,
}: {
  items: Array<{
    id: string;
    uid: string;
    title: string;
    status: string;
    startTime: Date;
    endTime: Date;
    attendeeName: string;
  }>;
  tz: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((b) => (
        <li key={b.id}>
          <Link
            href={`/booking/${b.uid}`}
            className="flex items-center justify-between rounded-md border p-3 hover:bg-muted"
          >
            <div>
              <div className="font-medium">{b.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatInTimeZone(b.startTime, tz, "EEE, MMM d · h:mm a")} · {b.attendeeName}
              </div>
            </div>
            <span
              className={
                b.status === "CANCELLED"
                  ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                  : "rounded-full bg-muted px-2 py-0.5 text-xs"
              }
            >
              {b.status.toLowerCase()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
