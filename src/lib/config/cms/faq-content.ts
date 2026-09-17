import { HOME_PAGE_CONTENT } from "@/lib/config/home";
import { FAQ_CMS_PAGE } from "@/lib/config/cms/pages/faq";
import { itemBool, itemStr, items, str, strOr } from "@/lib/config/cms/read";
import { resolveSeo, type ResolvedSeo } from "@/lib/config/cms/seo";
import { resolveCmsValues } from "@/lib/config/cms/values";
import {
  FAQ_PAGE_CONTENT,
  FAQ_SHOW_ON_HOME_WHEN_UNSET,
  faqGroupId,
  type MarketingFaqEntry,
  type MarketingFaqGroup,
} from "@/lib/config/faq";

export interface ResolvedFaqContent {
  readonly hero: {
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly primaryLabel: string;
    readonly primaryHref: string;
    readonly secondaryLabel: string;
    readonly secondaryHref: string;
  };
  readonly homePreview: { readonly image: string; readonly imageAlt: string; readonly eyebrow: string; readonly title: string; readonly accent: string; readonly body: string; readonly linkLabel: string };
  readonly entries: readonly MarketingFaqEntry[];
  readonly answered: readonly MarketingFaqEntry[];
  readonly groups: readonly MarketingFaqGroup[];
  readonly emptyLabel: string;
  readonly homeEntries: readonly MarketingFaqEntry[];
  readonly seo: ResolvedSeo;
}

function uniqueByQuestion(
  entries: readonly MarketingFaqEntry[],
): readonly MarketingFaqEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveFaqContent(
  published: Record<string, unknown> | null | undefined,
  legacyHome?: Record<string, unknown> | null,
): ResolvedFaqContent {
  const values = resolveCmsValues(FAQ_CMS_PAGE, withLegacyHomeFaq(published, legacyHome));

  const rows = items(values, "questions", "entries")
    .map((row) => ({
      question: itemStr(row, "question").trim(),
      answer: itemStr(row, "answer").trim(),
      group: itemStr(row, "group").trim(),
      showOnHome: itemBool(row, "showOnHome", FAQ_SHOW_ON_HOME_WHEN_UNSET),
    }))
    .filter((row) => row.question.length > 0);

  const entries: readonly MarketingFaqEntry[] = rows.map((row) => ({
    q: row.question,
    a: row.answer,
  }));

  const order: string[] = [];
  const grouped = new Map<string, MarketingFaqEntry[]>();

  for (const row of rows) {
    if (row.answer.length === 0) continue;
    const heading = row.group || FAQ_PAGE_CONTENT.title;
    if (!grouped.has(heading)) {
      grouped.set(heading, []);
      order.push(heading);
    }
    grouped.get(heading)?.push({ q: row.question, a: row.answer });
  }

  const usedIds = new Set<string>();
  const groups: readonly MarketingFaqGroup[] = order.map((title, index) => {
    const base = faqGroupId(title, index);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return { id, title, entries: grouped.get(title) ?? [] };
  });

  return {
    hero: {
      title: strOr(values, "hero", "title", FAQ_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      primaryLabel: strOr(values, "hero", "primaryLabel", FAQ_PAGE_CONTENT.hero.primaryLabel),
      primaryHref: FAQ_PAGE_CONTENT.hero.primaryHref,
      secondaryLabel: strOr(values, "hero", "secondaryLabel", FAQ_PAGE_CONTENT.hero.secondaryLabel),
      secondaryHref: FAQ_PAGE_CONTENT.hero.secondaryHref,
    },
    homePreview: {
      image: strOr(values, "homePreview", "image", HOME_PAGE_CONTENT.faq.image),
      imageAlt: str(values, "homePreview", "imageAlt"),
      eyebrow: str(values, "homePreview", "eyebrow"),
      title: strOr(values, "homePreview", "title", HOME_PAGE_CONTENT.faq.title),
      accent: str(values, "homePreview", "accent"),
      body: str(values, "homePreview", "body"),
      linkLabel: strOr(values, "homePreview", "linkLabel", HOME_PAGE_CONTENT.faq.linkLabel),
    },
    entries,
    emptyLabel: strOr(values, "questions", "emptyLabel", FAQ_PAGE_CONTENT.emptyLabel),
    answered: uniqueByQuestion(entries.filter((entry) => entry.a.length > 0)),
    groups,
    homeEntries: rows
      .filter((row) => row.showOnHome)
      .map((row) => ({ q: row.question, a: row.answer })),
    seo: resolveSeo(values),
  };
}

export function withLegacyHomeFaq(content: Record<string, unknown> | null | undefined, legacyHome?: Record<string, unknown> | null): Record<string, unknown> {
  if (content?.homePreview !== undefined || !legacyHome?.faq) return content ?? {};
  return { ...content, homePreview: legacyHome.faq };
}
