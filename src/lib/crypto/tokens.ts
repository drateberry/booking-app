function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

export type TokenAction = "cancel" | "reschedule";

export async function signActionToken(
  uid: string,
  action: TokenAction,
  secret: string
): Promise<string> {
  const payload = `${action}:${uid}`;
  const sig = await hmac(payload, secret);
  return `${b64url(new TextEncoder().encode(payload))}.${sig}`;
}

export async function verifyActionToken(
  token: string,
  expectedAction: TokenAction,
  secret: string
): Promise<string | null> {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  let payload: string;
  try {
    payload = new TextDecoder().decode(
      Uint8Array.from(
        atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0)
      )
    );
  } catch {
    return null;
  }
  const expected = await hmac(payload, secret);
  if (expected !== sig) return null;
  const [action, uid] = payload.split(":");
  if (action !== expectedAction || !uid) return null;
  return uid;
}
