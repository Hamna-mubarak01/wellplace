import { CmsPreviewBanner } from "@/components/marketing/cms-preview-banner";
import { HomeFooter } from "@/components/marketing/home/home-footer";
import { SiteNav } from "@/components/marketing/home/home-nav";
import { MARKETING_BOOK_HREF } from "@/lib/config/marketing";
import { getSiteChrome } from "@/lib/services/site-content";
import type { SiteChromeVariant } from "@/lib/config/site-chrome";

export async function SiteNavSlot({ overlayHeroId, variant }: { overlayHeroId?: string; variant?: SiteChromeVariant }) {
  const { navbar } = await getSiteChrome();
  return (
    <>
    <CmsPreviewBanner />
    <SiteNav
      content={navbar}
      bookHref={MARKETING_BOOK_HREF}
      overlayHeroId={overlayHeroId}
      variant={variant}
    />
    </>
  );
}

export async function SiteFooterSlot({ variant }: { variant?: SiteChromeVariant } = {}) {
  const { navbar, footer } = await getSiteChrome();
  return <HomeFooter links={navbar.links} content={footer} logo={navbar.logo} variant={variant} />;
}
