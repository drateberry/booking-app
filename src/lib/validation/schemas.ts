import { z } from "zod";

export const CreateBookingSchema = z.object({
  eventTypeId: z.string().min(1),
  start: z.string().datetime(),
  attendeeName: z.string().min(1).max(200),
  attendeeEmail: z.string().email(),
  attendeeTimezone: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const AvailabilityQuerySchema = z.object({
  eventTypeId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  timeZone: z.string().min(1).optional(),
});

export const EventTypeCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  lengthMinutes: z.number().int().min(5).max(480),
  schedulingType: z.enum(["INDIVIDUAL", "ROUND_ROBIN"]),
  teamId: z.string().optional(),
  hostUserIds: z.array(z.string()).default([]),
  bufferBeforeMinutes: z.number().int().min(0).max(120).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(120).default(0),
  minBookingNoticeMinutes: z.number().int().min(0).default(0),
  slotIntervalMinutes: z.number().int().min(5).max(240).optional(),
});

export const RescheduleSchema = z.object({
  newStart: z.string().datetime(),
});
