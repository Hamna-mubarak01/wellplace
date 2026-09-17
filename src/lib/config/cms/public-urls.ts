import { EDITABLE_PUBLIC_ROUTES, REDIRECT_TARGETS, URLS_CMS_PAGE } from "@/lib/config/cms/pages/urls";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { items, itemStr, strOr } from "@/lib/config/cms/read";

export function validPublicPath(path: string): boolean {
  return /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path)
    && !/^\/(?:api|manage|reception|booking|book|waitlist|legal|sign-in|set-password|no-access|unsubscribe|health)(?:\/|$)/.test(path);
}
export function resolvePublicUrls(stored: Record<string, unknown> | null) {
  const values = resolveCmsValues(URLS_CMS_PAGE, stored);
  const pages = Object.fromEntries(EDITABLE_PUBLIC_ROUTES.map((route) => [route, strOr(values, "pages", route.slice(1), route)]));
  const redirects = items(values, "redirects", "items").map((row) => ({ from: itemStr(row, "from").trim(), target: itemStr(row, "target") }));
  const occupied = new Set<string>();
  let error: string | null = null;
  for (const [original, path] of Object.entries(pages)) {
    if (!validPublicPath(path) || (path !== original && REDIRECT_TARGETS.some((target) => target === path)) || occupied.has(path)) error = "Each public page needs a unique URL that does not replace another page or a protected address.";
    occupied.add(path);
  }
  for (const row of redirects) {
    if (!validPublicPath(row.from) || occupied.has(row.from) || REDIRECT_TARGETS.some((target) => target === row.from) || !REDIRECT_TARGETS.some((target) => target === row.target)) error = "Redirects need unique public source paths and an existing destination page. A source cannot also be a page URL.";
    occupied.add(row.from);
  }
  return { pages, redirects, error };
}
export function publicUrl(path: string, pages: Readonly<Record<string, string>>) {
  const [pathname, suffix = ""] = path.split(/(?=[?#])/, 2);
  return `${pages[pathname] ?? pathname}${suffix}`;
}
export function routePublicUrl(path: string, stored: Record<string, unknown> | null): { kind: "redirect" | "rewrite"; path: string } | null {
  const { pages, redirects, error } = resolvePublicUrls(stored);
  if (error) return null;
  const redirect = redirects.find((entry) => entry.from === path);
  if (redirect) return { kind: "redirect", path: pages[redirect.target] ?? redirect.target };
  if (pages[path] && pages[path] !== path) return { kind: "redirect", path: pages[path] };
  const original = Object.entries(pages).find(([original, custom]) => custom === path && original !== custom)?.[0];
  return original ? { kind: "rewrite", path: original } : null;
}
