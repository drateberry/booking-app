import { addMinutes } from "date-fns";
import type { EventType } from "@/db/schema";
import { getHostFreeIntervals } from "./engine";
import { unionIntervals } from "@/lib/time/intervals";

export type SlotQuery = {
  eventType: EventType;
  hostIds: string[];
  from: Date;
  to: Date;
};

export async function computeSlots(q: SlotQuery): Promise<Date[]> {
  const { eventType, hostIds, from, to } = q;
  const length = eventType.lengthMinutes;
  const interval = eventType.slotIntervalMinutes ?? length;
  const minNoticeMs = eventType.minBookingNoticeMinutes * 60_000;
  const earliest = new Date(Date.now() + minNoticeMs);

  const perHost = await Promise.all(
    hostIds.map((id) => getHostFreeIntervals(id, eventType.scheduleId, from, to))
  );

  // For round-robin team event types, a slot is available if ANY host is free.
  // For individual event types (one host), this is just that host's free intervals.
  const free = unionIntervals(perHost);

  const slots: Date[] = [];
  const buffer = eventType.bufferBeforeMinutes + eventType.bufferAfterMinutes;
  const needed = length + buffer;

  for (const block of free) {
    let cursor = alignToInterval(block.start, interval);
    if (cursor < earliest) cursor = alignToInterval(earliest, interval);
    while (true) {
      const slotStart = cursor;
      const slotEnd = addMinutes(slotStart, length);
      const windowEnd = addMinutes(slotStart, needed - eventType.bufferBeforeMinutes);
      if (windowEnd > block.end) break;
      if (slotStart >= to) break;
      if (slotStart < from) {
        cursor = addMinutes(cursor, interval);
        continue;
      }
      // The slot+buffers must fit fully within ONE host's free intervals
      // (union is too permissive — adjacent hosts can't split a slot).
      const bufferedStart = addMinutes(slotStart, -eventType.bufferBeforeMinutes);
      const bufferedEnd = addMinutes(slotEnd, eventType.bufferAfterMinutes);
      const anyHostCovers = perHost.some((intervals) =>
        intervals.some((i) => i.start <= bufferedStart && i.end >= bufferedEnd)
      );
      if (anyHostCovers) slots.push(slotStart);
      cursor = addMinutes(cursor, interval);
    }
  }

  return slots;
}

function alignToInterval(date: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}
