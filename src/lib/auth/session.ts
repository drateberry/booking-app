import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, getEnv } from "@/db/client";
import { users } from "@/db/schema";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

async function key(secret: string): Promise<Uint8Array> {
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string): Promise<void> {
  const { SESSION_SECRET } = getEnv();
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(await key(SESSION_SECRET));

  (await cookies()).set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const { SESSION_SECRET } = getEnv();
    const { payload } = await jwtVerify(cookie, await key(SESSION_SECRET));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user ?? null;
}
