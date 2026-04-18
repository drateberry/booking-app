import Link from "next/link";
import { redirect } from "next/navigation";
import { getDefaultLandingPath } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const path = await getDefaultLandingPath();
  if (path) redirect(path);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold">Booking</h1>
      <p className="text-muted-foreground">
        A lightweight scheduler built on Google Calendar and Google Meet.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
