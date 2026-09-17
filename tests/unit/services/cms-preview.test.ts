import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ enabled: false, slug: "home", role: null as string | null }));
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: state.enabled }),
  cookies: async () => ({ get: () => ({ value: state.slug }) }),
}));
vi.mock("@/lib/auth/session", () => ({ readStaffSession: async () => state.role ? { role: state.role } : null }));
vi.mock("@/lib/db/queries/cms", () => ({
  fetchPublishedCmsContent: vi.fn(async () => ({ hero: { title: "Published" } })),
  fetchPublishedCmsContentMany: vi.fn(async () => new Map([["home", { hero: { title: "Published" } }], ["footer", { brand: { tagline: "Live footer" } }]])),
  fetchCmsContent: vi.fn(async () => ({ draft: { hero: { title: "Draft" } } })),
}));

import { fetchCmsContent } from "@/lib/db/queries/cms";
import type { WellPlaceClient } from "@/lib/db/types";
import { getCmsPreviewSlug, readSiteCms, readSiteCmsMany } from "@/lib/services/cms-preview";
const client = {} as WellPlaceClient;

beforeEach(() => { state.enabled = false; state.slug = "home"; state.role = null; vi.mocked(fetchCmsContent).mockClear(); });

describe("CMS draft preview boundary — §5.1, §13", () => {
  it("ignores old Loading CMS preview cookies — CLIENT removal", async () => {
    state.enabled = true; state.role = "management"; state.slug = "loading";
    expect(await getCmsPreviewSlug()).toBeNull();
    expect(fetchCmsContent).not.toHaveBeenCalled();
  });
  it("reads published content normally, without requesting a draft", async () => {
    expect(await readSiteCms(client, "home")).toEqual({ hero: { title: "Published" } });
    expect(fetchCmsContent).not.toHaveBeenCalled();
  });
  it.each([null, "reception"])("ignores forged preview cookies for role %s", async (role) => {
    state.enabled = true; state.role = role;
    expect(await readSiteCms(client, "home")).toEqual({ hero: { title: "Published" } });
    expect(fetchCmsContent).not.toHaveBeenCalled();
  });
  it("lets Management preview only the selected page", async () => {
    state.enabled = true; state.role = "management";
    expect(await readSiteCms(client, "home")).toEqual({ hero: { title: "Draft" } });
    expect(await readSiteCms(client, "concept")).toEqual({ hero: { title: "Published" } });
    expect(fetchCmsContent).toHaveBeenCalledExactlyOnceWith(client, "home");
  });
  it("preserves other publications in a shared-content read", async () => {
    state.enabled = true; state.role = "management";
    const content = await readSiteCmsMany(client, ["home", "footer"]);
    expect(content.get("home")).toEqual({ hero: { title: "Draft" } });
    expect(content.get("footer")).toEqual({ brand: { tagline: "Live footer" } });
  });
});
