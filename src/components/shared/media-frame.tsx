"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { safeImageSrc } from "@/lib/config/cms/links";
import { cn } from "@/lib/utils";

type FrameState = "loading" | "ready" | "failed";

export interface MediaFrameProps {
  src: string;
  alt: string;
  sizes: string;
  frameClassName?: string;
  className?: string;
  imageStyle?: CSSProperties;
  frameStyle?: CSSProperties;
  preload?: boolean;
  draggable?: boolean;
  quality?: number;
}

export function MediaFrame(props: MediaFrameProps) {
  const src = safeImageSrc(props.src, "");
  return <MediaFrameImage key={src} {...props} src={src} />;
}

function MediaFrameImage({
  src,
  alt,
  sizes,
  frameClassName,
  className,
  imageStyle,
  frameStyle,
  preload,
  draggable,
  quality,
}: MediaFrameProps) {
  const [state, setState] = useState<FrameState>("loading");
  const [useOriginal, setUseOriginal] = useState(false);
  const unoptimized = src.startsWith("https://") || useOriginal;
  const frame = cn(
    "relative block overflow-hidden bg-surface-sunken",
    frameClassName,
  );

  if (!src || state === "failed") {
    return <span aria-hidden="true" className={frame} style={frameStyle} />;
  }

  return (
    <span className={frame} style={frameStyle}>
      <Skeleton
        hidden={state === "ready"}
        aria-hidden="true"
        className="absolute inset-0 size-full rounded-none motion-reduce:animate-none"
      />
      <Image
        key={unoptimized ? "original" : "optimized"}
        src={src}
        unoptimized={unoptimized}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        draggable={draggable}
        quality={quality}
        style={imageStyle}
        onLoad={() => setState("ready")}
        onError={() => {
          // [§Owner local image-load fix, 15 Sep] A failed optimized request gets
          // one attempt at the original image before the frame is marked failed.
          if (!unoptimized) {
            setState("loading");
            setUseOriginal(true);
            return;
          }
          console.error(`[media] image could not be loaded: ${src}`);
          setState("failed");
        }}
        className={cn("object-cover", className)}
      />
    </span>
  );
}
