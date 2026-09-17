"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function BookingPageMotion({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!scope.current) return;

      const media = gsap.matchMedia(scope.current);

      media.add(
        {
          motionAllowed: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 768px)",
        },
        (context) => {
          const { motionAllowed, desktop } = context.conditions as {
            motionAllowed: boolean;
            desktop: boolean;
          };

          if (!motionAllowed) return;

          gsap.fromTo(
            ".booking-motion-widget",
            {
              autoAlpha: 0,
              y: desktop ? 56 : 32,
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: 1.15,
              ease: "power3.out",
              clearProps: "opacity,transform,visibility",
              scrollTrigger: {
                trigger: "#booking-widget",
                start: "top 92%",
                once: true,
              },
            },
          );

        },
      );

      return () => media.revert();
    },
    { scope },
  );

  return (
    <main ref={scope} className="flex-1">
      {children}
    </main>
  );
}
