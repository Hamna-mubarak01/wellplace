import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";

const { published } = vi.hoisted(() => ({ published: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/queries/cms", () => ({ fetchPublishedCmsContent: published }));

import { siteIconResponse } from "@/lib/services/site-icon";
import { resolveNavbarContent } from "@/lib/config/cms/site-chrome-content";
import { GET as getPublishedIcon } from "@/app/api/site-icon/route";
import { SITE_ICON } from "@/lib/config/site-icon";

beforeEach(() => vi.resetAllMocks());

describe("Navbar branding — current client CMS request", () => {
  it("keeps fallback artwork outside automatic favicon metadata", () => {
    expect(existsSync("public/icon.png")).toBe(true);
    expect(existsSync("src/app/icon.png")).toBe(false);
    expect(existsSync("src/app/(site)/icon.ts")).toBe(false);
  });

  it("returns the current published upload URL, replacements and removal without caching", async () => {
    for (const favicon of ["https://example.test/first.ico", "https://example.test/replacement.png", ""]) {
      published.mockResolvedValue({ branding: { favicon } });
      const response = await getPublishedIcon();
      expect(await response.json()).toEqual({ url: favicon || SITE_ICON.fallback });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(published).toHaveBeenLastCalledWith({}, "navbar");
    }
  });

  it("does not return an icon API URL as an image", async () => {
    published.mockResolvedValue({ branding: { favicon: "/api/site-icon?anything" } });
    expect(await (await getPublishedIcon()).json()).toEqual({ url: SITE_ICON.fallback });
  });

  it("resolves the shared logo and favicon, and restores originals when removed", () => {
    const branding = { logo: "https://example.test/logo.png", favicon: "https://example.test/icon.png" };
    expect(resolveNavbarContent({ branding })).toMatchObject(branding);
    expect(resolveNavbarContent({ branding: { logo: "", favicon: "" } })).toMatchObject({ logo: "", favicon: "" });
    expect(resolveNavbarContent({ branding: { logo: "javascript:alert(1)", favicon: "//example.test/icon.png" } })).toMatchObject({ logo: "", favicon: "" });
  });

  it("reads only the publication and makes replacements recheckable", async () => {
    published.mockResolvedValue({ branding: { favicon: "https://example.test/published.png" } });
    const response = await siteIconResponse("/icon.png");
    expect(published).toHaveBeenCalledWith({}, "navbar");
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://example.test/published.png");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([null, {}, { branding: { favicon: "" } }, { branding: { favicon: "/icon?preview" } }, { branding: { favicon: "/favicon.ico" } }, { branding: { favicon: "javascript:alert(1)" } }])("uses the original for missing or invalid overrides: %j", async (content) => {
    published.mockResolvedValue(content);
    expect((await siteIconResponse("/icon.png")).headers.get("Location")).toBe("/icon.png");
  });

  it("keeps the original favicon available if CMS is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    published.mockRejectedValue(new Error("offline"));
    expect((await siteIconResponse("/site-icons/favicon.ico")).headers.get("Location")).toBe("/site-icons/favicon.ico");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
