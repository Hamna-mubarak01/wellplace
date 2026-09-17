import sanitizeHtml from "sanitize-html";

export function sanitizeEmailHtml(markup: string): string {
  return sanitizeHtml(markup, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "hr",
      "div",
      "span",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      table: ["width", "cellpadding", "cellspacing", "role"],
      td: ["colspan", "rowspan", "width"],
      th: ["scope", "colspan"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [/^#[a-f\d]{3,8}$/i, /^rgb\([\d, ]+\)$/],
        "background-color": [/^#[a-f\d]{3,8}$/i, /^rgb\([\d, ]+\)$/],
        "text-align": [/^(left|center|right)$/],
        "font-size": [/^\d+(px|em|rem|%)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        "line-height": [/^[\d.]+(px|em|rem|%)?$/],
        padding: [/^[\d.]+(px|em|rem|%)( [\d.]+(px|em|rem|%)){0,3}$/],
        margin: [/^[\d.]+(px|em|rem|%)( [\d.]+(px|em|rem|%)){0,3}$/],
        width: [/^\d+(px|%)$/],
        "max-width": [/^\d+(px|%)$/],
      },
    },
  });
}

export function emailHtmlText(markup: string): string {
  return sanitizeHtml(markup.replace(/<\/(p|div|h[1-4]|li|tr)>/gi, "$&\n"), {
    allowedTags: [],
    allowedAttributes: {},
  });
}
