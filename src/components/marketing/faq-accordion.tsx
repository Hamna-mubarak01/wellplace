import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { MarketingFaqEntry } from "@/lib/config/faq";
import { cn } from "@/lib/utils";

export interface FaqAccordionProps {
  entries: readonly MarketingFaqEntry[];
  className?: string;
  compact?: boolean;
  variant?: "cards" | "lined" | "soft";
}

export function FaqAccordion({ entries, className, compact = false, variant = "cards" }: FaqAccordionProps) {
  // [§Owner Home FAQ reference, 15 Sep] Divider rows are used only by the Home preview.
  const lined = variant === "lined";
  const soft = variant === "soft";
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="faq-0"
      className={cn(lined ? "gap-0 motion-reduce:[&_[data-slot=accordion-content]]:animate-none" : "gap-3", className)}
    >
      {entries.map((entry, index) => (
        <AccordionItem
          key={`${index}-${entry.q}`}
          value={`faq-${index}`}
          className={cn(
            lined
              ? "border-b border-border-strong"
              : soft
                ? "overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised shadow-(--shadow-xs) not-last:border-b"
                : ["rounded-(--radius-card) border border-border bg-surface-raised shadow-(--shadow-xs)", compact ? "px-4 sm:px-5" : "px-5 sm:px-6"],
          )}
        >
          <AccordionTrigger
            className={cn(
              "font-body font-medium text-text-primary hover:text-brand hover:no-underline",
              lined && "min-h-tap gap-4 rounded-none motion-reduce:transition-none",
              soft
                ? "min-h-tap items-center gap-4 rounded-none px-4 py-4 text-small font-semibold transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary aria-expanded:bg-surface-active sm:px-5 motion-reduce:transition-none"
                : compact ? "py-4 text-small" : "py-5 text-body",
            )}
          >
            {entry.q}
          </AccordionTrigger>
          <AccordionContent
            className={cn(
              "max-w-measure-wide text-text-secondary text-pretty",
              lined && "h-auto",
              soft
                ? "px-4 pt-3 pb-4 text-small leading-relaxed sm:px-5"
                : compact ? "pr-7 pb-4 text-small" : "pr-8 pb-5 text-body",
            )}
          >
            {entry.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
