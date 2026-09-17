"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function ConceptMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const media = gsap.matchMedia(root);

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const sequence = root.querySelector<HTMLElement>(".concept-story-sequence");
        const rail = root.querySelector<HTMLElement>(".concept-rail");
        const fill = root.querySelector<HTMLElement>(".concept-rail-fill");
        const marker = root.querySelector<HTMLElement>(".concept-rail-marker");

        if (sequence && rail && fill && marker) {
          const travel = () =>
            rail.offsetHeight - marker.offsetHeight;

          gsap
            .timeline({
              scrollTrigger: {
                trigger: sequence,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.6,
                invalidateOnRefresh: true,
              },
            })
            .fromTo(
              fill,
              { scaleY: 0 },
              { scaleY: 1, ease: "none" },
              0,
            )
            .fromTo(
              marker,
              { y: 0 },
              { y: travel, ease: "none" },
              0,
            );
        }

        root.querySelectorAll<HTMLElement>(".concept-chapter-image").forEach((image) => {
          gsap.fromTo(
            image,
            { yPercent: -4 },
            {
              yPercent: 4,
              ease: "none",
              scrollTrigger: {
                trigger: image.parentElement ?? image,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.5,
                invalidateOnRefresh: true,
              },
            },
          );
        });

        root.querySelectorAll<HTMLElement>(".concept-story-chapter").forEach((chapter) => {
          const words = chapter.querySelectorAll<HTMLElement>(".concept-word-inner");
          const rule = chapter.querySelector<HTMLElement>(".concept-reveal-rule");
          const eyebrow = chapter.querySelector<HTMLElement>(".concept-reveal-eyebrow");
          const body = chapter.querySelectorAll<HTMLElement>(
            ".concept-reveal-body, .concept-reveal-details",
          );
          const numeral = chapter.querySelector<HTMLElement>(".concept-reveal-number");

          const timeline = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: { trigger: chapter, start: "top 70%", once: true },
          });

          if (eyebrow) {
            timeline.fromTo(
              eyebrow,
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: 0.6 },
              0,
            );
          }

          if (rule) {
            timeline.fromTo(
              rule,
              { scaleX: 0 },
              { scaleX: 1, duration: 0.7 },
              0.05,
            );
          }

          if (words.length) {
            timeline.fromTo(
              words,
              { yPercent: 115 },
              { yPercent: 0, duration: 0.9, stagger: 0.055 },
              0.12,
            );
          }

          if (body.length) {
            timeline.fromTo(
              body,
              { autoAlpha: 0, y: 20 },
              { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 },
              0.34,
            );
          }

          if (numeral) {
            timeline.fromTo(
              numeral,
              { autoAlpha: 0, y: 26 },
              { autoAlpha: 1, y: 0, duration: 1 },
              0.1,
            );
          }
        });
      });
    },
    { scope },
  );

  return <div ref={scope}>{children}</div>;
}
