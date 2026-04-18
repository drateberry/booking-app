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

# Google OAuth — see "Google setup" below. Summary:
# create a Web OAuth client, copy the client id/secret into .dev.vars.

cp .dev.vars.example .dev.vars
# edit .dev.vars with real values

pnpm cf:preview           # boots wrangler dev with D1 + secrets
```

## Google setup

The app uses one Google OAuth Web client for sign-in and per-user Calendar
access. Google Meet links are created by the Calendar API via
`conferenceData` — there's no separate Meet API to enable.

### 1. Create or pick a Google Cloud project

Go to https://console.cloud.google.com and create a project (or select one).

### 2. Enable the Google Calendar API

APIs & Services → Library → search **Google Calendar API** → Enable.

That's the only API to enable. Meet is bundled into Calendar.

### 3. Configure the OAuth consent screen

APIs & Services → **OAuth consent screen**.

- User type: **External** (unless every booker is in a Google Workspace
  org you control — then **Internal**).
- Fill in app name, support email, developer email.
- **Scopes** — add:
  - `openid`, `email`, `profile`
  - `.../auth/calendar.events` — write events and Meet links
  - `.../auth/calendar.readonly` — read free/busy for availability
- **Test users**: add every Google account that will sign in while the app
  is in Testing status. Promote to Production when ready to open sign-up.

### 4. Create an OAuth client ID

APIs & Services → Credentials → **Create credentials → OAuth client ID**.

- Application type: **Web application**.
- **Authorized redirect URIs** — add both:
  - `http://localhost:8787/api/auth/google/callback` (local `wrangler dev`)
  - `https://<your-prod-domain>/api/auth/google/callback`

Copy the **Client ID** and **Client secret**.

### 5. Wire the secrets

Generate a session secret first:

```bash
openssl rand -base64 32
```

**Local** — fill in `.dev.vars`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
SESSION_SECRET=<output of openssl rand -base64 32>
APP_URL=http://localhost:8787
```

**Cloudflare production** — set as Worker secrets:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI   # https://<prod-domain>/api/auth/google/callback
wrangler secret put SESSION_SECRET
wrangler secret put APP_URL               # https://<prod-domain>
```

### Notes

- **Per-user OAuth, not a service account.** Each signed-in user grants the
  app access to their own calendar — there is no central calendar or shared
  credential. Refresh tokens are encrypted with `SESSION_SECRET` before being
  stored in D1, so rotating that secret forces everyone to re-consent.
- Callback path is hard-coded to `/api/auth/google/callback`
  ([src/app/api/auth/google/callback/route.ts](src/app/api/auth/google/callback/route.ts)).
  Keep the Google Cloud redirect URIs in sync if you change it.

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
