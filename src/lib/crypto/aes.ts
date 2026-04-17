const ALG = "AES-GCM";

async function importKey(secret: string): Promise<CryptoKey> {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", keyBytes, ALG, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(secret);
  const ct = await crypto.subtle.encrypt({ name: ALG, iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return toBase64(combined);
}

export async function decrypt(ciphertext: string, secret: string): Promise<string> {
  const combined = fromBase64(ciphertext);
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  const key = await importKey(secret);
  const pt = await crypto.subtle.decrypt({ name: ALG, iv }, key, ct);
  return new TextDecoder().decode(pt);
}
