import Link from "next/link";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";

import { TodayBookingCountdown } from "@/components/marketing/today-booking-countdown";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import type {
  ResolvedConceptChapter,
  ResolvedConceptContent,
} from "@/lib/config/cms/concept-content";
import { CONCEPT_FINALE, CONCEPT_STORY_LABELS } from "@/lib/config/concept";
import { MARKETING_BOOK_HREF } from "@/lib/config/marketing";
import type { TodayBookingStatus } from "@/lib/services/today-booking-service";
import { cn } from "@/lib/utils";

const LABELS = CONCEPT_STORY_LABELS;

function chapterId(position: number): string {
  return `concept-chapter-${position}`;
}

function splitWords(value: string): readonly string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function ChapterIndex({ chapters }: { chapters: readonly ResolvedConceptChapter[] }) {
  return (
    <nav aria-label={LABELS.indexTitle} className="mt-8 text-left sm:mt-10">
      <p className="font-data text-micro font-medium tracking-kicker text-band-muted uppercase">
        {LABELS.indexTitle}
      </p>
      <ol className="mt-3 border-t border-band-line">
        {chapters.map((chapter, index) => (
          <li key={`${chapter.number}-${index}`} className="border-b border-band-line">
            <a
              href={`#${chapterId(index + 1)}`}
              className="group flex items-center gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-band-accent sm:py-3.5"
            >
              <span className="w-7 shrink-0 font-data text-small text-band-accent">
                {chapter.number || String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-data text-micro tracking-label text-band-muted uppercase">
                  {chapter.eyebrow}
                </span>
                <span className="mt-0.5 block font-display text-body text-band-ink text-pretty sm:text-lead">
                  {chapter.title}{" "}
                  <em className="font-accent font-medium text-band-accent italic">{chapter.accent}</em>
                </span>
              </span>
              <span
                aria-hidden="true"
                className="relative hidden h-12 w-18 shrink-0 overflow-hidden rounded-(--radius-card) border border-band-line xs:block"
              >
                <MediaFrame
                  src={chapter.image}
                  alt=""
                  sizes="5rem"
                  frameClassName="absolute inset-0"
                  className="scale-110 object-cover blur-[3px] brightness-75 transition-[filter,scale] duration-500 group-hover:scale-100 group-hover:blur-none group-hover:brightness-100 group-focus-visible:scale-100 group-focus-visible:blur-none group-focus-visible:brightness-100 motion-reduce:transition-none"
                />
              </span>
              <ArrowRightIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-band-muted transition-[translate,color] duration-300 group-hover:translate-x-1 group-hover:text-band-accent motion-reduce:transition-none"
              />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StoryChapter({
  chapter,
  position,
  total,
}: {
  chapter: ResolvedConceptChapter;
  position: number;
  total: number;
}) {
  const mediaFirst = chapter.mediaSide === "left";
  const number = chapter.number || String(position).padStart(2, "0");

  return (
    <section
      id={chapterId(position)}
      data-concept-chapter
      aria-labelledby={`${chapterId(position)}-title`}
      className="relative border-t border-border bg-surface-base transition-colors duration-500 motion-reduce:transition-none lg:h-concept-chapter-stage"
    >
      <div className="grid lg:sticky lg:top-0 lg:h-svh lg:grid-cols-2">
        <div
          className={cn(
            "relative px-5 pt-10 xs:px-6 sm:px-10 sm:pt-14 lg:h-svh lg:p-0",
            mediaFirst ? "lg:order-1" : "lg:order-2",
          )}
        >
          <div
            data-concept-frame
            className="relative aspect-4/5 overflow-hidden rounded-(--radius-modal) bg-band-deep sm:aspect-16/10 lg:absolute lg:inset-0 lg:aspect-auto lg:rounded-none"
          >
            <div data-concept-image className="absolute inset-0">
              <MediaFrame
                src={chapter.image}
                alt={chapter.imageAlt}
                sizes="(min-width: 1024px) 50vw, 100vw"
                frameClassName="absolute inset-0"
                className="object-cover object-center"
              />
            </div>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-scrim-ink/80 via-scrim-ink/15 to-transparent"
            />
            <p className="absolute right-5 bottom-5 left-5 hidden max-w-md text-small leading-relaxed text-on-scrim text-pretty lg:right-auto lg:bottom-10 lg:left-10 lg:block xl:text-body">
              {chapter.body}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "relative flex items-center px-5 pt-8 pb-14 xs:px-6 sm:px-10 sm:pt-10 sm:pb-20 lg:h-svh lg:px-14 lg:pt-nav lg:pb-8 xl:px-20",
            mediaFirst ? "lg:order-2" : "lg:order-1",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-4 right-5 font-display text-reservation leading-none text-text-primary/10 sm:right-8 lg:hidden"
          >
            {number}
          </span>

          <div className="relative z-10 w-full max-w-xl">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 bottom-full mb-4 hidden font-display text-reservation leading-none text-text-primary/10 lg:block"
            >
              {number}
            </span>
            <p
              data-concept-intro
              className="flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-brand uppercase"
            >
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {LABELS.chapter} {number}
              <span className="text-text-muted">
                {LABELS.of} {String(total).padStart(2, "0")}
              </span>
            </p>
            <p
              data-concept-intro
              className="mt-3 font-data text-micro tracking-label text-text-muted uppercase"
            >
              {chapter.eyebrow}
            </p>
            <h2
              id={`${chapterId(position)}-title`}
              className="mt-3 font-display text-h2 leading-tight tracking-display text-text-primary sm:text-h1 lg:text-h2 xl:text-h1"
            >
              {splitWords(chapter.title).map((word, index) => (
                <span key={`${word}-${index}`} className="concept-word">
                  <span className="concept-word-inner">{word}&nbsp;</span>
                </span>
              ))}
              <span className="concept-word">
                <em className="concept-word-inner font-accent font-medium text-brand italic">
                  {chapter.accent}
                </em>
              </span>
            </h2>

            {chapter.details.length > 0 ? (
              <ol className="mt-7 flex flex-col gap-4 sm:mt-8 xl:gap-5">
                {chapter.details.map((line, index) => (
                  <li
                    key={`${line}-${index}`}
                    data-concept-line
                    className="relative pl-5 font-display text-lead leading-snug text-text-primary text-pretty xl:text-h3"
                  >
                    <span aria-hidden="true" className="absolute inset-y-1 left-0 w-px bg-border" />
                    <span
                      aria-hidden="true"
                      data-concept-line-rule
                      className="absolute inset-y-1 left-0 w-px origin-top bg-brand"
                    />
                    {line}
                  </li>
                ))}
              </ol>
            ) : null}

            <p className="mt-6 text-small leading-relaxed text-text-secondary text-pretty lg:hidden">
              {chapter.body}
            </p>

          </div>
        </div>
      </div>
    </section>
  );
}

function StoryFinale({ image, todayStatus }: { image: string | undefined; todayStatus: TodayBookingStatus | null }) {
  return (
    <section
      id="concept-finale"
      aria-labelledby="concept-finale-title"
      className="relative isolate scroll-mt-nav overflow-hidden bg-band-deep px-5 py-20 text-center text-band-ink xs:px-6 sm:px-10 sm:py-28 lg:py-36"
    >
      {image ? (
        <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-35">
          <MediaFrame
            src={image}
            alt=""
            sizes="100vw"
            frameClassName="absolute inset-0 bg-transparent"
            className="object-cover object-center blur-sm"
          />
        </div>
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-b from-band-deep via-band-deep/80 to-band-deep"
      />
      {todayStatus ? (
        <div className="mb-12 sm:mb-16">
          <TodayBookingCountdown status={todayStatus} bookHref={MARKETING_BOOK_HREF} refresh tone="band" />
        </div>
      ) : null}
      <div data-concept-finale className="mx-auto max-w-3xl">
        <p className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-current" />
          {LABELS.chapter} {CONCEPT_FINALE.number}
          <span aria-hidden="true" className="h-px w-8 bg-current" />
        </p>
        <h2
          id="concept-finale-title"
          className="mt-5 font-display text-h1 leading-none tracking-display text-band-ink text-balance sm:text-display"
        >
          {CONCEPT_FINALE.title}{" "}
          <em className="block font-accent font-medium text-band-accent italic">
            {CONCEPT_FINALE.accent}
          </em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-small leading-relaxed text-band-muted text-pretty sm:text-lead">
          {CONCEPT_FINALE.body}
        </p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 xs:flex-row xs:items-center">
          <Button asChild tone="band-accent" size="lg" className="min-h-tap px-7 shadow-(--shadow-md)">
            <Link href={MARKETING_BOOK_HREF}>
              {CONCEPT_FINALE.primaryLabel}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ConceptFomoStory({
  content,
  todayStatus,
}: {
  content: ResolvedConceptContent;
  todayStatus: TodayBookingStatus | null;
}) {
  const { hero, chapters } = content;
  const firstNumber = chapters[0]?.number || "01";

  return (
    <>
      <section
        id="concept-hero"
        className="relative isolate overflow-hidden bg-band-deep text-band-ink"
      >
        <div className="absolute inset-0 -z-30 lg:left-1/2 xl:left-2/5">
          <div data-concept-hero-image className="absolute inset-0">
            <MediaFrame
              src={hero.image}
              alt={hero.imageAlt}
              sizes="(min-width: 1024px) 60vw, 100vw"
              preload
              frameClassName="absolute inset-0"
              className="object-cover object-center"
            />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-linear-to-t from-band-deep via-band-deep/80 to-band-deep/45 lg:hidden"
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 -z-20 hidden w-1/2 bg-band-deep lg:block xl:w-2/5"
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 -z-10 hidden w-1/4 bg-linear-to-r from-band-deep to-transparent lg:block xl:left-2/5 xl:w-1/5"
        />

        <div className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-5 pt-nav pb-12 xs:px-6 sm:px-10 sm:pb-16 lg:px-14 lg:pb-12">
          <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:w-1/2 lg:pr-12 lg:text-left xl:w-2/5">
            <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {hero.eyebrow}
            </span>
            <h1 className="mt-5 font-display text-display leading-none tracking-display text-band-ink text-balance">
              <span className="block">{hero.title}</span>
              <em className="block font-accent font-medium text-band-accent italic">
                {hero.accent}
              </em>
            </h1>
            <p className="mx-auto mt-5 max-w-measure text-small leading-relaxed text-band-muted text-pretty sm:text-lead lg:mx-0">
              {hero.body}
            </p>

            {chapters.length > 0 ? <ChapterIndex chapters={chapters} /> : null}

            {chapters.length > 0 ? (
              <Button
                asChild
                tone="band-accent"
                size="lg"
                className="mt-8 min-h-tap w-full px-7 shadow-(--shadow-md) xs:w-auto"
              >
                <a href={`#${chapterId(1)}`}>
                  {LABELS.begin} {firstNumber}
                  <ArrowDownIcon aria-hidden="true" data-icon="inline-end" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <div id="concept-story" className="relative">
        {chapters.map((chapter, index) => (
          <StoryChapter
            key={`${chapter.number}-${index}`}
            chapter={chapter}
            position={index + 1}
            total={chapters.length}
          />
        ))}
      </div>

      <StoryFinale image={chapters.at(-1)?.image ?? hero.image} todayStatus={todayStatus} />
    </>
  );
}
