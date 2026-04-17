import { NextResponse } from "next/server";
import { getEnv } from "@/db/client";
import { RescheduleSchema } from "@/lib/validation/schemas";
import { rescheduleBookingByUid } from "@/lib/booking/reschedule";
import { verifyActionToken } from "@/lib/crypto/tokens";
import { NoAvailableHostError, SlotUnavailableError } from "@/lib/booking/create";

export async function POST(request: Request, context: { params: Promise<{ uid: string }> }) {
  const { uid } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const { SESSION_SECRET } = getEnv();
  const verifiedUid = await verifyActionToken(token, "reschedule", SESSION_SECRET);
  if (verifiedUid !== uid) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await rescheduleBookingByUid(uid, new Date(parsed.data.newStart));
    return NextResponse.json({
      uid: result.uid,
      start: result.start.toISOString(),
      end: result.end.toISOString(),
      meetUrl: result.meetUrl,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError || err instanceof NoAvailableHostError) {
      return NextResponse.json({ error: "slot_unavailable" }, { status: 409 });
    }
    console.error("reschedule error", err);
    return NextResponse.json({ error: "reschedule_failed" }, { status: 500 });
  }
}
