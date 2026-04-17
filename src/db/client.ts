import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

export function getDb(): DB {
  const { env } = getCloudflareContext();
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  return drizzle(env.DB, { schema });
}

export function getEnv() {
  return getCloudflareContext().env;
}
