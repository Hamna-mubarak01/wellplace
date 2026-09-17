import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/queries/public-urls", () => ({
  fetchPublicUrlRules: vi.fn(async () => ({ pages: { suites: "/private-suites" } })),
}));
vi.mock("@/lib/services/site-content", () => ({
  publicPagePath: vi.fn(async (path: string) => path),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function launchProxy(mode: string = "waitlist") {
  vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", mode);
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
  return (await import("@/proxy")).proxy;
}

describe("waitlist-only release [CLIENT 15 September 2026]", () => {
  it.each(["/", "/book", "/concept", "/suites", "/faq", "/contact", "/private-suites", "/campaign", "/booking/resume/token"])(
    "redirects %s to the waitlist without losing campaign parameters",
    async (path) => {
      const proxy = await launchProxy();
      const response = await proxy(new NextRequest(`https://wellplace.example${path}?utm_source=instagram`));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://wellplace.example/waitlist?utm_source=instagram");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
    },
  );

  it.each(["/waitlist", "/legal", "/legal/privacy-policy", "/api/site-icon", "/brand/logo.svg", "/renderings/suite-view-1-1920.webp", "/social/instagram.svg", "/flags/ae.svg", "/icon", "/icon.png", "/apple-icon.png", "/manifest.webmanifest", "/sitemap.xml", "/robots.txt"])(
    "keeps %s available",
    async (path) => {
      const proxy = await launchProxy();
      const response = await proxy(new NextRequest(`https://wellplace.example${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("allows waitlist submissions but does not forward unreleased-page submissions", async () => {
    const proxy = await launchProxy();
    const signup = await proxy(new NextRequest("https://wellplace.example/waitlist", { method: "POST" }));
    const booking = await proxy(new NextRequest("https://wellplace.example/book", { method: "POST" }));

    expect(signup.status).toBe(200);
    expect(booking.status).toBe(404);
    expect(booking.headers.get("location")).toBeNull();
  });

  it("preserves staff sign-in protection and return destinations", async () => {
    const proxy = await launchProxy();
    const response = await proxy(new NextRequest("https://wellplace.example/manage/waitlist"));

    expect(response.headers.get("location")).toBe("https://wellplace.example/sign-in");
    expect(response.cookies.get("wp-return-to")?.value).toBe("/manage/waitlist");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("does not apply public CMS rewrites to asset or utility paths during the waitlist launch", async () => {
    const proxy = await launchProxy();
    const { fetchPublicUrlRules } = await import("@/lib/db/queries/public-urls");
    const response = await proxy(new NextRequest("https://wellplace.example/brand/launch"));

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(fetchPublicUrlRules).not.toHaveBeenCalled();
  });

  it("defaults safely to the waitlist for an unrecognized launch mode", async () => {
    const proxy = await launchProxy("misspelled");
    expect((await proxy(new NextRequest("https://wellplace.example/"))).headers.get("location"))
      .toBe("https://wellplace.example/waitlist");
  });

  it("restores public routes and CMS redirects when full launch is enabled", async () => {
    const proxy = await launchProxy("full");
    const home = await proxy(new NextRequest("https://wellplace.example/"));
    const suites = await proxy(new NextRequest("https://wellplace.example/suites"));

    expect(home.status).toBe(200);
    expect(home.headers.get("location")).toBeNull();
    expect(suites.status).toBe(308);
    expect(suites.headers.get("location")).toBe("https://wellplace.example/private-suites");
  });

  it("publishes only the waitlist and legal pages in the launch sitemap", async () => {
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "waitlist");
    const { default: sitemap } = await import("@/app/sitemap");

    expect((await sitemap()).map((entry) => new URL(entry.url).pathname)).toEqual(["/waitlist", "/legal"]);
  });

  it("restores the full sitemap for the full launch", async () => {
    vi.stubEnv("NEXT_PUBLIC_LAUNCH_MODE", "full");
    const { default: sitemap } = await import("@/app/sitemap");

    expect((await sitemap()).map((entry) => new URL(entry.url).pathname))
      .toEqual(["/", "/book", "/contact", "/concept", "/suites", "/faq", "/waitlist", "/legal"]);
  });
});
