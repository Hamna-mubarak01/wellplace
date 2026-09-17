import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("social previews without staging search indexing — §5.3, §13, CLIENT", () => {
  it.each(["development", "staging"])("allows sharing crawlers on %s but blocks general crawling", async (environment) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
    vi.resetModules();
    const { default: robots } = await import("@/app/robots");
    const result = robots();

    expect(result.rules).toEqual([
      { userAgent: "*", disallow: "/" },
      {
        userAgent: expect.arrayContaining(["WhatsApp", "facebookexternalhit", "Twitterbot"]),
        allow: "/",
        disallow: expect.arrayContaining(["/manage", "/reception", "/booking/", "/auth/", "/api/"]),
      },
    ]);
    expect(result.sitemap).toBeUndefined();
  });

  it("keeps production crawl access and excludes private routes", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.resetModules();
    const { default: robots } = await import("@/app/robots");

    expect(robots()).toMatchObject({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: expect.arrayContaining(["/manage", "/reception", "/booking/", "/auth/", "/api/"]),
      },
      sitemap: expect.stringContaining("/sitemap.xml"),
    });
  });
});
