"use client";

import { useEffect } from "react";

const CONFETTI_TOKENS = [
  "--brand",
  "--brand-hover",
  "--success",
  "--warning",
  "--text-primary",
] as const;

function readConfettiColours(): string[] {
  const style = getComputedStyle(document.documentElement);
  return CONFETTI_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter(
    Boolean,
  );
}

export function useCelebrationConfetti(): void {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let canvas: HTMLCanvasElement | null = null;
    let cancelled = false;
    const timers: number[] = [];

    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;

      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      Object.assign(canvas.style, {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "100",
      });
      document.body.appendChild(canvas);

      const fire = confetti.create(canvas, { resize: true, useWorker: false });
      const shared = {
        colors: readConfettiColours(),
        ticks: 260,
        scalar: 1.15,
        disableForReducedMotion: true,
      } as const;

      const wave = (particleCount: number, startVelocity: number) => {
        void fire({
          ...shared,
          particleCount,
          angle: 60,
          spread: 70,
          startVelocity,
          origin: { x: 0.05, y: 0.75 },
        });
        void fire({
          ...shared,
          particleCount,
          angle: 120,
          spread: 70,
          startVelocity,
          origin: { x: 0.95, y: 0.75 },
        });
      };

      wave(90, 48);
      timers.push(window.setTimeout(() => wave(60, 42), 420));
      timers.push(window.setTimeout(() => canvas?.remove(), 6500));
    });

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      canvas?.remove();
    };
  }, []);
}
