import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(root, "wrangler.toml.template");
const outPath = resolve(root, "wrangler.toml");

// Best-effort load of .env and .env.local for local dev, so contributors can
// keep D1_DATABASE_ID in a gitignored file instead of exporting it each shell.
for (const name of [".env", ".env.local"]) {
  const p = resolve(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const template = readFileSync(templatePath, "utf8");
const missing = [];
const rendered = template.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, key) => {
  const v = process.env[key];
  if (v == null || v === "") {
    missing.push(key);
    return "";
  }
  return v;
});

if (missing.length) {
  console.error(
    `gen-wrangler: missing required env vars: ${[...new Set(missing)].join(", ")}`
  );
  console.error("Set them in your shell, in .env.local, or in the Cloudflare build environment.");
  process.exit(1);
}

writeFileSync(outPath, rendered);
console.log(`gen-wrangler: wrote ${outPath}`);
