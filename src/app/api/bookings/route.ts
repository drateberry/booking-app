import { NextResponse } from "next/server";
import { CreateBookingSchema } from "@/lib/validation/schemas";
import {
  createBooking,
  NoAvailableHostError,
  SlotUnavailableError,
} from "@/lib/booking/create";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await createBooking({
      eventTypeId: parsed.data.eventTypeId,
      start: new Date(parsed.data.start),
      attendeeName: parsed.data.attendeeName,
      attendeeEmail: parsed.data.attendeeEmail,
      attendeeTimezone: parsed.data.attendeeTimezone,
      notes: parsed.data.notes,
    });
    return NextResponse.json({
      uid: result.uid,
      meetUrl: result.meetUrl,
      start: result.start.toISOString(),
      end: result.end.toISOString(),
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError || err instanceof NoAvailableHostError) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }
    console.error("booking error", err);
    return NextResponse.json({ error: "booking_failed" }, { status: 500 });
  }
}
