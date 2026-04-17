import { and, eq, inArray, lte, max } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bookings, eventTypeHosts } from "@/db/schema";
import { isHostFree } from "@/lib/availability/engine";
import type { EventType } from "@/db/schema";

export class NoAvailableHostError extends Error {
  constructor() {
    super("No host is available for the selected time");
    this.name = "NoAvailableHostError";
  }
}

export async function getTeamHosts(eventTypeId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: eventTypeHosts.userId })
    .from(eventTypeHosts)
    .where(eq(eventTypeHosts.eventTypeId, eventTypeId));
  return rows.map((r) => r.userId);
}

/**
 * Picks the host with the oldest most-recent-booking. Hosts with no prior
 * bookings win first (treated as epoch 0). Only free hosts are considered.
 */
export async function pickRoundRobinHost(
  eventType: EventType,
  slotStart: Date,
  slotEnd: Date
): Promise<string> {
  const db = getDb();
  const hostIds = await getTeamHosts(eventType.id);
  if (hostIds.length === 0) throw new NoAvailableHostError();

  const bufferBefore = eventType.bufferBeforeMinutes * 60_000;
  const bufferAfter = eventType.bufferAfterMinutes * 60_000;
  const checkStart = new Date(slotStart.getTime() - bufferBefore);
  const checkEnd = new Date(slotEnd.getTime() + bufferAfter);

  const freeChecks = await Promise.all(
    hostIds.map(async (id) => ({ id, free: await isHostFree(id, checkStart, checkEnd, eventType.scheduleId) }))
  );
  const free = freeChecks.filter((h) => h.free).map((h) => h.id);
  if (free.length === 0) throw new NoAvailableHostError();

  const now = new Date();
  const lastRows = await db
    .select({
      hostUserId: bookings.hostUserId,
      lastBooked: max(bookings.startTime),
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.hostUserId, free),
        eq(bookings.status, "ACCEPTED"),
        lte(bookings.startTime, now)
      )
    )
    .groupBy(bookings.hostUserId);

  const lastMap = new Map<string, number>();
  for (const r of lastRows) {
    if (r.lastBooked) lastMap.set(r.hostUserId, r.lastBooked.getTime());
  }

  free.sort((a, b) => (lastMap.get(a) ?? 0) - (lastMap.get(b) ?? 0));
  return free[0];
}
