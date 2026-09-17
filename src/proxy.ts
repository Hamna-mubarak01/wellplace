import { routePublicUrl } from "@/lib/config/cms/public-urls";
import { fetchPublicUrlRules } from "@/lib/db/queries/public-urls";
import { CMS_PREVIEW_COOKIE } from "@/lib/config/cms/preview";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_AFTER_SIGN_IN,
  RETURN_TO_COOKIE,
  RETURN_TO_MAX_AGE,
} from "@/lib/auth/return-to";
import { CONSOLE_ROOT, consoleForPath } from "@/lib/auth/console";
import { isWaitlistLaunchPath } from "@/lib/config/launch";
import { LAUNCH_MODE } from "@/lib/config/seo";
import { WAITLIST_CHROME } from "@/lib/config/site-chrome";

const NEVER_INDEXED = [
  ...Object.values(CONSOLE_ROOT),
  "/booking/",
  "/sign-in",
  "/set-password",
  "/no-access",
];

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProduction = process.env.NEXT_PUBLIC_APP_ENV === "production";
  const isNeverIndexed = NEVER_INDEXED.some((prefix) => pathname.startsWith(prefix));
  const isStaffOnly = consoleForPath(pathname) !== null;

  if (LAUNCH_MODE === "waitlist" && !isWaitlistLaunchPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = WAITLIST_CHROME.href;
    const response = request.method === "GET" || request.method === "HEAD"
      ? NextResponse.redirect(target, 307)
      : new NextResponse(null, { status: 404 });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (isStaffOnly && !hasSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    const response = NextResponse.redirect(signIn);

    const returnTo = `${pathname}${search}`;
    response.cookies.set(RETURN_TO_COOKIE, returnTo === DEFAULT_AFTER_SIGN_IN ? "" : returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: RETURN_TO_MAX_AGE,
    });

    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  let response = NextResponse.next();
  const publicPage = request.method === "GET" && !isStaffOnly && !isNeverIndexed
    && !/^\/(?:api|_next|booking|book|waitlist|legal|renderings|images|fonts|assets)(?:\/|$)/.test(pathname) && !pathname.includes(".");
  if (publicPage && LAUNCH_MODE === "full") {
    try {
      const route = routePublicUrl(pathname, await fetchPublicUrlRules());
      if (route) {
        const target = request.nextUrl.clone(); target.pathname = route.path;
        if (route.kind === "redirect") response = NextResponse.redirect(target, 308);
        else {
          const headers = new Headers(request.headers);
          headers.set("x-wellplace-public-path", pathname);
          response = NextResponse.rewrite(target, { request: { headers } });
        }
      }
    } catch {
      // Keep the built-in public routes available during a content-store outage.
    }
  }

  if (isNeverIndexed || !isProduction || request.cookies.has(CMS_PREVIEW_COOKIE)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
