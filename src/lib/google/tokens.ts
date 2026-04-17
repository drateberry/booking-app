import { eq } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { accounts } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto/aes";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REFRESH_THRESHOLD_MS = 60_000;

type RefreshResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  refresh_token?: string;
};

export async function getValidAccessToken(userId: string): Promise<{
  accessToken: string;
  calendarId: string;
}> {
  const db = getDb();
  const { SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv();

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });
  if (!account) throw new Error(`No Google account for user ${userId}`);

  const now = Date.now();
  const expiresAtMs = account.expiresAt.getTime();

  if (expiresAtMs - now > REFRESH_THRESHOLD_MS) {
    return { accessToken: account.accessToken, calendarId: account.selectedCalendarId };
  }

  const refreshToken = await decrypt(account.refreshTokenEncrypted, SESSION_SECRET);
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed for user ${userId}: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RefreshResponse;
  const newExpiresAt = new Date(now + data.expires_in * 1000);

  await db
    .update(accounts)
    .set({
      accessToken: data.access_token,
      expiresAt: newExpiresAt,
      scope: data.scope,
      ...(data.refresh_token
        ? { refreshTokenEncrypted: await encrypt(data.refresh_token, SESSION_SECRET) }
        : {}),
    })
    .where(eq(accounts.id, account.id));

  return { accessToken: data.access_token, calendarId: account.selectedCalendarId };
}
