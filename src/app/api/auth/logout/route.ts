import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { getEnv } from "@/db/client";

export async function POST() {
  await destroySession();
  const { APP_URL } = getEnv();
  return NextResponse.redirect(`${APP_URL}/`, 303);
}
