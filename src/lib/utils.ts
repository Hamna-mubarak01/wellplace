import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const FONT_SIZES = [
  "display",
  "h1",
  "h2",
  "h3",
  "lead",
  "body",
  "small",
  "label",
  "numeral",
  "headline",
  "subhead",
  "control",
  "field-label",
  "option",
  "fine",
  "micro",
  "pill",
  "tile-time",
  "console-title",
  "console-body",
  "console-table",
  "console-label",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
