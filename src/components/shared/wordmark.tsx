import Image from "next/image";

import { MediaFrame } from "@/components/shared/media-frame";
import { safeImageSrc } from "@/lib/config/cms/links";
import { cn } from "@/lib/utils";

export type MarkVariant = "primary" | "secondary" | "wordmark" | "icon";

export const BRAND_ASSETS = {
  logo: "/brand/primary-dark.svg",
} as const;

const RATIO: Record<MarkVariant, { w: number; h: number }> = {
  primary: { w: 639.6, h: 224 },
  secondary: { w: 636.9, h: 171.1 },
  wordmark: { w: 655.3, h: 127.2 },
  icon: { w: 207.3, h: 201 },
};

export interface WordmarkProps {
  src?: string;
  variant?: MarkVariant;
  height?: number;
  label?: string;
  className?: string;
  preload?: boolean;
  onScrim?: boolean;
}

const MARK_SIZE = (height: number, ratio: number) => ({
  width: `calc(var(--wordmark-h, ${height}px) * ${ratio})`,
  height: `var(--wordmark-h, ${height}px)`,
});

export function Wordmark({
  src,
  variant = "wordmark",
  height = 28,
  label,
  className,
  preload = false,
  onScrim = false,
}: WordmarkProps) {
  const { w, h } = RATIO[variant];
  const width = Math.round((w / h) * height);
  const alt = label ?? "";
  const replacement = safeImageSrc(src ?? "", "");

  if (replacement) {
    return (
      <MediaFrame
        src={replacement}
        alt={alt}
        sizes={`${width}px`}
        frameClassName={cn("inline-block shrink-0 bg-transparent", className)}
        frameStyle={MARK_SIZE(height, w / h)}
        className="object-contain"
        preload={preload}
      />
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src={`/brand/${variant}-dark.svg`}
        alt={alt}
        width={width}
        height={height}
        preload={preload}
        aria-hidden={label ? undefined : true}
        style={MARK_SIZE(height, w / h)}
        className={onScrim ? "hidden" : "block dark:hidden"}
      />
      <Image
        src={`/brand/${variant}-light.svg`}
        alt={alt}
        width={width}
        height={height}
        preload={preload}
        aria-hidden={label ? undefined : true}
        style={MARK_SIZE(height, w / h)}
        className={onScrim ? "block" : "hidden dark:block"}
      />
    </span>
  );
}
