"use client";

import { useState } from "react";
import { SlotPicker } from "./SlotPicker";
import { BookingForm } from "./BookingForm";

type Props = {
  eventTypeId: string;
  rescheduleUid?: string;
  rescheduleToken?: string;
};

export function BookingFlow({ eventTypeId, rescheduleUid, rescheduleToken }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  if (!selected) {
    return (
      <SlotPicker
        eventTypeId={eventTypeId}
        timezone={timezone}
        onSelect={setSelected}
        selected={undefined}
      />
    );
  }

  return (
    <BookingForm
      eventTypeId={eventTypeId}
      startIso={selected}
      timezone={timezone}
      onBack={() => setSelected(null)}
      rescheduleUid={rescheduleUid}
      rescheduleToken={rescheduleToken}
    />
  );
}
