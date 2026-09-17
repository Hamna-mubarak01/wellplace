import { mkdir, readdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(root, "assets-source");
const pub = path.join(root, "public");

if (!existsSync(src)) {
  console.error("assets-source/ is missing — the client originals are not on this machine.");
  process.exit(1);
}

const SVG_DIR = path.join(src, "brand/03_Digital_SVG/03_Digital_SVG");
const MARKS = {
  "WellPlace_Primary_Logo_Black.svg": "primary-dark.svg",
  "WellPlace_Primary_Logo_White_Transparent.svg": "primary-light.svg",
  "WellPlace_Secondary_Logo_Black.svg": "secondary-dark.svg",
  "WellPlace_Secondary_Logo_White_Transparent.svg": "secondary-light.svg",
  "WellPlace_Wordmark_Black.svg": "wordmark-dark.svg",
  "WellPlace_Wordmark_White_Transparent.svg": "wordmark-light.svg",
  "WellPlace_W_Icon_Black.svg": "icon-dark.svg",
  "WellPlace_W_Icon_White_Transparent.svg": "icon-light.svg",
};

await mkdir(path.join(pub, "brand"), { recursive: true });
for (const [from, to] of Object.entries(MARKS)) {
  await copyFile(path.join(SVG_DIR, from), path.join(pub, "brand", to));
}
console.log(`✓ ${Object.keys(MARKS).length} brand marks → public/brand/`);

await sharp(path.join(SVG_DIR, "WellPlace_Wordmark_Black.svg"), { density: 600 })
  .resize({ width: 336 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(pub, "brand", "wordmark-dark-email.png"));
console.log("✓ wordmark-dark-email.png → public/brand/");

const iconSrc = path.join(SVG_DIR, "WellPlace_W_Icon_Black.svg");
const appDir = path.join(root, "src/app");
const siteIconsDir = path.join(pub, "site-icons");
await mkdir(siteIconsDir, { recursive: true });
await rm(path.join(appDir, "icon.png"), { force: true });
await sharp(iconSrc, { density: 384 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(path.join(pub, "icon.png"));
await sharp(iconSrc, { density: 384 })
  .resize(160, 160, { fit: "contain", background: { r: 240, g: 233, b: 222, alpha: 1 } })
  .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 240, g: 233, b: 222, alpha: 1 } })
  .png().toFile(path.join(appDir, "apple-icon.png"));
await run("magick", [
  "-background", "#F0E9DE",
  "-density", "384",
  iconSrc,
  "-resize", "44x44",
  "-gravity", "center",
  "-extent", "64x64",
  "-define", "icon:auto-resize=64,48,32,16",
  path.join(siteIconsDir, "favicon.ico"),
]);
console.log("✓ icon.png → public/; apple-icon.png → src/app/; favicon.ico → public/site-icons/");

const RENDER_SRC = path.join(src, "renderings/JPG");
const WIDTHS = [1920, 960];
const outDir = path.join(pub, "renderings");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const slug = (f) =>
  path.parse(f).name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-+/g, "-");

let made = 0;
for (const file of (await readdir(RENDER_SRC)).sort()) {
  if (!/\.(jpe?g|tiff?)$/i.test(file)) continue;
  const isTiff = /\.tiff?$/i.test(file);
  for (const w of WIDTHS) {
    const out = path.join(outDir, `${slug(file)}-${w}.webp`);
    if (isTiff) {
      await run("magick", [
        `${path.join(RENDER_SRC, file)}[0]`,
        "-resize", `${w}x>`,
        "-quality", "82",
        "-strip",
        out,
      ], { maxBuffer: 1 << 28 });
    } else {
      await sharp(path.join(RENDER_SRC, file), { limitInputPixels: false })
        .resize(w, null, { withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(out);
    }
    made++;
  }
}
console.log(`✓ ${made} rendering derivatives → public/renderings/`);
