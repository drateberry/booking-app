import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventTypeHosts, eventTypes } from "@/db/schema";
import { computeSlots } from "@/lib/availability/slots";
import { AvailabilityQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = AvailabilityQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400 });
  }
  const { eventTypeId, from, to } = parsed.data;

  const db = getDb();
  const eventType = await db.query.eventTypes.findFirst({
    where: eq(eventTypes.id, eventTypeId),
  });
  if (!eventType) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const hostIds =
    eventType.schedulingType === "INDIVIDUAL"
      ? [eventType.ownerUserId!]
      : (
          await db
            .select({ userId: eventTypeHosts.userId })
            .from(eventTypeHosts)
            .where(eq(eventTypeHosts.eventTypeId, eventTypeId))
        ).map((h) => h.userId);

  const slots = await computeSlots({
    eventType,
    hostIds,
    from: new Date(from),
    to: new Date(to),
  });

  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}
