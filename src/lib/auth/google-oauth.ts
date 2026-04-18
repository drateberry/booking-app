import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { accounts, schedules, availability, users } from "@/db/schema";
import { encrypt } from "@/lib/crypto/aes";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function buildAuthUrl(state: string): string {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = getEnv();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

type Userinfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = getEnv();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchUserinfo(accessToken: string): Promise<Userinfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed: ${res.status}`);
  return res.json();
}

function slugifyEmail(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function handleGoogleCallback(code: string): Promise<{ userId: string }> {
  const tokens = await exchangeCode(code);
  const info = await fetchUserinfo(tokens.access_token);
  const db = getDb();
  const { SESSION_SECRET } = getEnv();

  const existing = await db.query.users.findFirst({ where: eq(users.email, info.email) });
  let userId: string;

  if (existing) {
    userId = existing.id;
  } else {
    userId = nanoid(12);
    let username = slugifyEmail(info.email);
    const clash = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (clash) username = `${username}-${nanoid(4)}`;
    const scheduleId = nanoid(12);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(users);
    const isFirstUser = count === 0;
    await db.insert(users).values({
      id: userId,
      email: info.email,
      username,
      name: info.name ?? info.email,
      timezone: "UTC",
      defaultScheduleId: scheduleId,
      isAdmin: isFirstUser,
    });
    await db.insert(schedules).values({
      id: scheduleId,
      userId,
      name: "Working hours",
      timezone: "UTC",
    });
    // Mon-Fri 9-17 default schedule
    for (const weekday of [1, 2, 3, 4, 5]) {
      await db.insert(availability).values({
        id: nanoid(12),
        scheduleId,
        weekday,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      });
    }
  }

  if (!tokens.refresh_token) {
    const prior = await db.query.accounts.findFirst({
      where: eq(accounts.providerAccountId, info.sub),
    });
    if (!prior) {
      throw new Error("No refresh_token returned. Revoke access at myaccount.google.com and retry.");
    }
  }

  const refreshToken = tokens.refresh_token;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const existingAccount = await db.query.accounts.findFirst({
    where: eq(accounts.providerAccountId, info.sub),
  });

  if (existingAccount) {
    await db
      .update(accounts)
      .set({
        accessToken: tokens.access_token,
        expiresAt,
        scope: tokens.scope,
        ...(refreshToken
          ? { refreshTokenEncrypted: await encrypt(refreshToken, SESSION_SECRET) }
          : {}),
      })
      .where(eq(accounts.id, existingAccount.id));
  } else {
    await db.insert(accounts).values({
      id: nanoid(12),
      userId,
      provider: "google",
      providerAccountId: info.sub,
      accessToken: tokens.access_token,
      refreshTokenEncrypted: await encrypt(refreshToken!, SESSION_SECRET),
      expiresAt,
      scope: tokens.scope,
      selectedCalendarId: "primary",
    });
  }

  return { userId };
}
