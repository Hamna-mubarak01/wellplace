import { describeImage } from "@/lib/config/cms/image-alt";
import { CONTACT_CMS_PAGE } from "@/lib/config/cms/pages/contact";
import { str, strOr } from "@/lib/config/cms/read";
import { resolveSeo, type ResolvedSeo } from "@/lib/config/cms/seo";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { CONTACT_PAGE_CONTENT } from "@/lib/config/contact";

export interface ResolvedContactForm {
  readonly heading: string;
  readonly description: string;
  readonly firstNameLabel: string;
  readonly firstNamePlaceholder: string;
  readonly lastNameLabel: string;
  readonly lastNamePlaceholder: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly phoneLabel: string;
  readonly messageLabel: string;
  readonly messagePlaceholder: string;
  readonly invalidBanner: string;
  readonly submitLabel: string;
  readonly pendingLabel: string;
  readonly successHeading: string;
  readonly successDescription: string;
  readonly resetLabel: string;
  readonly sentTitle: string;
  readonly sentBody: string;
  readonly rateLimitedTitle: string;
  readonly rateLimitedBody: string;
  readonly errorTitle: string;
  readonly errorBody: string;
}

export interface ResolvedContactMethods {
  readonly heading: string;
  readonly description: string;
  readonly loadingLabel: string;
  readonly emailTitle: string;
  readonly emailFallback: string;
  readonly visitTitle: string;
  readonly directionsLabel: string;
  readonly hoursTitle: string;
  readonly unpublishedHours: string;
  readonly closedLabel: string;
}

export interface ResolvedContactContent {
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly image: string;
    readonly imageAlt: string;
  };
  readonly form: ResolvedContactForm;
  readonly methods: ResolvedContactMethods;
  readonly seo: ResolvedSeo;
}

function fallbackTo(value: string, fallback: string): string {
  return value.trim() || fallback;
}

export function resolveContactContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedContactContent {
  const values = resolveCmsValues(CONTACT_CMS_PAGE, published ?? null);
  const heroImage = str(values, "hero", "image");

  return {
    hero: {
      eyebrow: str(values, "hero", "eyebrow"),
      title: strOr(values, "hero", "title", CONTACT_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      image: heroImage,
      imageAlt: str(values, "hero", "imageAlt").trim() || describeImage(
        "contact.hero",
        heroImage,
        [str(values, "hero", "title"), str(values, "hero", "accent")],
        "Contact",
      ),
    },
    form: {
      heading: fallbackTo(str(values, "form", "heading"), CONTACT_PAGE_CONTENT.form.heading),
      description: fallbackTo(str(values, "form", "description"), CONTACT_PAGE_CONTENT.form.description),
      firstNameLabel: fallbackTo(str(values, "form", "firstNameLabel"), CONTACT_PAGE_CONTENT.form.firstNameLabel),
      firstNamePlaceholder: fallbackTo(str(values, "form", "firstNamePlaceholder"), CONTACT_PAGE_CONTENT.form.firstNamePlaceholder),
      lastNameLabel: fallbackTo(str(values, "form", "lastNameLabel"), CONTACT_PAGE_CONTENT.form.lastNameLabel),
      lastNamePlaceholder: fallbackTo(str(values, "form", "lastNamePlaceholder"), CONTACT_PAGE_CONTENT.form.lastNamePlaceholder),
      emailLabel: fallbackTo(str(values, "form", "emailLabel"), CONTACT_PAGE_CONTENT.form.emailLabel),
      emailPlaceholder: fallbackTo(str(values, "form", "emailPlaceholder"), CONTACT_PAGE_CONTENT.form.emailPlaceholder),
      phoneLabel: fallbackTo(str(values, "form", "phoneLabel"), CONTACT_PAGE_CONTENT.form.phoneLabel),
      messageLabel: fallbackTo(str(values, "form", "messageLabel"), CONTACT_PAGE_CONTENT.form.messageLabel),
      messagePlaceholder: fallbackTo(str(values, "form", "messagePlaceholder"), CONTACT_PAGE_CONTENT.form.messagePlaceholder),
      invalidBanner: fallbackTo(str(values, "form", "invalidBanner"), CONTACT_PAGE_CONTENT.form.invalidBanner),
      submitLabel: fallbackTo(str(values, "form", "submitLabel"), CONTACT_PAGE_CONTENT.form.submitLabel),
      pendingLabel: fallbackTo(str(values, "form", "pendingLabel"), CONTACT_PAGE_CONTENT.form.pendingLabel),
      successHeading: fallbackTo(str(values, "form", "successHeading"), CONTACT_PAGE_CONTENT.form.successHeading),
      successDescription: fallbackTo(str(values, "form", "successDescription"), CONTACT_PAGE_CONTENT.form.successDescription),
      resetLabel: fallbackTo(str(values, "form", "resetLabel"), CONTACT_PAGE_CONTENT.form.resetLabel),
      sentTitle: fallbackTo(str(values, "form", "sentTitle"), CONTACT_PAGE_CONTENT.form.sentTitle),
      sentBody: fallbackTo(str(values, "form", "sentBody"), CONTACT_PAGE_CONTENT.form.sentBody),
      rateLimitedTitle: fallbackTo(str(values, "form", "rateLimitedTitle"), CONTACT_PAGE_CONTENT.form.rateLimitedTitle),
      rateLimitedBody: fallbackTo(str(values, "form", "rateLimitedBody"), CONTACT_PAGE_CONTENT.form.rateLimitedBody),
      errorTitle: fallbackTo(str(values, "form", "errorTitle"), CONTACT_PAGE_CONTENT.form.errorTitle),
      errorBody: fallbackTo(str(values, "form", "errorBody"), CONTACT_PAGE_CONTENT.form.errorBody),
    },
    methods: {
      heading: fallbackTo(str(values, "methods", "heading"), CONTACT_PAGE_CONTENT.methods.heading),
      description: fallbackTo(str(values, "methods", "description"), CONTACT_PAGE_CONTENT.methods.description),
      loadingLabel: fallbackTo(str(values, "methods", "loadingLabel"), CONTACT_PAGE_CONTENT.methods.loadingLabel),
      emailTitle: fallbackTo(str(values, "methods", "emailTitle"), CONTACT_PAGE_CONTENT.methods.emailTitle),
      emailFallback: fallbackTo(str(values, "methods", "emailFallback"), CONTACT_PAGE_CONTENT.methods.emailFallback),
      visitTitle: fallbackTo(str(values, "methods", "visitTitle"), CONTACT_PAGE_CONTENT.methods.visitTitle),
      directionsLabel: fallbackTo(str(values, "methods", "directionsLabel"), CONTACT_PAGE_CONTENT.methods.directionsLabel),
      hoursTitle: fallbackTo(str(values, "methods", "hoursTitle"), CONTACT_PAGE_CONTENT.methods.hoursTitle),
      unpublishedHours: fallbackTo(str(values, "methods", "unpublishedHours"), CONTACT_PAGE_CONTENT.methods.unpublishedHours),
      closedLabel: fallbackTo(str(values, "methods", "closedLabel"), CONTACT_PAGE_CONTENT.methods.closedLabel),
    },
    seo: resolveSeo(values),
  };
}
