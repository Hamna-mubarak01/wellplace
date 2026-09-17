"use client";

import { useEffect } from "react";

export function ReceiptPrintTheme() {
  useEffect(() => {
    const root = document.documentElement;
    let forced = false;
    let previous: string | null = null;

    const lighten = () => {
      if (forced) return;
      previous = root.getAttribute("data-theme");
      root.setAttribute("data-theme", "light");
      forced = true;
    };

    const restore = () => {
      if (!forced) return;
      forced = false;
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    };

    window.addEventListener("beforeprint", lighten);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", lighten);
      window.removeEventListener("afterprint", restore);
      restore();
    };
  }, []);

  return null;
}
