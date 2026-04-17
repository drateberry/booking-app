import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleGoogleCallback } from "@/lib/auth/google-oauth";
import { createSession } from "@/lib/auth/session";
import { getEnv } from "@/db/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = (await cookies()).get("oauth_state")?.value;

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  try {
    const { userId } = await handleGoogleCallback(code);
    await createSession(userId);
    const { APP_URL } = getEnv();
    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (err) {
    console.error("oauth callback error", err);
    return NextResponse.json({ error: "oauth_failed" }, { status: 500 });
  }
}
