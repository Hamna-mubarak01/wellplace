import { BOOK_CMS_PAGE } from "@/lib/config/cms/pages/book";
import { describeImage } from "@/lib/config/cms/image-alt";
import { str, strOr, items } from "@/lib/config/cms/read";
import { resolveSeo, type ResolvedSeo } from "@/lib/config/cms/seo";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { BOOKING_PAGE_CONTENT } from "@/lib/config/booking-page";

export interface ResolvedBookingMessages {
  readonly widgetLabel: string;
  readonly loadingLabel: string;
  readonly settingsUnavailable: string;
  readonly rateLimited: string;
  readonly timesUnavailable: string;
  readonly systemUnreachable: string;
  readonly addonsUnavailable: string;
}

export interface ResolvedBookingContent {
  readonly gallery?: readonly { id: string; src: string; alt: string }[];
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly image: string;
  };
  readonly messages: ResolvedBookingMessages;
  readonly seo: ResolvedSeo;
}

function messageOr(value: string, fallback: string): string {
  return value.trim() || fallback;
}

export function resolveBookingContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedBookingContent {
  const values = resolveCmsValues(BOOK_CMS_PAGE, published ?? null);
  const fallback = BOOKING_PAGE_CONTENT.messages;

  return {
    gallery: items(values, "gallery", "views").map((item,index)=>{const src=String(item.src ?? "");return {id:`gallery-${index}`,src,alt:String(item.srcAlt ?? "").trim() || describeImage("booking.gallery",src,[],`View ${index + 1}`)};}).filter((item)=>item.src),
    hero: {
      eyebrow: str(values, "hero", "eyebrow"),
      title: strOr(values, "hero", "title", BOOKING_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      image: str(values, "hero", "image"),
    },
    messages: {
      widgetLabel: messageOr(str(values, "messages", "widgetLabel"), fallback.widgetLabel),
      loadingLabel: messageOr(str(values, "messages", "loadingLabel"), fallback.loadingLabel),
      settingsUnavailable: messageOr(
        str(values, "messages", "settingsUnavailable"),
        fallback.settingsUnavailable,
      ),
      rateLimited: messageOr(str(values, "messages", "rateLimited"), fallback.rateLimited),
      timesUnavailable: messageOr(
        str(values, "messages", "timesUnavailable"),
        fallback.timesUnavailable,
      ),
      systemUnreachable: messageOr(
        str(values, "messages", "systemUnreachable"),
        fallback.systemUnreachable,
      ),
      addonsUnavailable: messageOr(
        str(values, "messages", "addonsUnavailable"),
        fallback.addonsUnavailable,
      ),
    },
    seo: resolveSeo(values),
  };
}
