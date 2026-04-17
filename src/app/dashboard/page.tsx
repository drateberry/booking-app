import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bookings, eventTypes, memberships, teams, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";

export default async function DashboardHome() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const db = getDb();

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) redirect("/login");

  const userTeams = await db
    .select({ team: teams })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(eq(memberships.userId, userId));

  const teamIds = userTeams.map((t) => t.team.id);
  const myEventTypes = await db
    .select()
    .from(eventTypes)
    .where(
      teamIds.length > 0
        ? or(eq(eventTypes.ownerUserId, userId), inArray(eventTypes.teamId, teamIds))
        : eq(eventTypes.ownerUserId, userId)
    );

  const upcoming = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.hostUserId, userId),
        eq(bookings.status, "ACCEPTED"),
        gte(bookings.startTime, new Date())
      )
    )
    .limit(5);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-muted-foreground">
            Your public page:{" "}
            <Link className="underline" href={`/${user.username}`}>
              /{user.username}
            </Link>
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-md border px-3 py-1 text-sm">Sign out</button>
        </form>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Event types</h2>
        <div className="flex flex-col gap-2">
          {myEventTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">No event types yet.</p>
          )}
          {myEventTypes.map((et) => {
            const href = et.teamId
              ? `/team/${userTeams.find((t) => t.team.id === et.teamId)?.team.slug}/${et.slug}`
              : `/${user.username}/${et.slug}`;
            return (
              <Link
                key={et.id}
                href={`/dashboard/event-types/${et.id}`}
                className="rounded-md border p-3 hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{et.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {et.lengthMinutes} min · {et.schedulingType.toLowerCase().replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Public: {href}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming bookings</h2>
          <Link className="text-sm underline" href="/dashboard/bookings">
            View all
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          )}
          {upcoming.map((b) => (
            <Link
              key={b.id}
              href={`/booking/${b.uid}`}
              className="rounded-md border p-3 hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{b.title}</span>
                <span className="text-xs text-muted-foreground">
                  {b.startTime.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
