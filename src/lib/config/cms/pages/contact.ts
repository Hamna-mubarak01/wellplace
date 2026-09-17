import { image, paragraph, text } from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { CONTACT_PAGE_CONTENT } from "@/lib/config/contact";
import { OG_IMAGE } from "@/lib/config/seo";

const contact = CONTACT_PAGE_CONTENT;

export const CONTACT_CMS_PAGE: CmsPageSpec = {
  slug: "contact",
  label: "Contact page",
  description: "The banner, the message form and the contact options beside it.",
  icon: "phone",
  group: "Pages",
  route: "/contact",
  editableNote:
    "Contact email and address are in Management → Settings → Contact information. Opening hours are in Settings → Booking schedule.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "image",
      title: "Hero section",
      description: "The banner at the top of the contact page.",
      fields: [
        text("eyebrow", "Eyebrow", contact.hero.eyebrow),
        text("title", "Headline", contact.hero.title),
        text("accent", "Headline accent", contact.hero.accent, "Rendered in the italic accent face."),
        paragraph("body", "Subheading", contact.description),
        image("image", "Background image", contact.hero.image, "1920×1080px or wider."),
      ],
    },
    {
      key: "form",
      label: "Form",
      icon: "message",
      title: "Message form",
      description: "Every label, placeholder and message on the form beside the contact options.",
      fields: [
        text("heading", "Heading", contact.form.heading),
        paragraph("description", "Introduction", contact.form.description),
        text("firstNameLabel", "First name label", contact.form.firstNameLabel),
        text("firstNamePlaceholder", "First name placeholder", contact.form.firstNamePlaceholder),
        text("lastNameLabel", "Last name label", contact.form.lastNameLabel),
        text("lastNamePlaceholder", "Last name placeholder", contact.form.lastNamePlaceholder),
        text("emailLabel", "Email label", contact.form.emailLabel),
        text("emailPlaceholder", "Email placeholder", contact.form.emailPlaceholder),
        text("phoneLabel", "Mobile number label", contact.form.phoneLabel),
        text("messageLabel", "Message label", contact.form.messageLabel),
        text("messagePlaceholder", "Message placeholder", contact.form.messagePlaceholder),
        paragraph("invalidBanner", "Missing fields warning", contact.form.invalidBanner),
        text("submitLabel", "Send button text", contact.form.submitLabel),
        text("pendingLabel", "Send button text while sending", contact.form.pendingLabel),
        text("successHeading", "Sent heading", contact.form.successHeading),
        paragraph("successDescription", "Sent message", contact.form.successDescription),
        text("resetLabel", "Send another button text", contact.form.resetLabel),
        text("sentTitle", "Sent toast title", contact.form.sentTitle),
        paragraph("sentBody", "Sent toast message", contact.form.sentBody),
        text("rateLimitedTitle", "Too many messages title", contact.form.rateLimitedTitle),
        paragraph("rateLimitedBody", "Too many messages text", contact.form.rateLimitedBody),
        text("errorTitle", "Send failed title", contact.form.errorTitle),
        paragraph("errorBody", "Send failed text", contact.form.errorBody),
      ],
    },
    {
      key: "methods",
      label: "Contact options",
      icon: "phone",
      title: "Contact options",
      description:
        "The card beside the form. The email address and opening hours come from site settings — these are the words around them.",
      fields: [
        text("heading", "Heading", contact.methods.heading),
        paragraph("description", "Introduction", contact.methods.description),
        text("loadingLabel", "Loading label", contact.methods.loadingLabel),
        text("emailTitle", "Email heading", contact.methods.emailTitle),
        paragraph("emailFallback", "Shown when no email is set", contact.methods.emailFallback),
        text("visitTitle", "Visit heading", contact.methods.visitTitle),
        text("directionsLabel", "Directions button text", contact.methods.directionsLabel),
        text("hoursTitle", "Opening hours heading", contact.methods.hoursTitle),
        paragraph("unpublishedHours", "Shown before hours are published", contact.methods.unpublishedHours),
        text("closedLabel", "Closed day label", contact.methods.closedLabel),
      ],
    },
    {
      key: "seo",
      label: "SEO",
      icon: "search",
      title: "Search and sharing",
      description:
        "Publish to apply this page’s title, description and image to search and link previews. Leave a field empty to keep the default.",
      fields: [
        text("title", "Page title", contact.title, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", contact.description, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
