"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type Props = {
  eventTypeId: string;
  startIso: string;
  timezone: string;
  onBack: () => void;
  rescheduleToken?: string;
  rescheduleUid?: string;
};

export function BookingForm({
  eventTypeId,
  startIso,
  timezone,
  onBack,
  rescheduleToken,
  rescheduleUid,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (rescheduleToken && rescheduleUid) {
        const res = await fetch(
          `/api/bookings/${rescheduleUid}/reschedule?token=${rescheduleToken}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ newStart: startIso }),
          }
        );
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Reschedule failed");
        const data = (await res.json()) as { uid: string };
        router.push(`/booking/${data.uid}`);
        return;
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          start: startIso,
          attendeeName: name,
          attendeeEmail: email,
          attendeeTimezone: timezone,
          notes,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Booking failed");
      const data = (await res.json()) as { uid: string };
      router.push(`/booking/${data.uid}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-md border p-3 text-sm">
        <strong>{formatInTimeZone(new Date(startIso), timezone, "EEEE, MMMM d, yyyy")}</strong>
        <br />
        {formatInTimeZone(new Date(startIso), timezone, "h:mm a zzz")}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={Boolean(rescheduleUid)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={submitting || !name || !email}>
          {submitting ? "Booking…" : rescheduleUid ? "Reschedule" : "Confirm"}
        </Button>
      </div>
    </form>
  );
}
