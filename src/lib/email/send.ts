import { formatInTimeZone } from "date-fns-tz";
import { getEnv } from "@/db/client";
import { signActionToken } from "@/lib/crypto/tokens";

type BookingEmailInput = {
  booking: {
    uid: string;
    title: string;
    start: Date;
    end: Date;
    meetUrl?: string | null;
    attendeeName: string;
    attendeeEmail: string;
    hostName: string;
    hostEmail: string;
  };
};

// Payload shape matches Cloudflare Email Service send() binding:
// https://developers.cloudflare.com/email-service/get-started/send-emails/
// The REST API uses the same shape:
// https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
type SendPayload = {
  from: string | { address: string; name?: string };
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string | { address: string; name?: string };
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
};

async function sendViaBinding(payload: SendPayload): Promise<void> {
  const env = getEnv() as unknown as {
    SEND_EMAIL?: { send(p: SendPayload): Promise<{ messageId?: string } & Record<string, unknown>> };
  };
  if (!env.SEND_EMAIL) {
    console.warn("[email] SEND_EMAIL binding missing; skipping:", payload.subject, payload.to);
    return;
  }
  try {
    const res = await env.SEND_EMAIL.send(payload);
    if (res?.messageId) console.log("[email] sent", res.messageId, payload.subject);
  } catch (err) {
    console.error("[email] send failed", err);
  }
}

function fmt(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEE, MMM d, yyyy 'at' h:mm a zzz");
}

function layout(body: string): string {
  return `<!doctype html><html><body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">${body}</body></html>`;
}

function fromAddress(appUrl: string): { address: string; name: string } {
  return { address: `bookings@${new URL(appUrl).hostname}`, name: "Booking" };
}

export async function sendBookingConfirmation(input: BookingEmailInput): Promise<void> {
  const { APP_URL, SESSION_SECRET } = getEnv();
  const { booking } = input;
  const cancelToken = await signActionToken(booking.uid, "cancel", SESSION_SECRET);
  const rescheduleToken = await signActionToken(booking.uid, "reschedule", SESSION_SECRET);
  const cancelUrl = `${APP_URL}/booking/${booking.uid}?action=cancel&token=${cancelToken}`;
  const rescheduleUrl = `${APP_URL}/booking/${booking.uid}/reschedule?token=${rescheduleToken}`;
  const when = fmt(booking.start, "UTC");
  const meet = booking.meetUrl
    ? `<p><strong>Google Meet:</strong> <a href="${booking.meetUrl}">${booking.meetUrl}</a></p>`
    : "";

  const attendeeHtml = layout(`
    <h2>Your booking is confirmed</h2>
    <p>Hi ${esc(booking.attendeeName)}, your meeting with ${esc(booking.hostName)} is scheduled.</p>
    <p><strong>${esc(booking.title)}</strong></p>
    <p>${esc(when)}</p>
    ${meet}
    <p>
      <a href="${rescheduleUrl}" style="margin-right: 12px;">Reschedule</a>
      <a href="${cancelUrl}" style="color:#b91c1c;">Cancel</a>
    </p>
  `);

  const hostHtml = layout(`
    <h2>New booking</h2>
    <p>${esc(booking.attendeeName)} (&lt;${esc(booking.attendeeEmail)}&gt;) booked <strong>${esc(booking.title)}</strong>.</p>
    <p>${esc(when)}</p>
    ${meet}
    <p><a href="${APP_URL}/dashboard/bookings">View in dashboard</a></p>
  `);

  const from = fromAddress(APP_URL);
  await Promise.all([
    sendViaBinding({
      from,
      to: booking.attendeeEmail,
      reply_to: booking.hostEmail,
      subject: `Confirmed: ${booking.title}`,
      html: attendeeHtml,
      text: `Your booking is confirmed. ${booking.title} — ${when}. ${booking.meetUrl ?? ""}`,
    }),
    sendViaBinding({
      from,
      to: booking.hostEmail,
      reply_to: booking.attendeeEmail,
      subject: `New booking: ${booking.title}`,
      html: hostHtml,
      text: `${booking.attendeeName} <${booking.attendeeEmail}> booked ${booking.title} — ${when}.`,
    }),
  ]);
}

export async function sendBookingCancelled(
  input: BookingEmailInput & { reason?: string }
): Promise<void> {
  const { APP_URL } = getEnv();
  const { booking, reason } = input;
  const when = fmt(booking.start, "UTC");
  const html = layout(`
    <h2>Booking cancelled</h2>
    <p><strong>${esc(booking.title)}</strong></p>
    <p>${esc(when)}</p>
    ${reason ? `<p>Reason: ${esc(reason)}</p>` : ""}
  `);
  const text = `Cancelled: ${booking.title} — ${when}.${reason ? ` Reason: ${reason}` : ""}`;
  const from = fromAddress(APP_URL);
  await Promise.all([
    sendViaBinding({
      from,
      to: booking.attendeeEmail,
      subject: `Cancelled: ${booking.title}`,
      html,
      text,
    }),
    sendViaBinding({
      from,
      to: booking.hostEmail,
      subject: `Cancelled: ${booking.title}`,
      html,
      text,
    }),
  ]);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
