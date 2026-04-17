import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { eventTypeHosts, eventTypes, memberships, teams, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EventTypeEditPage({ params }: Props) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const db = getDb();
  const et = await db.query.eventTypes.findFirst({ where: eq(eventTypes.id, id) });
  if (!et) notFound();

  // Authorization
  if (et.ownerUserId !== userId) {
    if (!et.teamId) notFound();
    const m = await db.query.memberships.findFirst({
      where: and(eq(memberships.teamId, et.teamId), eq(memberships.userId, userId)),
    });
    if (!m) notFound();
  }

  const hosts = et.schedulingType === "ROUND_ROBIN" ? await db
    .select({ user: users })
    .from(eventTypeHosts)
    .innerJoin(users, eq(users.id, eventTypeHosts.userId))
    .where(eq(eventTypeHosts.eventTypeId, id)) : [];

  const team = et.teamId ? await db.query.teams.findFirst({ where: eq(teams.id, et.teamId) }) : null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link href="/dashboard" className="text-sm underline">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{et.title}</h1>
        <p className="text-sm text-muted-foreground">
          {et.lengthMinutes} min · {et.schedulingType.toLowerCase().replace("_", " ")}
          {team && ` · ${team.name}`}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 rounded-md border p-4 text-sm">
        <dt className="text-muted-foreground">Slug</dt>
        <dd>{et.slug}</dd>
        <dt className="text-muted-foreground">Length</dt>
        <dd>{et.lengthMinutes} min</dd>
        <dt className="text-muted-foreground">Buffer before</dt>
        <dd>{et.bufferBeforeMinutes} min</dd>
        <dt className="text-muted-foreground">Buffer after</dt>
        <dd>{et.bufferAfterMinutes} min</dd>
        <dt className="text-muted-foreground">Min notice</dt>
        <dd>{et.minBookingNoticeMinutes} min</dd>
        <dt className="text-muted-foreground">Slot interval</dt>
        <dd>{et.slotIntervalMinutes ?? et.lengthMinutes} min</dd>
      </dl>
      {hosts.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Hosts</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {hosts.map((h) => (
              <li key={h.user.id} className="rounded-full border px-3 py-1">
                {h.user.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Use <code>PATCH /api/event-types/{id}</code> to edit fields (UI is minimal in v1).
      </p>
    </main>
  );
}
