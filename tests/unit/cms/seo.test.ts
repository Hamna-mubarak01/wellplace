import { describe, expect, it } from "vitest";

import { resolveBookingContent } from "@/lib/config/cms/book-content";
import { resolveConceptContent } from "@/lib/config/cms/concept-content";
import { resolveContactContent } from "@/lib/config/cms/contact-content";
import { resolveFaqContent } from "@/lib/config/cms/faq-content";
import { resolveHomeContent } from "@/lib/config/cms/home-content";
import { cmsPage } from "@/lib/config/cms/registry";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { resolveSuitesContent } from "@/lib/config/cms/suites-content";
import { pruneCmsValues, resolveCmsValues } from "@/lib/config/cms/values";
import { OG_IMAGE, SITE_NAME } from "@/lib/config/seo";

const pages = [
  { slug: "home", resolve: resolveHomeContent },
  { slug: "concept", resolve: resolveConceptContent },
  { slug: "suites", resolve: resolveSuitesContent },
  { slug: "book", resolve: resolveBookingContent },
  { slug: "faq", resolve: resolveFaqContent },
  { slug: "contact", resolve: resolveContactContent },
];

describe.each(pages)("$slug search and sharing metadata — §5.1, §5.3", ({ slug, resolve }) => {
  it("applies published SEO title and description to page, Open Graph and Twitter metadata", () => {
    const page = cmsPage(slug);
    if (!page) throw new Error(`Missing CMS page: ${slug}`);

    for (const version of ["First", "Replacement"]) {
      const title = `${version} ${slug} title`;
      const description = `${version} ${slug} description.`;
      const values = resolveCmsValues(page, {
        seo: { title: `  ${title}  `, description: `  ${description}  ` },
      });
      const published = pruneCmsValues(page, values);
      const metadata = cmsPageMetadata(
        { title: slug, description: page.description, path: page.route ?? "/" },
        resolve(published).seo,
      );
      const socialTitle = page.route === "/" ? title : `${title} · ${SITE_NAME}`;

      expect(metadata).toMatchObject({
        title,
        description,
        openGraph: { title: socialTitle, description },
        twitter: { title: socialTitle, description },
      });
    }
  });

  it.each(["title", "description"])("allows overriding only %s and keeps the other field's fallback", (field) => {
    const title = field === "title" ? "Custom title" : "Default title";
    const description = field === "description" ? "Custom description" : "Default description";
    const metadata = cmsPageMetadata(
      { title: "Default title", description: "Default description", path: "/" },
      resolve({
        seo: {
          title: field === "title" ? title : "  ",
          description: field === "description" ? description : "  ",
        },
      }).seo,
    );

    expect(metadata).toMatchObject({
      title,
      description,
      openGraph: { title, description },
      twitter: { title, description },
    });
  });

  it("preserves each uploaded replacement through saving, resolving and both social metadata formats", () => {
    const page = cmsPage(slug);
    if (!page) throw new Error(`Missing CMS page: ${slug}`);

    for (const filename of ["first.jpg", "replacement.png"]) {
      const image = `https://media.example.com/${slug}/${filename}`;
      const values = resolveCmsValues(page, { seo: { ogImage: image } });
      const published = pruneCmsValues(page, values);
      const metadata = cmsPageMetadata(
        { title: slug, description: page.description, path: page.route ?? "/" },
        resolve(published).seo,
      );

      expect(metadata.openGraph).toMatchObject({ images: [{ url: image }] });
      expect(metadata.twitter).toMatchObject({ images: [image] });
    }
  });

  it.each([null, { seo: { ogImage: "" } }, { seo: { ogImage: "javascript:alert(1)" } }])(
    "uses the built-in image for missing, removed or invalid uploads: %j",
    (published) => {
      const metadata = cmsPageMetadata(
        { title: slug, description: "Page description", path: `/${slug}` },
        resolve(published).seo,
      );
      expect(metadata.openGraph).toMatchObject({ images: [OG_IMAGE] });
      expect(metadata.twitter).toMatchObject({ images: [OG_IMAGE.url] });
    },
  );
});
