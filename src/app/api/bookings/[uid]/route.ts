import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { bookings } from "@/db/schema";
import { cancelBookingByUid } from "@/lib/booking/cancel";
import { verifyActionToken } from "@/lib/crypto/tokens";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(_req: Request, context: { params: Promise<{ uid: string }> }) {
  const { uid } = await context.params;
  const db = getDb();
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    uid: booking.uid,
    title: booking.title,
    status: booking.status,
    start: booking.startTime.toISOString(),
    end: booking.endTime.toISOString(),
    attendeeName: booking.attendeeName,
    meetUrl: booking.meetUrl,
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ uid: string }> }) {
  const { uid } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const session = await getSessionUserId();
  const { SESSION_SECRET } = getEnv();

  if (!session) {
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const verifiedUid = await verifyActionToken(token, "cancel", SESSION_SECRET);
    if (verifiedUid !== uid) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  } else {
    const db = getDb();
    const booking = await db.query.bookings.findFirst({ where: eq(bookings.uid, uid) });
    if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (booking.hostUserId !== session) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  try {
    await cancelBookingByUid(uid, "Cancelled by user");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cancel error", err);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }
}
