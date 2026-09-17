import { MediaFrame } from "@/components/shared/media-frame";
import { Badge } from "@/components/ui/badge";
import type {
  ResolvedConceptChapter,
  ResolvedConceptContent,
} from "@/lib/config/cms/concept-content";
import { cn } from "@/lib/utils";

function splitWords(value: string): readonly string[] {
  return value.trim().split(/\s+/);
}

function StoryChapter({
  chapter,
  position,
}: {
  chapter: ResolvedConceptChapter;
  position: number;
}) {
  const mediaFirst = chapter.mediaSide === "left";

  return (
    <section
      id={`concept-chapter-${chapter.number || position}`}
      className="concept-story-chapter grid min-h-svh scroll-mt-nav border-t border-border bg-surface-base transition-colors duration-500 motion-reduce:transition-none lg:grid-cols-2"
    >
      <div
        className={cn(
          "relative min-h-hero-media overflow-hidden bg-band-deep lg:min-h-svh",
          mediaFirst ? "lg:order-1" : "lg:order-2",
        )}
      >
        <MediaFrame
          src={chapter.image}
          alt={chapter.imageAlt}
          sizes="(min-width: 1024px) 50vw, 100vw"
          frameClassName="absolute inset-0"
          className="concept-chapter-image object-center"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-scrim-ink/65 via-scrim-ink/10 to-transparent"
        />
      </div>

      <div
        className={cn(
          "relative flex items-center px-5 py-14 xs:px-6 sm:px-10 sm:py-20 lg:min-h-svh lg:px-14 lg:py-24 xl:px-20",
          mediaFirst ? "lg:order-2" : "lg:order-1",
        )}
      >
        <span
          aria-hidden="true"
          className="concept-reveal-number pointer-events-none absolute top-5 right-5 font-display text-reservation leading-none text-text-primary/10 sm:top-8 sm:right-8 lg:top-10 lg:right-10"
        >
          {chapter.number}
        </span>
        <div className="relative z-10 mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <span className="concept-reveal-piece concept-reveal-eyebrow inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-brand uppercase">
            <span
              aria-hidden="true"
              className="concept-reveal-rule h-px w-8 origin-left bg-current"
            />
            {chapter.eyebrow}
          </span>
          <h2 className="concept-chapter-title mt-4 font-display text-h2 leading-tight tracking-display text-text-primary sm:mt-5 sm:text-h1">
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
          <p className="concept-reveal-piece concept-reveal-body mt-5 max-w-measure text-small leading-relaxed text-text-secondary text-pretty sm:mt-6 sm:text-body">
            {chapter.body}
          </p>
          <div className="concept-reveal-piece concept-reveal-details mt-7 flex flex-wrap justify-center gap-2 sm:mt-8 lg:justify-start">
            {chapter.details.map((detail) => (
              <Badge
                key={detail}
                variant="outline"
                className="h-auto rounded-full border-border-interactive bg-transparent px-3 py-2 font-data text-micro font-medium tracking-pill text-text-secondary uppercase"
              >
                {detail}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ConceptStory({ content }: { content: ResolvedConceptContent }) {
  const { hero } = content;

  return (
    <>
      <section
        id="concept-hero"
        className="concept-hero-stage relative bg-home-hero-surface"
      >
        <div className="sticky top-0 isolate h-svh overflow-hidden bg-band-deep pt-nav text-band-ink">
          <div className="absolute inset-0 -z-30 lg:left-2/5">
            <MediaFrame
              src={hero.image}
              alt={hero.imageAlt}
              sizes="100vw"
              preload
              frameClassName="absolute inset-0"
              className="concept-hero-image object-center"
            />
          </div>
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-linear-to-t from-band-deep via-band-deep/45 to-band-deep/25 lg:hidden"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 -z-20 hidden w-2/5 bg-band-deep lg:block"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-2/5 -z-10 hidden w-1/5 bg-linear-to-r from-band-deep to-transparent lg:block"
          />

          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-5 xs:px-6 sm:px-10 lg:px-14">
            <div className="concept-hero-copy mx-auto w-full max-w-xl text-center lg:mx-0 lg:w-2/5 lg:pr-12 lg:text-left">
              <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                {hero.eyebrow}
              </span>
              <h1 className="mt-5 font-display text-display leading-none tracking-display text-band-ink text-balance sm:mt-6">
                <span className="block">{hero.title}</span>
                <em className="block font-accent font-medium text-band-accent italic">
                  {hero.accent}
                </em>
              </h1>
              <p className="mx-auto mt-5 max-w-measure text-small leading-relaxed text-band-muted text-pretty sm:mt-6 sm:text-lead lg:mx-0">
                {hero.body}
              </p>
            </div>
          </div>


        </div>
      </section>

      <div
        id="concept-story"
        className="concept-story-sequence relative"
      >
        <aside
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-transparent sm:w-12 lg:w-20 xl:w-24"
        >
          <div className="sticky top-nav flex h-concept-rail-viewport justify-center">
            <span className="concept-rail relative my-12 block w-px">
              <span aria-hidden="true" className="concept-rail-track absolute inset-0" />
              <span aria-hidden="true" className="concept-rail-fill absolute inset-x-0 top-0" />
              <span className="concept-rail-marker absolute left-1/2 top-0 flex items-center justify-center rounded-full">
                <span className="concept-rail-dot block rounded-full bg-brand" />
              </span>
            </span>
          </div>
        </aside>

        {content.chapters.map((chapter, index) => (
          <StoryChapter
            key={`${chapter.number}-${index}`}
            chapter={chapter}
            position={index + 1}
          />
        ))}
      </div>
    </>
  );
}
