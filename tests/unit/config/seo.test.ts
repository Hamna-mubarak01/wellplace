import { describe, expect, it } from "vitest";

import {
  SITE_URL,
  absoluteUrl,
  breadcrumbJsonLd,
  faqJsonLd,
  organisationJsonLd,
  pageMetadata,
} from "@/lib/config/seo";

describe("SEO metadata [§5.3]", () => {
  it("builds absolute canonical URLs from the one public origin", () => {
    expect(absoluteUrl("/")).toBe(SITE_URL);
    expect(absoluteUrl("/book")).toBe(`${SITE_URL}/book`);
  });

  it("marks non-indexable pages for every crawler", () => {
    const metadata = pageMetadata({
      title: "Preview",
      description: "A preview page.",
      path: "/preview",
      indexable: false,
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });

  it("publishes the venue address and maps link in LocalBusiness data", () => {
    const serialized = JSON.stringify(organisationJsonLd());

    expect(serialized).toContain("LocalBusiness");
    expect(serialized).toContain("Lantern Court");
    expect(serialized).toContain("hasMap");
  });

  it("converts visible FAQs into FAQPage structured data", () => {
    const data = faqJsonLd([{ q: "Is there parking?", a: "Yes, on site." }]);

    expect(data).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is there parking?",
          acceptedAnswer: { "@type": "Answer", text: "Yes, on site." },
        },
      ],
    });
  });

  it("uses absolute, ordered URLs for breadcrumb structured data", () => {
    const data = breadcrumbJsonLd([
      { name: "WellPlace", path: "/" },
      { name: "Book a suite", path: "/book" },
    ]);

    expect(data).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: SITE_URL },
        { position: 2, item: `${SITE_URL}/book` },
      ],
    });
  });
});
