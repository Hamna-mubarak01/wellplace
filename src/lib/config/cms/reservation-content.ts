import { RESERVATION_CMS_PAGE } from "@/lib/config/cms/pages/reservation";
import { itemBool, itemStr, items, str, strOr } from "@/lib/config/cms/read";
import { resolveCmsValues } from "@/lib/config/cms/values";
import {
  RESERVATION_CONTENT,
  RESERVATION_ENABLED_WHEN_UNSET,
  type ReservationPage,
} from "@/lib/config/reservation";

export interface ResolvedReservation {
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly body: string;
  readonly primaryLabel: string;
  readonly primaryHref: string;
  readonly image: string;
}

export interface ResolvedReservationContent {
  readonly shared: ResolvedReservation;
  readonly placements: ReadonlyMap<string, ResolvedReservation | null>;
}

export function resolveReservationContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedReservationContent {
  const values = resolveCmsValues(RESERVATION_CMS_PAGE, published ?? null);

  const shared: ResolvedReservation = {
    eyebrow: str(values, "content", "eyebrow"),
    title: strOr(values, "content", "title", RESERVATION_CONTENT.title),
    accent: str(values, "content", "accent"),
    body: str(values, "content", "body"),
    primaryLabel: str(values, "content", "primaryLabel"),
    primaryHref: RESERVATION_CONTENT.primaryHref,
    image: str(values, "content", "image"),
  };

  const placements = new Map<string, ResolvedReservation | null>();

  for (const row of items(values, "placement", "pages")) {
    const page = itemStr(row, "page");
    if (!page || placements.has(page)) continue;

    if (!itemBool(row, "enabled", RESERVATION_ENABLED_WHEN_UNSET)) {
      placements.set(page, null);
      continue;
    }

    placements.set(page, {
      eyebrow: itemStr(row, "eyebrow").trim() || shared.eyebrow,
      title: itemStr(row, "title").trim() || shared.title,
      accent: itemStr(row, "accent").trim() || shared.accent,
      body: itemStr(row, "body").trim() || shared.body,
      primaryLabel: itemStr(row, "primaryLabel").trim() || shared.primaryLabel,
      primaryHref: shared.primaryHref,
      image: itemStr(row, "image").trim() || shared.image,
    });
  }

  return { shared, placements };
}

export function reservationFor(
  content: ResolvedReservationContent,
  page: ReservationPage,
): ResolvedReservation | null {
  return content.placements.has(page)
    ? (content.placements.get(page) ?? null)
    : content.shared;
}
