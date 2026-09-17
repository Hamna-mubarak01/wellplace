import { FOOTER_ICONS, isFooterHref, type EmailFooterDesign } from "@/lib/domain/email/footer";
import { footerIconPath } from "@/lib/config/message-footer";
import { isHeaderImageUrl, type EmailHeaderDesign } from "@/lib/domain/email/header";
import { DEFAULT_HEADER_DESIGN, EMAIL_WORDMARK_SIZE, MESSAGE_HEADER_LIMITS } from "@/lib/config/message-header";
import { EMAIL_FONTS, EMAIL_THEME as T } from "@/lib/messaging/email-theme";
import { sanitizeEmailHtml, emailHtmlText } from "@/lib/validation/email-html";
import { messageTextCss } from "@/lib/messaging/text-appearance";
import type { MessageTextAppearance } from "@/lib/domain/email/document";
import type { MessageButtonAppearance } from "@/lib/domain/email/document";
import { resolveMessageButtonAppearance } from "@/lib/validation/message-button";
import type { EmailAttachment } from "@/lib/messaging/types";


const escapeMap: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => escapeMap[character] ?? character);
}

export type RichAlign = "left" | "center" | "right";

const HEADER_ALIGNS: readonly RichAlign[] = ["left", "center", "right"];

const HEADER_IMAGE_MARGIN: Readonly<Record<RichAlign, string>> = {
  left: "0",
  center: "0 auto",
  right: "0 0 0 auto",
};

function renderHeader(document: EmailDocument): string {
  if (document.branding === false) return "";
  const design = document.headerDesign ?? DEFAULT_HEADER_DESIGN;
  const align = HEADER_ALIGNS.includes(design.align) ? design.align : "center";
  const width = Math.min(
    MESSAGE_HEADER_LIMITS.logoWidthMax,
    Math.max(MESSAGE_HEADER_LIMITS.logoWidthMin, Math.round(design.logoWidth) || EMAIL_WORDMARK_SIZE.width),
  );
  const imageStyle = `display:block;margin:${HEADER_IMAGE_MARGIN[align]};width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;`;
  const logo =
    design.logo === "wordmark"
      ? `<img src="${escapeHtml(document.assetBaseUrl)}/brand/wordmark-dark-email.png" width="${width}" height="${Math.round((width * EMAIL_WORDMARK_SIZE.height) / EMAIL_WORDMARK_SIZE.width)}" alt="WellPlace" style="${imageStyle}" />`
      : design.logo === "custom" && isHeaderImageUrl(design.logoSrc)
        ? `<img src="${escapeHtml(design.logoSrc)}" width="${width}" alt="${escapeHtml(design.logoAlt.trim() || "WellPlace")}" style="${imageStyle}" />`
        : "";
  const wording = design.text.trim();
  const line = wording
    ? `<p style="margin:${logo ? "12px" : "0"} 0 0;font-family:${EMAIL_FONTS.body};font-size:14px;line-height:20px;color:${T.textMuted};text-align:${align};">${escapeHtml(wording)}</p>`
    : "";
  if (logo === "" && line === "") return "";
  return `<tr><td align="${align}" style="padding:0 0 28px;">
      ${logo}${line}
    </td></tr>`;
}

export type RichSize = "small" | "normal" | "large";

export type EmailBlock =
  | { readonly kind: "layout"; readonly layout: "band" | "quote" | "columns" | "hero"; readonly columns: readonly { html: string; text: string }[]; readonly src?: string; readonly alt?: string }
  | { readonly kind: "video"; readonly src: string; readonly alt: string; readonly href: string; readonly label: string }
  | { readonly kind: "html"; readonly markup: string }

  | { kind: "eyebrow"; appearance?: MessageTextAppearance; text: string }
  | { kind: "heading"; appearance?: MessageTextAppearance; text: string }
  | { kind: "lead"; appearance?: MessageTextAppearance; text: string; html?: string }
  | { kind: "paragraph"; text: string }
  | { kind: "rich"; appearance?: MessageTextAppearance; text: string; html: string; align: RichAlign; size: RichSize }
  | { kind: "panel"; rows: ReadonlyArray<{ label: string; value: string }> }
  | { kind: "button"; label: string; href: string; appearance?: MessageButtonAppearance }
  | { kind: "divider" }
  | { kind: "spacer"; height: number }
  | { kind: "image"; src: string; alt: string; width: number }
  | { kind: "note"; appearance?: MessageTextAppearance; text: string; html?: string }
  | {
      kind: "links";
      label: string;
      items: ReadonlyArray<{ label: string; href: string }>;
    };

export interface EmailDocument {
  headerDesign?: EmailHeaderDesign;
  footerDesign?: EmailFooterDesign;
  branding?: boolean;
  subject: string;
  preheader?: string;
  blocks: readonly EmailBlock[];
  assetBaseUrl: string;
  footerLines?: readonly string[];
  social?: {
    readonly label: string;
    readonly items: ReadonlyArray<{
      readonly name: string;
      readonly href: string;
      readonly icon: string;
    }>;
  };
}

const OUTER_WIDTH = 600;

function heading(text: string, appearance?: MessageTextAppearance): string {
  return `<h1 style="margin:0 0 16px;font-family:${EMAIL_FONTS.display};font-size:30px;line-height:38px;font-weight:700;color:${T.textPrimary};letter-spacing:-0.01em;${messageTextCss(appearance)}">${escapeHtml(text)}</h1>`;
}

function eyebrow(text: string, appearance?: MessageTextAppearance): string {
  return `<p style="margin:0 0 12px;font-family:${EMAIL_FONTS.body};font-size:12px;line-height:16px;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;color:${T.textMuted};${messageTextCss(appearance)}">${escapeHtml(text)}</p>`;
}

function lead(text: string, html?: string, appearance?: MessageTextAppearance): string {
  return `<p style="margin:0 0 20px;font-family:${EMAIL_FONTS.body};font-size:19px;line-height:28px;color:${T.textSecondary};${messageTextCss(appearance)}">${html ?? escapeHtml(text)}</p>`;
}

const RICH_SIZES: Readonly<Record<RichSize, { size: number; height: number }>> = {
  small: { size: 15, height: 22 },
  normal: { size: 16, height: 25 },
  large: { size: 19, height: 28 },
};

function rich(html: string, align: RichAlign, size: RichSize, appearance?: MessageTextAppearance): string {
  const metrics = RICH_SIZES[size];
  return `<p style="margin:0 0 18px;font-family:${EMAIL_FONTS.body};font-size:${metrics.size}px;line-height:${metrics.height}px;color:${T.textSecondary};text-align:${align};${messageTextCss(appearance)}">${html}</p>`;
}

function spacer(height: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;
}

function image(src: string, alt: string, width: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td align="center">
    <img src="${escapeHtml(src)}" width="${width}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:10px;" />
  </td></tr></table>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 18px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:25px;color:${T.textSecondary};">${escapeHtml(text)}</p>`;
}

function note(text: string, html?: string, appearance?: MessageTextAppearance): string {
  return `<p style="margin:0 0 8px;font-family:${EMAIL_FONTS.body};font-size:13px;line-height:20px;color:${T.textMuted};${messageTextCss(appearance)}">${html ?? escapeHtml(text)}</p>`;
}

function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="height:1px;line-height:1px;font-size:0;background-color:${T.border};">&nbsp;</td></tr></table>`;
}

function panel(rows: ReadonlyArray<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      ({ label, value }, index) => `
        <tr>
          <td style="padding:${index === 0 ? "0" : "10px"} 0 0;font-family:${EMAIL_FONTS.body};font-size:12px;line-height:16px;font-weight:500;letter-spacing:0.10em;text-transform:uppercase;color:${T.textMuted};width:38%;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:${index === 0 ? "0" : "10px"} 0 0;font-family:${EMAIL_FONTS.data};font-size:15px;line-height:22px;color:${T.textPrimary};vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background-color:${T.panelBackground};border:1px solid ${T.border};border-radius:10px;">
    <tr><td style="padding:20px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
    </td></tr>
  </table>`;
}

function button(label: string, href: string, appearance?: MessageButtonAppearance): string {
  if (appearance) {
    const style = resolveMessageButtonAppearance(appearance);
    const fullWidth = style.width === "full";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;table-layout:fixed;"><tr><td align="${style.align}">
      <table role="presentation" ${fullWidth ? 'width="100%"' : ""} cellpadding="0" cellspacing="0" border="0" style="max-width:100%;"><tr><td bgcolor="${style.background}" style="border-radius:${style.radius}px;mso-padding-alt:${style.paddingY}px ${style.paddingX}px;">
        <a href="${escapeHtml(href)}" style="display:block;box-sizing:border-box;${fullWidth ? "width:100%;" : ""}background-color:${style.background};color:${style.textColor};font-family:${EMAIL_FONTS.body};font-size:16px;line-height:20px;font-weight:600;text-align:center;text-decoration:none;overflow-wrap:anywhere;padding:${style.paddingY}px ${style.paddingX}px;border-radius:${style.radius}px;">${escapeHtml(label)}</a>
      </td></tr></table>
    </td></tr></table>`;
  }
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;">
    <tr><td>
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="13%" strokecolor="${T.brand}" fillcolor="${T.brand}">
        <w:anchorlock/>
        <center style="color:${T.onBrand};font-family:sans-serif;font-size:16px;font-weight:600;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" style="display:inline-block;background-color:${T.brand};color:${T.onBrand};font-family:${EMAIL_FONTS.body};font-size:16px;line-height:20px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:6px;">${safeLabel}</a>
      <!--<![endif]-->
    </td></tr>
  </table>`;
}

function links(
  label: string,
  items: ReadonlyArray<{ label: string; href: string }>,
): string {
  const anchors = items
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}" style="font-family:${EMAIL_FONTS.body};font-size:16px;line-height:25px;font-weight:500;color:${T.brand};text-decoration:underline;">${escapeHtml(item.label)}</a>`,
    )
    .join(
      `<span style="font-family:${EMAIL_FONTS.body};font-size:16px;line-height:25px;color:${T.textMuted};">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`,
    );

  return `<p style="margin:0 0 6px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:25px;color:${T.textSecondary};">${escapeHtml(label)}</p>
<p style="margin:0 0 18px;">${anchors}</p>`;
}

function socialFooter(
  label: string,
  items: ReadonlyArray<{ name: string; href: string; icon: string }>,
  assetBaseUrl: string,
  design?: EmailFooterDesign,
): string {
  if (design) {
    const align = ["left", "center", "right"].includes(design.align) ? design.align : "center";
    const style = ["brand", "coloured", "monochrome"].includes(design.iconStyle) ? design.iconStyle : "brand";
    return `${label ? `<p style="margin:0 0 12px;font-family:${EMAIL_FONTS.body};font-size:12px;line-height:18px;color:${T.textMuted};">${escapeHtml(label)}</p>` : ""}<div style="text-align:${align};">${design.links
      .filter((item) => item.enabled && isFooterHref(item.href) && FOOTER_ICONS.includes(item.icon))
      .map((item) => `<a href="${escapeHtml(item.href)}" title="${escapeHtml(item.label)}" style="display:inline-block;margin:0 6px 12px;text-decoration:none;"><img src="${escapeHtml(assetBaseUrl + footerIconPath(item.icon, style))}" width="32" height="32" alt="${escapeHtml(item.label)}" style="display:block;width:32px;height:32px;border:0;" /></a>`).join("\n")}</div>`;
  }
  const cells = items
    .map(
      (item) => `<td style="padding:0 7px;">
          <a href="${escapeHtml(item.href)}" style="text-decoration:none;display:inline-block;">
            <img src="${escapeHtml(assetBaseUrl)}/email/social/${escapeHtml(item.icon)}.png"
                 width="22" height="22" alt="${escapeHtml(item.name)}"
                 style="display:block;width:22px;height:22px;border:0;outline:none;text-decoration:none;" />
          </a>
        </td>`,
    )
    .join("\n        ");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
    <tr><td align="center" style="padding:0 0 10px;font-family:${EMAIL_FONTS.body};font-size:12px;line-height:18px;letter-spacing:0.06em;text-transform:uppercase;color:${T.textMuted};">${escapeHtml(label)}</td></tr>
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
        ${cells}
      </tr></table>
    </td></tr>
  </table>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.kind) {
    case "html": return sanitizeEmailHtml(block.markup);
    case "video": return `<a href="${escapeHtml(block.href)}" style="text-decoration:none;">${image(block.src, block.alt, 520)}</a>${button(block.label, block.href)}`;
    case "layout": {
      const columns = block.columns.map((column) => `<td class="wp-column" style="vertical-align:top;padding:16px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:25px;color:${T.textPrimary};${block.layout === "quote" ? `font-style:italic;border-left:3px solid ${T.brand};` : ""}">${column.html}</td>`).join("");
      const picture = block.layout === "hero" && block.src?.startsWith("https://") ? image(block.src, block.alt ?? "", 520) : "";
      return `${picture}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;table-layout:fixed;${block.layout === "band" || block.layout === "hero" ? `background-color:${T.panelBackground};border-radius:10px;` : ""}"><tr>${columns}</tr></table>`;
    }

    case "eyebrow":   return eyebrow(block.text, block.appearance);
    case "heading":   return heading(block.text, block.appearance);
    case "lead":      return lead(block.text, block.html, block.appearance);
    case "paragraph": return paragraph(block.text);
    case "rich":      return rich(block.html, block.align, block.size, block.appearance);
    case "panel":     return panel(block.rows);
    case "button":    return button(block.label, block.href, block.appearance);
    case "divider":   return divider();
    case "spacer":    return spacer(block.height);
    case "image":     return image(block.src, block.alt, block.width);
    case "note":      return note(block.text, block.html, block.appearance);
    case "links":     return links(block.label, block.items);
  }
}

function blockAsText(block: EmailBlock): string {
  switch (block.kind) {
    case "html": return emailHtmlText(block.markup);
    case "layout": return block.columns.map((column) => column.text).join("\n\n");
    case "video": return `${block.label}: ${block.href}`;

    case "eyebrow":   return block.text.toUpperCase();
    case "heading":   return `${block.text}\n${"─".repeat(Math.min(block.text.length, 48))}`;
    case "lead":
    case "paragraph":
    case "rich":
    case "note":      return block.text;
    case "panel":     return block.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "button":    return `${block.label}: ${block.href}`;
    case "divider":   return "—";
    case "spacer":    return "";
    case "image":     return block.alt;
    case "links":
      return [block.label, ...block.items.map((i) => `${i.label}: ${i.href}`)].join("\n");
  }
}

export function renderEmail(document: EmailDocument): {
  html: string;
  text: string;
  attachments: readonly EmailAttachment[];
} {
  const footer = document.branding === false ? [] : document.footerLines ?? [];
  const design = document.footerDesign;
  const footerAlign = design && ["left", "center", "right"].includes(design.align) ? design.align : "center";
  const social = design ? {
    label: design.label,
    items: design.links.filter((item) => item.enabled && isFooterHref(item.href) && FOOTER_ICONS.includes(item.icon))
      .map((item) => ({ name: item.label, href: item.href, icon: item.icon })),
  } : document.social;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(document.subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style type="text/css">
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  a{color:${T.brand};}
  @media only screen and (max-width:620px){
    .wp-shell{width:100% !important;}
    .wp-column{display:block !important;width:auto !important;}
    .wp-pad{padding-left:24px !important;padding-right:24px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${T.pageBackground};">
${document.preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(document.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${T.pageBackground};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" class="wp-shell" width="${OUTER_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:${OUTER_WIDTH}px;max-width:${OUTER_WIDTH}px;">

    ${renderHeader(document)}

    <tr><td style="background-color:${T.cardBackground};border:1px solid ${T.border};border-radius:14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${T.brand};border-radius:14px 14px 0 0;">&nbsp;</td></tr>
        <tr><td class="wp-pad" style="padding:40px;">
          ${document.blocks.map(renderBlock).join("\n          ")}
        </td></tr>
      </table>
    </td></tr>

    ${document.branding !== false && design?.divider && (footer.length || social?.items.length) ? `<tr><td style="padding:24px 24px 0;"><div style="border-top:1px solid ${T.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>` : ""}
    ${
      document.branding !== false && social && social.items.length
        ? `<tr><td align="${footerAlign}" style="padding:30px 24px 0;">
      ${socialFooter(social.label, social.items, document.assetBaseUrl, design)}
    </td></tr>`
        : ""
    }

    ${
      footer.length
        ? `<tr><td align="${footerAlign}" style="padding:${document.branding !== false && social && social.items.length ? "2px" : "28px"} 24px 0;">
      ${footer
        .map(
          (line) =>
            `<p style="margin:0 0 6px;font-family:${EMAIL_FONTS.body};font-size:12px;line-height:18px;color:${T.textMuted};">${escapeHtml(line)}</p>`,
        )
        .join("\n      ")}
    </td></tr>`
        : ""
    }

  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "WELLPLACE",
    ...(document.branding !== false && (document.headerDesign?.text ?? "").trim()
      ? [(document.headerDesign?.text ?? "").trim()]
      : []),
    "",
    ...document.blocks.map(blockAsText).filter(Boolean),
    ...(document.branding !== false && social && social.items.length
      ? [
          "",
          social.label,
          social.items.map((i) => `${i.name}: ${i.href}`).join("\n"),
        ]
      : []),
    ...(footer.length ? ["", ...footer] : []),
  ].join("\n\n");

  return {
    html,
    text,
    attachments: [],
  };
}
