import { mkdir, readdir, copyFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCountries } from "libphonenumber-js";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "node_modules/country-flag-icons/3x2");
const out = path.join(root, "public/flags");

const wanted = new Set(getCountries());
const available = new Set(
  (await readdir(src))
    .filter((file) => file.endsWith(".svg"))
    .map((file) => path.basename(file, ".svg")),
);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

let bytes = 0;
let copied = 0;
for (const iso2 of wanted) {
  if (!available.has(iso2)) continue;
  const from = path.join(src, `${iso2}.svg`);
  await copyFile(from, path.join(out, `${iso2}.svg`));
  bytes += (await stat(from)).size;
  copied += 1;
}

const missing = [...wanted].filter((iso2) => !available.has(iso2));

console.log(`✓ ${copied} flags → public/flags/ (${Math.round(bytes / 1024)} KB)`);
if (missing.length) {
  console.log(`! no artwork for ${missing.length}: ${missing.join(", ")}`);
}
