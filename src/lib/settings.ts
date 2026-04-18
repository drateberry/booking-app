import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  APP_SETTINGS_ID,
  appSettings,
  eventTypes,
  teams,
  users,
} from "@/db/schema";

export type EventTypeOption = {
  id: string;
  title: string;
  lengthMinutes: number;
  schedulingType: string;
  ownerLabel: string;
  path: string;
  kind: "individual" | "round-robin";
};

export async function listEventTypeOptions(): Promise<EventTypeOption[]> {
  const db = getDb();
  const [userRows, teamRows] = await Promise.all([
    db
      .select({
        et: eventTypes,
        username: users.username,
        name: users.name,
      })
      .from(eventTypes)
      .innerJoin(users, eq(eventTypes.ownerUserId, users.id)),
    db
      .select({
        et: eventTypes,
        slug: teams.slug,
        name: teams.name,
      })
      .from(eventTypes)
      .innerJoin(teams, eq(eventTypes.teamId, teams.id)),
  ]);

  const fromUsers: EventTypeOption[] = userRows.map((r) => ({
    id: r.et.id,
    title: r.et.title,
    lengthMinutes: r.et.lengthMinutes,
    schedulingType: r.et.schedulingType,
    ownerLabel: r.name,
    path: `/${r.username}/${r.et.slug}`,
    kind: "individual",
  }));
  const fromTeams: EventTypeOption[] = teamRows.map((r) => ({
    id: r.et.id,
    title: r.et.title,
    lengthMinutes: r.et.lengthMinutes,
    schedulingType: r.et.schedulingType,
    ownerLabel: r.name,
    path: `/team/${r.slug}/${r.et.slug}`,
    kind: "round-robin",
  }));

  return [...fromUsers, ...fromTeams].sort((a, b) =>
    a.ownerLabel.localeCompare(b.ownerLabel) || a.title.localeCompare(b.title)
  );
}

export async function getDefaultLandingPath(): Promise<string | null> {
  const db = getDb();
  const settings = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, APP_SETTINGS_ID),
  });
  if (!settings?.defaultEventTypeId) return null;

  const et = await db.query.eventTypes.findFirst({
    where: eq(eventTypes.id, settings.defaultEventTypeId),
  });
  if (!et) return null;

  if (et.ownerUserId) {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, et.ownerUserId),
    });
    if (!owner) return null;
    return `/${owner.username}/${et.slug}`;
  }
  if (et.teamId) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, et.teamId) });
    if (!team) return null;
    return `/team/${team.slug}/${et.slug}`;
  }
  return null;
}

export async function getCurrentDefaultEventTypeId(): Promise<string | null> {
  const db = getDb();
  const settings = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, APP_SETTINGS_ID),
  });
  return settings?.defaultEventTypeId ?? null;
}

export async function setDefaultEventType(
  userId: string,
  eventTypeId: string | null
): Promise<void> {
  const db = getDb();
  if (eventTypeId) {
    const et = await db.query.eventTypes.findFirst({
      where: eq(eventTypes.id, eventTypeId),
    });
    if (!et) throw new Error("Event type not found");
  }
  await db
    .insert(appSettings)
    .values({
      id: APP_SETTINGS_ID,
      defaultEventTypeId: eventTypeId,
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        defaultEventTypeId: eventTypeId,
        updatedByUserId: userId,
        updatedAt: new Date(),
      },
    });
}
