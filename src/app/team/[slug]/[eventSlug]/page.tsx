import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { eventTypes, teams } from "@/db/schema";
import { BookingFlow } from "@/components/booking/BookingFlow";

type Props = {
  params: Promise<{ slug: string; eventSlug: string }>;
};

export default async function PublicTeamPage({ params }: Props) {
  const { slug, eventSlug } = await params;
  const db = getDb();
  const team = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
  if (!team) notFound();
  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.teamId, team.id), eq(eventTypes.slug, eventSlug)),
  });
  if (!eventType) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-muted-foreground">{team.name} · Round-robin</p>
        <h1 className="text-3xl font-semibold">{eventType.title}</h1>
        <p className="text-sm text-muted-foreground">{eventType.lengthMinutes} min</p>
        {eventType.description && (
          <p className="mt-3 text-sm">{eventType.description}</p>
        )}
      </div>
      <BookingFlow eventTypeId={eventType.id} />
    </main>
  );
}
