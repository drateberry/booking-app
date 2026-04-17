import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { buildAuthUrl } from "@/lib/auth/google-oauth";

export async function GET() {
  const state = nanoid(24);
  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthUrl(state));
}

export async function POST() {
  return GET();
}
