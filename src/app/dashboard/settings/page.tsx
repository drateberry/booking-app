import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import {
  getCurrentDefaultEventTypeId,
  listEventTypeOptions,
  setDefaultEventType,
} from "@/lib/settings";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const [options, currentId] = await Promise.all([
    listEventTypeOptions(),
    getCurrentDefaultEventTypeId(),
  ]);

  const individual = options.filter((o) => o.kind === "individual");
  const roundRobin = options.filter((o) => o.kind === "round-robin");

  async function save(formData: FormData) {
    "use server";
    const admin = await getSessionUser();
    if (!admin?.isAdmin) redirect("/dashboard");

    const raw = formData.get("defaultEventTypeId");
    const value = typeof raw === "string" && raw.length > 0 ? raw : null;
    await setDefaultEventType(admin.id, value);
    revalidatePath("/");
    revalidatePath("/dashboard/settings");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Admin only.</p>
        </div>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Default landing page</h2>
        <p className="text-sm text-muted-foreground">
          Pick an event type to show visitors at <code>/</code>. Leave unset to
          show the default marketing page. <code>/login</code> is always
          reachable directly.
        </p>

        <form action={save} className="flex flex-col gap-3">
          <select
            name="defaultEventTypeId"
            defaultValue={currentId ?? ""}
            className="rounded-md border p-2"
          >
            <option value="">— None (show marketing page) —</option>
            {individual.length > 0 && (
              <optgroup label="Individual">
                {individual.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ownerLabel} — {o.title} ({o.lengthMinutes} min)
                  </option>
                ))}
              </optgroup>
            )}
            {roundRobin.length > 0 && (
              <optgroup label="Team (round robin)">
                {roundRobin.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ownerLabel} — {o.title} ({o.lengthMinutes} min)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Save
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
