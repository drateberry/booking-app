"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelButton({ uid, token }: { uid: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings/${uid}?token=${token}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Cancel failed");
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="destructive" onClick={cancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel"}
      </Button>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
