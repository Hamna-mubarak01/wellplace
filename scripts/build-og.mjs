import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(root, "public/renderings/suite-view-1-1920.webp");
const outDir = path.join(root, "public/og");

await mkdir(outDir, { recursive: true });

const target = path.join(outDir, "wellplace.jpg");

await sharp(source)
  .resize(1200, 630, { fit: "cover", position: "attention" })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(target);

const { size } = await sharp(target).metadata().then(async (meta) => ({
  size: meta.size ?? 0,
}));

console.log(`✓ public/og/wellplace.jpg — 1200×630 (${Math.round(size / 1024)} KB)`);
