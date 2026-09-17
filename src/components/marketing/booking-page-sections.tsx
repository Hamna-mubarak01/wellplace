import { MediaFrame } from "@/components/shared/media-frame";
import type {
  ResolvedBookingContent,
} from "@/lib/config/cms/book-content";

export function BookingPageHero({
  hero,
}: {
  hero: ResolvedBookingContent["hero"];
}) {
  return (
    <section
      id="book-hero"
      className="relative isolate flex min-h-hero-media items-center overflow-hidden bg-home-hero-surface px-5 pt-nav text-band-ink xs:px-6 sm:px-10 lg:px-14"
    >
      <MediaFrame
        src={hero.image}
        alt=""
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
