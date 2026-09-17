#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Globe, Mail, Phone, MapPin, Link } from "lucide-react";
import { FOOTER_PLATFORMS } from "../src/lib/config/message-footer.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(root, "public/email/social");

const INK = "#8f6529";
const SIZE = 24;
const SCALE = 3;

const GLYPHS = {
  instagram:
    '<rect x="2" y="2" width="20" height="20" rx="5.5" fill="none" stroke="INK" stroke-width="1.9"/>' +
    '<circle cx="12" cy="12" r="4.6" fill="none" stroke="INK" stroke-width="1.9"/>' +
    '<circle cx="17.6" cy="6.4" r="1.35" fill="INK"/>',
  tiktok:
    '<path d="M14.4 3h2.6a5.6 5.6 0 0 0 4.4 4.3v2.7a8.3 8.3 0 0 1-4.4-1.5v6.6a6.1 6.1 0 1 1-5.3-6v2.8a3.3 3.3 0 1 0 2.7 3.2z" fill="INK"/>',
};

await mkdir(outDir, { recursive: true });

for (const [name, body] of Object.entries(GLYPHS)) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">` +
    body.replaceAll("INK", INK) +
    "</svg>";

  const png = await sharp(Buffer.from(svg), { density: 72 * SCALE })
    .resize(SIZE * SCALE, SIZE * SCALE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, png);
  console.log(`  ${name}.png  ${SIZE * SCALE}px  ${(png.length / 1024).toFixed(1)}kB`);
}

console.log(`✓ social icons written to public/email/social/`);

const utilityIcons = { website: Globe, email: Mail, phone: Phone, location: MapPin, link: Link };
for (const platform of FOOTER_PLATFORMS) {
  let body;
  if (GLYPHS[platform.value]) body = GLYPHS[platform.value].replaceAll("INK", "currentColor");
  else if (utilityIcons[platform.value]) body = '<g fill="none" stroke="currentColor">' + renderToStaticMarkup(createElement(utilityIcons[platform.value], { fill: "none" })).replace(/^<svg[^>]*>|<\/svg>$/g, "") + "</g>";
  else body = (await readFile(path.join(root, `public/social/${platform.value}.svg`), "utf8"))
    .replace(/^<svg[^>]*>|<\/svg>$/g, "").replace(/<title>.*?<\/title>/g, "");
  for (const style of ["brand", "coloured", "monochrome"]) {
    const fill = style === "coloured" ? platform.colour : style === "brand" ? INK : "#333333";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${fill}"/><g transform="translate(6 6) scale(.833333)" color="#ffffff" fill="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
    await writeFile(path.join(outDir, `${platform.value}-${style}.png`), await sharp(Buffer.from(svg)).resize(96, 96).png().toBuffer());
  }
}
console.log("✓ footer icon styles generated");
