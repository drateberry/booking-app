import { fromZonedTime } from "date-fns-tz";
import { addDays, format, startOfDay } from "date-fns";
import type { Interval } from "@/lib/time/intervals";
import type { Availability, DateOverride } from "@/db/schema";

type Input = {
  timezone: string;
  weeklyRules: Pick<Availability, "weekday" | "startMinute" | "endMinute">[];
  dateOverrides: Pick<DateOverride, "date" | "startMinute" | "endMinute">[];
  from: Date;
  to: Date;
};

function minuteOf(date: Date, minutes: number, timezone: string): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const localDay = format(date, "yyyy-MM-dd");
  const isoLocal = `${localDay}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  return fromZonedTime(isoLocal, timezone);
}

export function expandWorkingHours(input: Input): Interval[] {
  const overridesByDate = new Map<string, { startMinute: number | null; endMinute: number | null }>();
  for (const o of input.dateOverrides) {
    overridesByDate.set(o.date, { startMinute: o.startMinute, endMinute: o.endMinute });
  }

  const rulesByWeekday = new Map<number, Array<{ startMinute: number; endMinute: number }>>();
  for (const r of input.weeklyRules) {
    const arr = rulesByWeekday.get(r.weekday) ?? [];
    arr.push({ startMinute: r.startMinute, endMinute: r.endMinute });
    rulesByWeekday.set(r.weekday, arr);
  }

  const out: Interval[] = [];
  const start = startOfDay(input.from);
  for (let d = start; d <= input.to; d = addDays(d, 1)) {
    const dateStr = format(d, "yyyy-MM-dd");
    const override = overridesByDate.get(dateStr);
    if (override) {
      if (override.startMinute == null || override.endMinute == null) continue;
      const s = minuteOf(d, override.startMinute, input.timezone);
      const e = minuteOf(d, override.endMinute, input.timezone);
      if (e > s) out.push({ start: s, end: e });
      continue;
    }
    const weekday = Number(format(d, "i")) % 7; // date-fns ISO day (1=Mon..7=Sun) -> 1..6,0
    const rules = rulesByWeekday.get(weekday) ?? [];
    for (const r of rules) {
      const s = minuteOf(d, r.startMinute, input.timezone);
      const e = minuteOf(d, r.endMinute, input.timezone);
      if (e > s && e > input.from && s < input.to) {
        out.push({
          start: s < input.from ? input.from : s,
          end: e > input.to ? input.to : e,
        });
      }
    }
  }
  return out;
}
