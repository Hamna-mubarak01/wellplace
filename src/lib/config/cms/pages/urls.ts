import { choice, repeater, text } from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";

export const EDITABLE_PUBLIC_ROUTES = ["/concept", "/suites", "/faq", "/contact"] as const;
export const REDIRECT_TARGETS = ["/", ...EDITABLE_PUBLIC_ROUTES, "/book", "/waitlist", "/legal"] as const;
export const URLS_CMS_PAGE: CmsPageSpec = {
  slug: "urls", label: "Page URLs & redirects", description: "Public page addresses and redirects from previous or campaign URLs.",
  icon: "share", group: "Shared", route: null, revalidateRoutes: ["/", ...REDIRECT_TARGETS],
  editableNote: "Use paths such as /our-suites. When changing a custom path, add its previous path under Redirects. Booking, waitlist and legal addresses stay stable for confirmations and consent links.",
  sections: [
    { key: "pages", label: "Page URLs", title: "Public page URLs", icon: "share", description: "Existing addresses redirect automatically to the published address. Save and publish to apply.",
      fields: EDITABLE_PUBLIC_ROUTES.map((route) => text(route.slice(1), `${route.slice(1)} page URL`, route)) },
    { key: "redirects", label: "Redirects", title: "Redirects", icon: "share", description: "Send an old or campaign address directly to a public page. Redirects preserve campaign query parameters.",
      fields: [repeater("items", "Redirects", "Redirect", 50, [
        text("from", "Previous or campaign URL", ""),
        choice("target", "Destination page", REDIRECT_TARGETS.map((value) => ({ value, label: value })), "/"),
      ], [])] },
  ],
};
