# Booking App

A lightweight Cal.com-style booking app. Google Calendar + Google Meet only, team round-robin + individual event types, built to deploy to Cloudflare (primary) or Vercel.

## Stack

- **Next.js 15** App Router
- **Cloudflare D1** (SQLite) via **Drizzle ORM**
- Google OAuth + Google Calendar REST (no `googleapis` SDK)
- **Cloudflare Email Service** (public beta) via the `send_email` binding — no API keys
- Tailwind + Radix

## Local setup

```bash
pnpm install

# One-time: create D1 and paste the id into wrangler.toml
wrangler d1 create booking-app

# Apply migrations (local dev DB under .wrangler/)
pnpm db:generate          # regenerate SQL when schema.ts changes
pnpm db:migrate:local

# Seed
pnpm seed:local

# Google OAuth: create a Web OAuth client at
# https://console.cloud.google.com/apis/credentials with redirect
# http://localhost:8787/api/auth/google/callback and add your test users

cp .dev.vars.example .dev.vars
# edit .dev.vars with real values

pnpm cf:preview           # boots wrangler dev with D1 + secrets
```

## Deploy (Cloudflare)

```bash
pnpm db:migrate:remote
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI
wrangler secret put SESSION_SECRET
wrangler secret put APP_URL
pnpm cf:deploy
```

## Email (Cloudflare Email Service)

Email is sent through the `send_email` Worker binding declared in
`wrangler.toml`. No API keys required.

**One-time domain setup** (per
[Cloudflare docs](https://developers.cloudflare.com/email-service/get-started/send-emails/)):

1. Your sending domain must be on Cloudflare DNS.
2. Dashboard → **Email Sending** → **Onboard Domain** → pick the domain →
   **Add records and onboard**. Cloudflare writes MX / SPF / DKIM / DMARC
   records onto a `cf-bounce.<yourdomain>` subdomain.
3. DNS typically propagates in 5–15 minutes.

Once onboarded, any `from` using that domain works. The app's default sender
is `bookings@<APP_URL hostname>` (see `src/lib/email/send.ts`).

**While testing**, uncomment `allowed_destination_addresses` in
`wrangler.toml` to restrict who the binding can send to. `remote = true` on
the binding lets `wrangler dev` call the real service.

The app has a graceful fallback: if `env.SEND_EMAIL` is missing it logs a
warning and continues — useful on platforms without the binding (e.g. Vercel).

## Deploy (Vercel, optional)

Vercel is a secondary target. The D1 binding is swapped for the Cloudflare D1
REST API, and the Cloudflare Email binding is not available there — you'd
either fall back to a provider HTTP API (Resend, Postmark) in `src/lib/email/send.ts`
or call the Cloudflare Email REST API if/when Cloudflare exposes one.

## Routes

- `/` marketing
- `/login` Google sign-in
- `/dashboard` + `/dashboard/bookings` + `/dashboard/event-types/[id]` + `/dashboard/teams/[id]`
- `/[username]/[slug]` individual booking
- `/team/[slug]/[eventSlug]` team round-robin booking
- `/booking/[uid]` confirmation
- `/booking/[uid]/reschedule` attendee reschedule

## Scope

See `/root/.claude/plans/we-need-to-build-greedy-thompson.md` for the full plan.
