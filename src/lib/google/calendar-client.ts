import { nanoid } from "nanoid";
import { getValidAccessToken } from "./tokens";

const BASE = "https://www.googleapis.com/calendar/v3";
const FREEBUSY_MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BusyInterval = { start: Date; end: Date };

export type CreateEventInput = {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: Array<{ email: string; name?: string }>;
  createMeet?: boolean;
};

export type CreatedEvent = {
  id: string;
  iCalUID: string | null;
  hangoutLink: string | null;
  htmlLink: string | null;
};

export class CalendarClient {
  constructor(
    private readonly accessToken: string,
    private readonly calendarId: string
  ) {}

  static async forUser(userId: string): Promise<CalendarClient> {
    const { accessToken, calendarId } = await getValidAccessToken(userId);
    return new CalendarClient(accessToken, calendarId);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new GoogleApiError(res.status, await res.text());
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async freeBusy(timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const chunks: Array<{ start: Date; end: Date }> = [];
    let cursor = timeMin.getTime();
    const end = timeMax.getTime();
    while (cursor < end) {
      const next = Math.min(cursor + FREEBUSY_MAX_DAYS * DAY_MS, end);
      chunks.push({ start: new Date(cursor), end: new Date(next) });
      cursor = next;
    }
    const all: BusyInterval[] = [];
    for (const chunk of chunks) {
      const data = await this.request<{
        calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
      }>("/freeBusy", {
        method: "POST",
        body: JSON.stringify({
          timeMin: chunk.start.toISOString(),
          timeMax: chunk.end.toISOString(),
          items: [{ id: this.calendarId }],
        }),
      });
      const busy = data.calendars[this.calendarId]?.busy ?? [];
      for (const b of busy) all.push({ start: new Date(b.start), end: new Date(b.end) });
    }
    return mergeIntervals(all);
  }

  async createEvent(input: CreateEventInput): Promise<CreatedEvent> {
    const body: Record<string, unknown> = {
      summary: input.summary,
      description: input.description ?? "",
      start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
      attendees: input.attendees.map((a) => ({ email: a.email, displayName: a.name })),
      reminders: { useDefault: true },
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
    };
    if (input.createMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: nanoid(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    const qs = new URLSearchParams({
      conferenceDataVersion: input.createMeet ? "1" : "0",
      sendUpdates: "all",
    });
    const event = await this.request<{
      id: string;
      iCalUID?: string;
      hangoutLink?: string;
      htmlLink?: string;
    }>(`/calendars/${encodeURIComponent(this.calendarId)}/events?${qs}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      id: event.id,
      iCalUID: event.iCalUID ?? null,
      hangoutLink: event.hangoutLink ?? null,
      htmlLink: event.htmlLink ?? null,
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.request<void>(
        `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        { method: "DELETE" }
      );
    } catch (err) {
      if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return;
      throw err;
    }
  }
}

export class GoogleApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Google API error ${status}: ${body}`);
  }
}

export function mergeIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: BusyInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}
