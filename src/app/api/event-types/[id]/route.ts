import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { eventTypeHosts, eventTypes, memberships } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth/session";

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  lengthMinutes: z.number().int().min(5).max(480).optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(120).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(120).optional(),
  minBookingNoticeMinutes: z.number().int().min(0).optional(),
  slotIntervalMinutes: z.number().int().min(5).max(240).nullable().optional(),
  hostUserIds: z.array(z.string()).optional(),
});

async function assertWritable(userId: string, eventTypeId: string) {
  const db = getDb();
  const et = await db.query.eventTypes.findFirst({ where: eq(eventTypes.id, eventTypeId) });
  if (!et) return { error: "not_found" as const, status: 404 };
  if (et.ownerUserId === userId) return { et };
  if (et.teamId) {
    const m = await db.query.memberships.findFirst({
      where: and(eq(memberships.teamId, et.teamId), eq(memberships.userId, userId)),
    });
    if (m) return { et };
  }
  return { error: "forbidden" as const, status: 403 };
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const check = await assertWritable(userId, id);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  return NextResponse.json({ eventType: check.et });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const check = await assertWritable(userId, id);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const db = getDb();
  const { hostUserIds, ...rest } = parsed.data;
  if (Object.keys(rest).length > 0) {
    await db.update(eventTypes).set(rest).where(eq(eventTypes.id, id));
  }
  if (hostUserIds && check.et.schedulingType === "ROUND_ROBIN") {
    await db.delete(eventTypeHosts).where(eq(eventTypeHosts.eventTypeId, id));
    for (const hostUserId of hostUserIds) {
      await db.insert(eventTypeHosts).values({ eventTypeId: id, userId: hostUserId });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const check = await assertWritable(userId, id);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const db = getDb();
  await db.delete(eventTypes).where(eq(eventTypes.id, id));
  return NextResponse.json({ ok: true });
}
