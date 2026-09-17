import { Wordmark } from "@/components/shared/wordmark";
import { EMAIL_WORDMARK_SIZE } from "@/lib/config/message-header";
import { isHeaderImageUrl, type EmailHeaderDesign } from "@/lib/domain/email/header";
import { cn } from "@/lib/utils";

const ALIGN: Readonly<Record<EmailHeaderDesign["align"], string>> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

export function HeaderPreview({ design }: { design: EmailHeaderDesign }) {
  const wording = design.text.trim();
  const width = Number.isFinite(design.logoWidth) ? design.logoWidth : EMAIL_WORDMARK_SIZE.width;

  if (design.logo === "none" && wording === "") {
    return (
      <p className="text-center text-micro text-text-muted">
        This header is empty, so emails start straight with their content.
      </p>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", ALIGN[design.align])}>
      {design.logo === "wordmark" && (
        <Wordmark label="WellPlace" height={Math.round((width * EMAIL_WORDMARK_SIZE.height) / EMAIL_WORDMARK_SIZE.width)} />
      )}
      {design.logo === "custom" &&
        (isHeaderImageUrl(design.logoSrc) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={design.logoSrc}
            alt={design.logoAlt || "WellPlace"}
            width={width}
            referrerPolicy="no-referrer"
            className="h-auto max-w-full"
            style={{ width }}
          />
        ) : (
          <span className="text-micro text-text-muted">Upload a logo image to show it here.</span>
        ))}
      {wording !== "" && <p className="max-w-full text-console-body text-pretty text-text-secondary">{wording}</p>}
    </div>
  );
}
