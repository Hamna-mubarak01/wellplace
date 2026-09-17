"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const DIM_LINE_OPACITY = 0.24;

export function ConceptFomoMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const media = gsap.matchMedia(root);

      media.add(
        {
          desktop: "(min-width: 64rem)",
          motion: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { desktop, motion } = context.conditions as { desktop: boolean; motion: boolean };
          if (!motion) return;

          const heroImage = root.querySelector<HTMLElement>("[data-concept-hero-image]");
          const hero = root.querySelector<HTMLElement>("#concept-hero");
          if (heroImage && hero) {
            gsap.fromTo(
              heroImage,
              { yPercent: 0, scale: 1.04 },
              {
                yPercent: 10,
                scale: 1,
                ease: "none",
                scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.5 },
              },
            );
          }

          root.querySelectorAll<HTMLElement>("[data-concept-chapter]").forEach((chapter) => {
            const frame = chapter.querySelector<HTMLElement>("[data-concept-frame]");
            const image = chapter.querySelector<HTMLElement>("[data-concept-image]");
            const intro = chapter.querySelectorAll<HTMLElement>("[data-concept-intro]");
            const words = chapter.querySelectorAll<HTMLElement>(".concept-word-inner");
            const lines = Array.from(chapter.querySelectorAll<HTMLElement>("[data-concept-line]"));

            const reveal = gsap.timeline({
              defaults: { ease: "power3.out" },
              scrollTrigger: { trigger: chapter, start: desktop ? "top 55%" : "top 75%", once: true },
            });
            if (intro.length) {
              reveal.fromTo(intro, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06 }, 0);
            }
            if (words.length) {
              reveal.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.055 }, 0.1);
            }

            if (desktop) {
              if (frame && image) {
                gsap
                  .timeline({
                    scrollTrigger: { trigger: chapter, start: "top bottom", end: "top top", scrub: 0.6 },
                  })
                  .fromTo(
                    frame,
                    { clipPath: "inset(14% 12% 14% 12% round 1.5rem)" },
                    { clipPath: "inset(0% 0% 0% 0% round 0rem)", ease: "none" },
                    0,
                  )
                  .fromTo(image, { scale: 1.04 }, { scale: 1, ease: "none" }, 0);
              }

              if (lines.length) {
                const story = gsap.timeline({
                  scrollTrigger: { trigger: chapter, start: "top top", end: "bottom bottom", scrub: 0.6 },
                });
                const step = 0.8 / lines.length;
                lines.forEach((line, index) => {
                  const rule = line.querySelector<HTMLElement>("[data-concept-line-rule]");
                  const at = 0.05 + index * step;
                  story.fromTo(line, { opacity: DIM_LINE_OPACITY }, { opacity: 1, ease: "none", duration: step * 0.7 }, at);
                  if (rule) story.fromTo(rule, { scaleY: 0 }, { scaleY: 1, ease: "none", duration: step * 0.7 }, at);
                });
                story.to({}, { duration: 0.15 });
              }
            } else if (lines.length) {
              gsap.fromTo(
                lines,
                { autoAlpha: 0, y: 16 },
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: 0.5,
                  stagger: 0.06,
                  ease: "power3.out",
                  scrollTrigger: { trigger: lines[0], start: "top 85%", once: true },
                },
              );
            }
          });

          const finale = root.querySelector<HTMLElement>("[data-concept-finale]");
          if (finale) {
            gsap.fromTo(
              finale.children,
              { autoAlpha: 0, y: 16 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.5,
                stagger: 0.06,
                ease: "power3.out",
                scrollTrigger: { trigger: finale, start: "top 80%", once: true },
              },
            );
          }
        },
      );
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
