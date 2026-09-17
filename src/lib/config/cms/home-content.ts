import { DEFAULT_CONTENT_ICON } from "@/lib/config/cms/icons";
import { safeImageSrc } from "@/lib/config/cms/links";
import { HOME_CMS_PAGE } from "@/lib/config/cms/registry";
import { describeImage } from "@/lib/config/cms/image-alt";
import {
  itemStr,
  items,
  mediaItems,
  numberOr,
  str,
  strOr,
} from "@/lib/config/cms/read";
import { resolveCmsValues } from "@/lib/config/cms/values";
import {
  VENUE_ADDRESS_LINES,
  VENUE_DIRECTIONS_LINK,
  VENUE_MAP_LINK,
} from "@/lib/config/entity";
import { HOME_PAGE_CONTENT } from "@/lib/config/home";

export type HomeContent = typeof HOME_PAGE_CONTENT;

export interface HomeHeroMedia {
  readonly kind: "image" | "video";
  readonly url: string;
}

export interface ResolvedHomeContent {
  readonly hero: {
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly primaryLabel: string;
    readonly secondaryLabel: string;
    readonly mediaLabel: string;
    readonly poster: string;
    readonly slides: readonly HomeHeroMedia[];
  };
  readonly difference: {
    readonly eyebrow: string;
    readonly revealLabel: string;
    readonly swipeHint: string;
    readonly title: string;
    readonly accent: string;
    readonly cards: readonly {
      readonly label: string;
      readonly title: string;
      readonly backLabel: string;
      readonly backTitle: string;
      readonly icon: string;
      readonly detail: string;
      readonly action: string;
      readonly image: string;
      readonly imageAlt: string;
    }[];
  };
  readonly suite: {
    readonly eyebrow: string;
    readonly ctaLabel: string;
    readonly views: readonly {
      readonly label: string;
      readonly title: string;
      readonly emphasis: string;
      readonly body: string;
      readonly detailTitle: string;
      readonly detailBody: string;
      readonly image: string;
      readonly imageAlt: string;
    }[];
  };
  readonly bridge: { readonly image: string };
  readonly gallery: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly viewerCaption: string;
    readonly shots: readonly {
      readonly src: string;
      readonly alt: string;
      readonly orientation: "landscape" | "portrait";
    }[];
  };
  readonly location: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly openMapLabel: string;
    readonly directionsLabel: string;
    readonly mapLabel: string;
    readonly addressLines: readonly string[];
    readonly locality: string;
    readonly center: readonly [number, number];
    readonly mapZoom: number;
    readonly mapLink: string;
    readonly directionsLink: string;
  };
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly ogImage: string;
  };
}

export function resolveHomeContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedHomeContent {
  const values = resolveCmsValues(HOME_CMS_PAGE, published ?? null);

  const heroMedia = mediaItems(values, "hero", "slides").map((item) => ({ ...item, url: safeImageSrc(item.url, "") })).filter((item) => item.url);
  const staticImage = safeImageSrc(str(values, "hero", "staticImage"), "");

  const slides: readonly HomeHeroMedia[] =
    heroMedia.length > 0
      ? heroMedia.map((item) => ({ kind: item.kind, url: item.url }))
      : staticImage
        ? [{ kind: "image" as const, url: staticImage }]
        : HOME_PAGE_CONTENT.hero.slides.map((url) => ({
            kind: "image" as const,
            url,
          }));

  const latitude = numberOr(
    str(values, "location", "latitude"),
    Number(HOME_PAGE_CONTENT.location.latitude),
  );
  const longitude = numberOr(
    str(values, "location", "longitude"),
    Number(HOME_PAGE_CONTENT.location.longitude),
  );
  const mapZoom = Math.min(
    19,
    Math.max(1, Math.round(numberOr(str(values, "location", "mapZoom"), 16))),
  );

  return {
    hero: {
      title: strOr(values, "hero", "title", HOME_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      primaryLabel: strOr(values, "hero", "primaryLabel", HOME_PAGE_CONTENT.hero.primaryLabel),
      secondaryLabel: strOr(values, "hero", "secondaryLabel", HOME_PAGE_CONTENT.hero.secondaryLabel),
      mediaLabel:
        HOME_PAGE_CONTENT.hero.mediaLabel ||
        `${str(values, "hero", "title")} ${str(values, "hero", "accent")}`.trim(),
      poster: staticImage || HOME_PAGE_CONTENT.hero.slides[0],
      slides,
    },
    difference: {
      eyebrow: str(values, "difference", "eyebrow"),
      title: str(values, "difference", "title"),
      accent: str(values, "difference", "accent"),
      revealLabel: strOr(values, "difference", "revealLabel", HOME_PAGE_CONTENT.difference.revealLabel),
      swipeHint: strOr(values, "difference", "swipeHint", HOME_PAGE_CONTENT.difference.swipeHint),
      cards: items(values, "difference", "cards").map((card) => ({
        label: itemStr(card, "label"),
        title: itemStr(card, "title"),
        backLabel: itemStr(card, "backLabel").trim() || itemStr(card, "label"),
        backTitle: itemStr(card, "backTitle").trim() || itemStr(card, "title"),
        icon: itemStr(card, "icon") || DEFAULT_CONTENT_ICON,
        detail: itemStr(card, "detail"),
        action: itemStr(card, "action"),
        image: itemStr(card, "image"),
        imageAlt: itemStr(card, "imageAlt"),
      })),
    },
    suite: {
      eyebrow: str(values, "suite", "eyebrow"),
      ctaLabel: strOr(values, "suite", "ctaLabel", HOME_PAGE_CONTENT.suite.ctaLabel),
      views: items(values, "suite", "views").map((view, index) => ({
        label: itemStr(view, "label"),
        title: itemStr(view, "title"),
        emphasis: itemStr(view, "emphasis"),
        body: itemStr(view, "body"),
        detailTitle: itemStr(view, "detailTitle"),
        detailBody: itemStr(view, "detailBody"),
        image: itemStr(view, "image"),
        imageAlt: itemStr(view, "imageAlt").trim() || describeImage(
          "home.suite",
          itemStr(view, "image"),
          [itemStr(view, "label"), itemStr(view, "title"), itemStr(view, "emphasis")],
          `Suite view ${index + 1}`,
        ),
      })),
    },
    bridge: {
      image: str(values, "bridge", "image"),
    },
    gallery: {
      eyebrow: str(values, "gallery", "eyebrow"),
      title: str(values, "gallery", "title"),
      accent: str(values, "gallery", "accent"),
      body: str(values, "gallery", "body"),
      viewerCaption: strOr(values, "gallery", "viewerCaption", HOME_PAGE_CONTENT.gallery.viewerCaption),
      shots: items(values, "gallery", "shots")
        .filter((shot) => itemStr(shot, "image").trim())
        .map((shot, index) => ({
          src: itemStr(shot, "image"),
          alt: itemStr(shot, "imageAlt").trim() || describeImage(
            "home.gallery",
            itemStr(shot, "image"),
            [str(values, "gallery", "title"), str(values, "gallery", "accent")],
            `Image ${index + 1}`,
          ),
          orientation:
            itemStr(shot, "orientation") === "portrait"
              ? ("portrait" as const)
              : ("landscape" as const),
        })),
    },
    location: {
      eyebrow: str(values, "location", "eyebrow"),
      title: str(values, "location", "title"),
      accent: str(values, "location", "accent"),
      body: str(values, "location", "body"),
      openMapLabel: strOr(values, "location", "openMapLabel", HOME_PAGE_CONTENT.location.openMapLabel),
      directionsLabel: strOr(values, "location", "directionsLabel", HOME_PAGE_CONTENT.location.directionsLabel),
      mapLabel: strOr(values, "location", "mapLabel", HOME_PAGE_CONTENT.location.mapLabel),
      addressLines: VENUE_ADDRESS_LINES,
      locality: str(values, "location", "locality"),
      center: [latitude, longitude] as const,
      mapZoom,
      mapLink: VENUE_MAP_LINK,
      directionsLink: VENUE_DIRECTIONS_LINK,
    },
    seo: {
      title: str(values, "seo", "title"),
      description: str(values, "seo", "description"),
      ogImage: str(values, "seo", "ogImage"),
    },
  };
}
