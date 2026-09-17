import { Reveal } from "@/components/marketing/home/reveal";
import { SuitesCircuitExplorer } from "@/components/marketing/suites-circuit-explorer";
import { SUITE_CIRCUIT_CONTENT } from "@/lib/config/suites";

const CONTENT = SUITE_CIRCUIT_CONTENT;

export function SuitesCircuit({ hoursRange }: { hoursRange: string | null }) {
  return (
    <section
      id="suite-circuit"
      aria-labelledby="suite-circuit-title"
      className="bg-surface-base px-5 py-16 transition-colors duration-500 motion-reduce:transition-none xs:px-6 sm:px-10 sm:py-20 lg:px-14 lg:py-24"
    >
      <div className="mx-auto w-full max-w-6xl">
        <SuitesCircuitExplorer
          hoursRange={hoursRange}
          intro={
            <Reveal className="text-center lg:text-left">
              <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-brand uppercase">
                <span aria-hidden="true" className="h-px w-8 bg-current" />
                {CONTENT.eyebrow}
              </span>
              <h2
                id="suite-circuit-title"
                className="mt-4 font-display text-h2 leading-tight tracking-display text-text-primary text-balance sm:text-h1"
              >
                {CONTENT.title}{" "}
                <em className="font-accent font-medium text-brand italic">{CONTENT.accent}</em>
              </h2>
              <p className="mx-auto mt-5 max-w-measure text-small leading-relaxed text-text-secondary text-pretty sm:text-body lg:mx-0">
                {CONTENT.body}
              </p>
            </Reveal>
          }
        />
      </div>
    </section>
  );
}
