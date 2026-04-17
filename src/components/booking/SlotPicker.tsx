"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  eventTypeId: string;
  timezone: string;
  onSelect: (iso: string) => void;
  selected?: string;
};

export function SlotPicker({ eventTypeId, timezone, onSelect, selected }: Props) {
  const [pivot, setPivot] = useState<Date>(startOfDay(new Date()));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string>(format(pivot, "yyyy-MM-dd"));

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(pivot, i)), [pivot]);

  useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const from = pivot.toISOString();
        const to = addDays(pivot, 14).toISOString();
        const qs = new URLSearchParams({ eventTypeId, from, to, timeZone: timezone });
        const res = await fetch(`/api/availability?${qs}`);
        if (!res.ok) throw new Error(`availability ${res.status}`);
        const data = (await res.json()) as { slots: string[] };
        if (!abort) setSlots(data.slots);
      } catch (err) {
        if (!abort) setError((err as Error).message);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => {
      abort = true;
    };
  }, [eventTypeId, pivot, timezone]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const iso of slots ?? []) {
      const d = formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd");
      const arr = map.get(d) ?? [];
      arr.push(iso);
      map.set(d, arr);
    }
    return map;
  }, [slots, timezone]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setPivot(addDays(pivot, -14))}>
          ← Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {format(pivot, "MMM d")} – {format(addDays(pivot, 13), "MMM d, yyyy")}
        </span>
        <Button variant="outline" onClick={() => setPivot(addDays(pivot, 14))}>
          Next →
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const has = (slotsByDay.get(key)?.length ?? 0) > 0;
          return (
            <button
              key={key}
              onClick={() => setActiveDay(key)}
              className={cn(
                "flex flex-col items-center rounded-md border p-2 text-xs transition",
                activeDay === key && "border-primary bg-muted",
                !has && "opacity-40"
              )}
              disabled={!has}
              type="button"
            >
              <span>{format(d, "EEE")}</span>
              <span className="text-lg font-semibold">{format(d, "d")}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-48 rounded-md border p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading availability…</p>}
        {error && <p className="text-sm text-destructive">Error: {error}</p>}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-2">
            {(slotsByDay.get(activeDay) ?? []).map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => onSelect(iso)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm hover:bg-muted",
                  selected === iso && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {formatInTimeZone(new Date(iso), timezone, "h:mm a")}
              </button>
            ))}
            {(slotsByDay.get(activeDay) ?? []).length === 0 && !loading && (
              <p className="col-span-3 text-sm text-muted-foreground">
                No available times on this day.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
