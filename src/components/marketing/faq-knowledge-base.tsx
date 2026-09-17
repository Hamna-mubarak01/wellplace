"use client";

import {
  CalendarDaysIcon,
  CircleHelpIcon,
  LifeBuoyIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FAQ_KNOWLEDGE_BASE_LABELS,
  faqGroupDescription,
  type MarketingFaqGroup,
} from "@/lib/config/faq";

const GROUP_ICONS: readonly LucideIcon[] = [SparklesIcon, CalendarDaysIcon, LifeBuoyIcon];

function groupIcon(index: number): LucideIcon {
  return GROUP_ICONS[index] ?? CircleHelpIcon;
}

function DesktopKnowledgeBase({ groups, first }: { groups: readonly MarketingFaqGroup[]; first: MarketingFaqGroup }) {
  return (
    <Tabs
      defaultValue={first.id}
      orientation="vertical"
      className="hidden gap-12 rounded-(--radius-modal) border border-border bg-surface-sunken p-10 shadow-(--shadow-md) transition-colors duration-500 motion-reduce:transition-none lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]"
    >
      <div className="min-w-0">
        <p
          id="faq-topics-label"
          className="px-3 font-data text-micro font-medium tracking-kicker text-text-muted uppercase"
        >
          {FAQ_KNOWLEDGE_BASE_LABELS.topics}
        </p>
        <TabsList
          aria-labelledby="faq-topics-label"
          className="mt-4 flex h-auto w-full flex-col items-stretch gap-1.5 rounded-none bg-transparent p-0"
        >
          {groups.map((group, index) => {
            const Icon = groupIcon(index);
            return (
              <TabsTrigger
                key={group.id}
                value={group.id}
                className="h-auto min-h-tap w-full flex-none justify-start gap-3 rounded-(--radius-card) border-transparent px-3 py-2.5 text-left text-small font-medium whitespace-normal text-text-secondary transition-[background-color,color,box-shadow] duration-200 after:hidden hover:bg-surface-hover hover:text-text-primary data-active:bg-surface-raised data-active:font-semibold data-active:text-text-primary data-active:shadow-(--shadow-lg) dark:data-active:border-transparent dark:data-active:bg-surface-raised dark:data-active:text-text-primary motion-reduce:transition-none"
              >
                <Icon aria-hidden="true" className="size-4 text-brand" />
                {group.title}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {groups.map((group) => (
        <TabsContent
          key={group.id}
          value={group.id}
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <h2 className="font-display text-h2 tracking-display text-text-primary text-pretty">
            {group.title}
          </h2>
          <p className="mt-1.5 text-small text-text-muted text-pretty">
            {faqGroupDescription(group.title, group.entries.length)}
          </p>
          <FaqAccordion entries={group.entries} variant="soft" className="mt-7" />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function StackedKnowledgeBase({ groups }: { groups: readonly MarketingFaqGroup[] }) {
  return (
    <div className="flex flex-col gap-10 sm:gap-12 lg:hidden">
      {groups.map((group, index) => {
        const Icon = groupIcon(index);
        return (
          <section key={group.id} aria-labelledby={`faq-${group.id}`} className="min-w-0 scroll-mt-nav">
            <h2
              id={`faq-${group.id}`}
              className="flex items-center gap-2.5 font-display text-h3 tracking-display text-text-primary text-pretty"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0 text-brand" />
              {group.title}
            </h2>
            <p className="mt-1.5 text-small text-text-muted text-pretty">
              {faqGroupDescription(group.title, group.entries.length)}
            </p>
            <FaqAccordion entries={group.entries} variant="soft" className="mt-5" />
          </section>
        );
      })}
    </div>
  );
}

export function FaqKnowledgeBase({ groups }: { groups: readonly MarketingFaqGroup[] }) {
  const first = groups[0];
  if (!first) return null;

  return (
    <>
      <DesktopKnowledgeBase groups={groups} first={first} />
      <StackedKnowledgeBase groups={groups} />
    </>
  );
}
