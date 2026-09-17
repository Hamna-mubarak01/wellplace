import type { ReactNode } from "react";

import { CookieSettingsDialog } from "@/components/marketing/cookie-settings";
import { Button } from "@/components/shared/button";
import type { LegalSlug } from "@/lib/config/legal";


type Treatment =
  | "email"
  | "cookie-settings"
  | "emphasis";

interface Highlight {
  readonly phrase: string;
  readonly treatment: Treatment;
  readonly documents?: readonly LegalSlug[];
}

const HIGHLIGHTS: readonly Highlight[] = [
  { phrase: "privacy@wellplace.example", treatment: "email" },
  {
    phrase: "Cookie Settings",
    treatment: "cookie-settings",
    documents: ["cookie-policy"],
  },

  {
    phrase:
      "Joining does not guarantee a booking, membership, price, opening date or priority",
    treatment: "emphasis",
    documents: ["legal-terms"],
  },
  {
    phrase: "We do not collect health data",
    treatment: "emphasis",
    documents: ["privacy-policy"],
  },
  {
    phrase:
      "Full payment-card details are handled by the payment provider and are not stored by WellPlace",
    treatment: "emphasis",
    documents: ["privacy-policy"],
  },
  {
    phrase:
      "Full payment-card details and login credentials are never transmitted for advertising purposes",
    treatment: "emphasis",
    documents: ["privacy-policy"],
  },
  {
    phrase: "a maximum of 24 months from the last interaction",
    treatment: "emphasis",
    documents: ["privacy-policy"],
  },
  {
    phrase:
      "Where supported, personal identifiers are normalised and securely hashed before transmission",
    treatment: "emphasis",
  },
  {
    phrase: "You can opt out at any time",
    treatment: "emphasis",
    documents: ["marketing-terms"],
  },
  {
    phrase:
      "Full payment-card details and login credentials are never used for advertising matching",
    treatment: "emphasis",
    documents: ["cookie-policy"],
  },
  {
    phrase: "Necessary technologies remain active",
    treatment: "emphasis",
    documents: ["cookie-policy"],
  },
] as const;

interface Match {
  readonly at: number;
  readonly end: number;
  readonly treatment: Treatment;
}

function matchesIn(text: string, slug: LegalSlug): Match[] {
  const found: Match[] = [];

  for (const highlight of HIGHLIGHTS) {
    if (highlight.documents && !highlight.documents.includes(slug)) continue;

    for (
      let at = text.indexOf(highlight.phrase);
      at !== -1;
      at = text.indexOf(highlight.phrase, at + highlight.phrase.length)
    ) {
      found.push({
        at,
        end: at + highlight.phrase.length,
        treatment: highlight.treatment,
      });
    }
  }

  found.sort((a, b) => a.at - b.at || b.end - a.end);

  const kept: Match[] = [];
  let cursor = 0;
  for (const match of found) {
    if (match.at < cursor) continue;
    kept.push(match);
    cursor = match.end;
  }
  return kept;
}

const INLINE_LINK =
  "font-medium text-brand underline decoration-1 underline-offset-4 outline-none transition-colors duration-150 hover:text-brand-hover focus-visible:rounded-(--radius-inner) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function treat(match: Match, matched: string, key: number): ReactNode {
  switch (match.treatment) {
    case "email":
      return (
        <a key={key} href={`mailto:${matched}`} className={INLINE_LINK}>
          {matched}
        </a>
      );

    case "cookie-settings":
      return (
        <CookieSettingsDialog
          key={key}
          trigger={
            <Button type="button" variant="link" className={INLINE_LINK}>
              {matched}
            </Button>
          }
        />
      );

    case "emphasis":
      return (
        <strong key={key} className="font-medium text-text-primary">
          {matched}
        </strong>
      );
  }
}

export interface LegalTextProps {
  text: string;
  slug: LegalSlug;
}

export function LegalText({ text, slug }: LegalTextProps) {
  const matches = matchesIn(text, slug);
  if (matches.length === 0) return <>{text}</>;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.at > cursor) nodes.push(text.slice(cursor, match.at));
    nodes.push(treat(match, text.slice(match.at, match.end), index));
    cursor = match.end;
  });

  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
