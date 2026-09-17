import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../src/styles/tokens/${p}`, import.meta.url), "utf8");

function declarations(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) return {};
  const open = css.indexOf("{", start);
  let depth = 0, i = open;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) break;
  }
  const out = {};
  for (const m of css.slice(open, i).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const primitives = declarations(read("primitives.css"), ":root");
const semanticCss = read("semantic.css");
const light = declarations(semanticCss, ":root");
const dark = { ...light, ...declarations(semanticCss, ':root[data-theme="dark"]') };

function resolve(name, scope) {
  let value = scope[name] ?? primitives[name];
  for (let hops = 0; value && hops < 10; hops++) {
    const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim());
    if (!m) break;
    value = scope[m[1]] ?? primitives[m[1]];
  }
  return value?.trim();
}

const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SURFACES = [
  "--surface-base",
  "--surface-raised",
  "--surface-sunken",
  "--surface-hover",
  "--surface-active",
  "--surface-notice",
  "--brand-wash",
  "--booking-edge-glass-surface",
];

// The filled booking tab uses its own light ink, checked over both backdrop
// extremes below; ordinary body/status text is used on the content surfaces.
const CONTENT_SURFACES = SURFACES.filter((surface) => surface !== "--booking-edge-glass-surface");

const FOREGROUNDS = [
  ["--text-primary", 4.5, "body text"],
  ["--text-secondary", 4.5, "secondary labels — named by the client"],
  ["--text-muted", 4.5, "muted text and disabled controls — named by the client"],
  ["--brand", 4.5, "accent text and links — named by the client"],
  ["--brand-hover", 4.5, "accent text, hover"],
  ["--success", 4.5, "status text"],
  ["--warning", 4.5, "status text"],
  ["--danger", 4.5, "error text — §5.5 says an error must be readable"],
  ["--info", 4.5, "informational status text"],
  ["--border-interactive", 3.0, "control boundary — inputs, checkboxes — named by the client"],
  ["--border-interactive-hover", 3.0, "control boundary while hovered — inputs, selects, outline controls"],
];

const DECORATIVE = ["--border", "--border-strong"];

const STATUS_PAIRS = [
  ["--on-brand", "--brand-hover", 4.5, "primary button hover text"],
  ["--on-brand", "--danger", 4.5, "destructive button text"],
  ["--on-brand", "--danger-hover", 4.5, "destructive button hover text"],
  ["--band-deep", "--band-accent", 4.5, "navigation and accent button hover text"],
  ["--brand", "--warning-wash", 4.5, "CMS preview action text"],
  ["--danger-ink", "--danger-wash", 4.5, "error alert text on its own surface"],
  ["--warning-ink", "--warning-wash", 4.5, "warning alert text on its own surface"],
  ["--success-ink", "--success-wash", 4.5, "success alert text on its own surface"],
  ["--info-ink", "--info-wash", 4.5, "informational toast text on its own surface"],
  ["--success-wash", "--success", 3, "toast badge glyph on its filled circle"],
  ["--warning-wash", "--warning", 3, "toast badge glyph on its filled circle"],
  ["--danger-wash", "--danger", 3, "toast badge glyph on its filled circle"],
  ["--info-wash", "--info", 3, "toast badge glyph on its filled circle"],
  ["--on-scrim", "--scrim-ink", 4.5, "light ink on the invariant dark scrim"],
  ["--on-scrim-muted", "--scrim-ink", 4.5, "original text-link hover over the invariant dark scrim"],
  ["--on-scrim-action", "--on-scrim", 4.5, "dark ink on the light chip over a scrim"],
  ["--on-scrim", "--reservation-image-surface", 4.5, "reservation heading on its dark image overlay"],
  ["--on-scrim-muted", "--reservation-image-surface", 4.5, "reservation body on its dark image overlay"],
  ["--band-accent", "--reservation-image-surface", 4.5, "reservation accent on its dark image overlay"],
  ["--band-ink", "--band-surface", 4.5, "editorial band text on the warm dark band"],
  ["--band-muted", "--band-surface", 4.5, "secondary text on the warm dark band"],
  ["--band-accent", "--band-surface", 4.5, "eyebrow and accent text on the warm dark band"],
  ["--band-ink", "--band-deep", 4.5, "editorial band text on the deep band"],
  ["--band-muted", "--band-deep", 4.5, "secondary text on the deep band"],
  ["--band-accent", "--band-deep", 4.5, "eyebrow and accent text on the deep band"],
  ["--band-action-hover-ink", "--band-action-fill", 4.5, "band accent button hover text"],
  ["--band-scrim-hover-ink", "--band-scrim-fill", 4.5, "band outline button hover text"],
  ["--panel-ink", "--panel-surface", 4.5, "editorial panel text on the adaptive panel"],
  ["--panel-muted", "--panel-surface", 4.5, "secondary text on the adaptive panel"],
  ["--panel-accent", "--panel-surface", 4.5, "eyebrow and accent text on the adaptive panel"],
  ["--panel-ink", "--panel-deep", 4.5, "editorial panel text on the sunken panel"],
  ["--panel-muted", "--panel-deep", 4.5, "secondary text on the sunken panel"],
  ["--panel-accent", "--panel-deep", 4.5, "eyebrow and accent text on the sunken panel"],
];

const HOME_CONTENT_SURFACES = [
  "--home-suite-surface",
  "--home-gallery-surface",
  "--home-faq-surface",
  "--home-location-surface",
];

const HOME_CONTENT_FOREGROUNDS = [
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--brand",
];

const HOME_BAND_SURFACES = [
  "--home-hero-surface",
  "--site-chrome-surface",
];

const HOME_BAND_FOREGROUNDS = [
  "--band-ink",
  "--band-muted",
  "--band-accent",
];

const HOME_PANEL_SURFACES = [
  "--home-concept-surface",
  "--home-how-surface",
  "--home-cta-surface",
  "--home-cta-end",
];

const HOME_PANEL_FOREGROUNDS = [
  "--panel-ink",
  "--panel-muted",
  "--panel-accent",
];

const HOME_PRIMARY_SURFACES = [
  "--home-hero-surface",
  "--home-concept-surface",
  "--home-suite-surface",
  "--home-how-surface",
  "--home-gallery-surface",
  "--home-faq-surface",
  "--home-location-surface",
  "--home-cta-surface",
  "--site-chrome-surface",
];

let failures = 0, checks = 0;

for (const [themeName, scope] of [["light", light], ["dark", dark]]) {
  console.log(`\n\x1b[1m${themeName.toUpperCase()}\x1b[0m`);
  // [§Mobile implementation 1; client glass correction, 14 Sep] Check the
  // translucent tab over the darkest and lightest possible image backdrops.
  const glass = resolve("--booking-edge-glass-surface", scope).replace("#", "");
  const glassAlpha = parseFloat(resolve("--booking-edge-glass-opacity", scope)) / 100;
  for (const backdrop of [0, 255]) {
    const composite = "#" + [0, 2, 4].map((offset) =>
      Math.round(parseInt(glass.slice(offset, offset + 2), 16) * glassAlpha + backdrop * (1 - glassAlpha))
        .toString(16).padStart(2, "0")
    ).join("");
    const ratio = contrast(resolve("--booking-edge-glass-ink", scope), composite);
    const ok = ratio >= 4.5;
    checks++;
    if (!ok) failures++;
    console.log(`  ${ok ? "✓" : "✗"} ${ratio.toFixed(2)}:1 (needs 4.5)  mobile glass tab over ${backdrop === 0 ? "black" : "white"}`);
  }
  for (const [fg, min, why] of FOREGROUNDS) {
    for (const bg of CONTENT_SURFACES) {
      const f = resolve(fg, scope), b = resolve(bg, scope);
      if (!f?.startsWith("#") || !b?.startsWith("#")) {
        console.log(`  ?  ${fg} on ${bg} — unresolved (${f ?? "?"} / ${b ?? "?"})`);
        continue;
      }
      checks++;
      const ratio = contrast(f, b);
      const ok = ratio >= min;
      if (!ok) failures++;
      const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      const line = `  ${mark} ${ratio.toFixed(2)}:1 (needs ${min})  ${fg} on ${bg}`;
      console.log(ok ? line : `${line}\n       ${why}  [${f} on ${b}]`);
    }
  }
  for (const [fg, bg, min, why] of STATUS_PAIRS) {
    const f = resolve(fg, scope), b = resolve(bg, scope);
    if (!f?.startsWith("#") || !b?.startsWith("#")) {
      console.log(`  ?  ${fg} on ${bg} — unresolved (${f ?? "?"} / ${b ?? "?"})`);
      continue;
    }
    checks++;
    const ratio = contrast(f, b);
    const ok = ratio >= min;
    if (!ok) failures++;
    const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const line = `  ${mark} ${ratio.toFixed(2)}:1 (needs ${min})  ${fg} on ${bg}`;
    console.log(ok ? line : `${line}\n       ${why}  [${f} on ${b}]`);
  }
  for (const [foregrounds, surfaces] of [
    [HOME_CONTENT_FOREGROUNDS, HOME_CONTENT_SURFACES],
    [HOME_BAND_FOREGROUNDS, HOME_BAND_SURFACES],
    [HOME_PANEL_FOREGROUNDS, HOME_PANEL_SURFACES],
  ]) {
    for (const fg of foregrounds) {
      for (const bg of surfaces) {
        const f = resolve(fg, scope), b = resolve(bg, scope);
        if (!f?.startsWith("#") || !b?.startsWith("#")) continue;
        checks++;
        const ratio = contrast(f, b);
        const ok = ratio >= 4.5;
        if (!ok) failures++;
        const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        console.log(`  ${mark} ${ratio.toFixed(2)}:1 (needs 4.5)  ${fg} on ${bg}`);
      }
    }
  }
  const surfaceValues = new Map();
  for (const surface of HOME_PRIMARY_SURFACES) {
    const value = resolve(surface, scope);
    const existing = surfaceValues.get(value);
    checks++;
    const ok = !existing;
    if (!ok) failures++;
    const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${mark} unique homepage surface  ${surface}${existing ? ` duplicates ${existing}` : ""}`);
    surfaceValues.set(value, surface);
  }
  for (const fg of DECORATIVE) {
    for (const bg of CONTENT_SURFACES) {
      const f = resolve(fg, scope), b = resolve(bg, scope);
      if (!f?.startsWith("#") || !b?.startsWith("#")) continue;
      console.log(`  \x1b[2m·  ${contrast(f, b).toFixed(2)}:1  ${fg} on ${bg} — decorative, exempt\x1b[0m`);
    }
  }

  const onBrand = resolve("--on-brand", scope), brand = resolve("--brand", scope);
  if (onBrand?.startsWith("#") && brand?.startsWith("#")) {
    checks++;
    const ratio = contrast(onBrand, brand);
    const ok = ratio >= 4.5;
    if (!ok) failures++;
    console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${ratio.toFixed(2)}:1 (needs 4.5)  --on-brand on --brand`);
  }
}

console.log(`\n${checks} pairs checked, ${failures} below threshold.`);
if (failures > 0) {
  console.log(
    "\nThese are the revised tokens the client is waiting on. Fix in\n" +
    "primitives.css or semantic.css — never in a component (9.1).",
  );
  process.exit(1);
}
