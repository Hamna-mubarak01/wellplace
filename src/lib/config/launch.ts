const WAITLIST_LAUNCH_ROUTES = [
  "/waitlist", "/legal", "/unsubscribe",
  "/sign-in", "/set-password", "/no-access", "/auth", "/manage", "/reception",
  "/api", "/_next",
  "/brand", "/email", "/flags", "/og", "/renderings", "/site-icons", "/social",
] as const;

const WAITLIST_LAUNCH_FILES = new Set([
  "/robots.txt", "/sitemap.xml", "/favicon.ico", "/icon", "/icon.png",
  "/apple-icon.png", "/manifest.webmanifest",
]);

export function isWaitlistLaunchPath(pathname: string): boolean {
  return WAITLIST_LAUNCH_FILES.has(pathname)
    || WAITLIST_LAUNCH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
