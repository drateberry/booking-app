import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { eventTypes, users } from "@/db/schema";
import { BookingFlow } from "@/components/booking/BookingFlow";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

export default async function PublicIndividualPage({ params }: Props) {
  const { username, slug } = await params;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user) notFound();
  const eventType = await db.query.eventTypes.findFirst({
    where: and(eq(eventTypes.ownerUserId, user.id), eq(eventTypes.slug, slug)),
  });
  if (!eventType) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <div>
        <p className="text-sm text-muted-foreground">{user.name}</p>
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
