import { SuiteFanCarousel } from "@/components/marketing/suite-fan-carousel";
import { SuitesCircuit } from "@/components/marketing/suites-circuit";
import { MediaFrame } from "@/components/shared/media-frame";
import type { ResolvedSuitesContent } from "@/lib/config/cms/suites-content";
import { hoursList, type SuiteFacts } from "@/lib/config/suites";

function SuitesHero({ hero }: { hero: ResolvedSuitesContent["hero"] }) {
  return (
    <section
      id="suites-hero"
      className="relative isolate flex min-h-hero-media items-center overflow-hidden bg-home-hero-surface px-5 pt-nav text-band-ink xs:px-6 sm:px-10 lg:px-14"
    >
      <MediaFrame
        src={hero.image}
        alt={hero.imageAlt}
        sizes="100vw"
        preload
        frameClassName="absolute inset-0 -z-30"
        className="object-center"
      />
      <span aria-hidden="true" className="absolute inset-0 -z-20 bg-band-deep/65" />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-b from-band-deep/45 via-band-deep/65 to-band-deep/90"
      />

      <header className="mx-auto w-full max-w-4xl py-16 text-center sm:py-20">
        <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
          <span aria-hidden="true" className="h-px w-8 bg-current" />
          {hero.eyebrow}
          <span aria-hidden="true" className="h-px w-8 bg-current" />
        </span>
        <h1 className="mt-5 font-display text-display leading-none tracking-display text-band-ink text-balance">
          {hero.title}{" "}
          <em className="font-accent font-medium text-band-accent italic">
            {hero.accent}
          </em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-small leading-relaxed text-band-muted text-pretty sm:mt-6 sm:text-lead">
          {hero.body}
        </p>
      </header>
    </section>
  );
}

export function SuitesExperience({ content, facts }: { content: ResolvedSuitesContent; facts: SuiteFacts }) {
  const { tour } = content;

  return (
    <>
      <SuitesHero hero={content.hero} />

      <section
        id="suite-tour"
        className="scroll-mt-nav overflow-hidden bg-surface-sunken px-4 pt-8 pb-6 text-text-primary transition-colors duration-500 motion-reduce:transition-none sm:px-0 sm:pt-10 sm:pb-8"
      >
        <header className="mx-auto max-w-4xl px-1 text-center sm:px-10 lg:px-14">
          <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-brand uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-current" />
            {tour.eyebrow}
            <span aria-hidden="true" className="h-px w-8 bg-current" />
          </span>
          <h2 className="mt-3 font-display text-h2 leading-tight tracking-display text-text-primary text-balance xl:text-h1">
            {tour.title}{" "}
            <em className="font-accent font-medium text-brand italic">
              {tour.accent}
            </em>
          </h2>
          <p className="mx-auto mt-3 max-w-measure-wide text-small leading-relaxed text-text-secondary text-pretty">
            {tour.body}
          </p>
        </header>

        <div className="mx-auto mt-5 w-full sm:mt-6">
          <SuiteFanCarousel cards={content.cards} />
        </div>
      </section>

      <SuitesCircuit hoursRange={facts.hours?.length ? hoursList(facts.hours) : null} />
    </>
  );
}
