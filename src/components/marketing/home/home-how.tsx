"use client";

import { MediaFrame } from "@/components/shared/media-frame";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import { useEffect, useRef } from "react";

const PHOTO_REST_SCALE = 1.06;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function HomeGalleryPrelude({
  content,
}: {
  content: ResolvedHomeContent["bridge"];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const paint = () => {
      const stage = stageRef.current;
      const photo = photoRef.current;
      if (!stage || !photo) return;

      const runway = stage.offsetHeight - window.innerHeight;
      const settle = runway > 0 ? clamp01(-stage.getBoundingClientRect().top / runway) : 1;
      const scale = PHOTO_REST_SCALE - (PHOTO_REST_SCALE - 1) * settle;
      photo.style.transform = reduced.matches ? "" : `scale(${scale.toFixed(4)})`;
    };

    const schedulePaint = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    };

    paint();
    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint);
    reduced.addEventListener("change", schedulePaint);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      reduced.removeEventListener("change", schedulePaint);
    };
  }, []);

  return (
    <div ref={stageRef} className="gallery-stage relative bg-band-deep">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div
          ref={photoRef}
          className="absolute inset-0 will-change-transform motion-reduce:transform-none!"
        >
          <MediaFrame
            src={content.image}
            alt=""
            sizes="100vw"
            frameClassName="size-full"
          />
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-home-suite-surface via-transparent to-band-deep/45 to-90%"
        />
      </div>
    </div>
  );
}
