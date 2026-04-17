import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq, inArray, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { eventTypeHosts, eventTypes, memberships } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";
import { EventTypeCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const userTeams = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  const teamIds = userTeams.map((t) => t.teamId);
  const rows = await db
    .select()
    .from(eventTypes)
    .where(
      teamIds.length > 0
        ? or(eq(eventTypes.ownerUserId, userId), inArray(eventTypes.teamId, teamIds))
        : eq(eventTypes.ownerUserId, userId)
    );
  return NextResponse.json({ eventTypes: rows });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = EventTypeCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const input = parsed.data;

  const db = getDb();
  if (input.schedulingType === "ROUND_ROBIN") {
    if (!input.teamId) return NextResponse.json({ error: "team_required" }, { status: 400 });
    const membership = await db.query.memberships.findFirst({
      where: and(eq(memberships.teamId, input.teamId), eq(memberships.userId, userId)),
    });
    if (!membership) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = nanoid(12);
  await db.insert(eventTypes).values({
    id,
    ownerUserId: input.schedulingType === "INDIVIDUAL" ? userId : null,
    teamId: input.schedulingType === "ROUND_ROBIN" ? input.teamId! : null,
    slug: input.slug,
    title: input.title,
    description: input.description,
    lengthMinutes: input.lengthMinutes,
    schedulingType: input.schedulingType,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    minBookingNoticeMinutes: input.minBookingNoticeMinutes,
    slotIntervalMinutes: input.slotIntervalMinutes ?? null,
  });

  if (input.schedulingType === "ROUND_ROBIN") {
    for (const hostUserId of input.hostUserIds) {
      await db.insert(eventTypeHosts).values({ eventTypeId: id, userId: hostUserId });
    }
  }

  return NextResponse.json({ id });
}
