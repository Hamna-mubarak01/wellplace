"use client";

import { MediaFrame } from "@/components/shared/media-frame";
import { safeImageSrc } from "@/lib/config/cms/links";
import { useId, useRef, useState, useTransition } from "react";
import { FilmIcon, ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { uploadCmsMediaAction } from "@/app/(console)/manage/cms/actions";
import { Button } from "@/components/shared/button";
import { CMS_IMAGE_TYPES, CMS_MEDIA_TYPES, CMS_FAVICON_TYPES, cmsMediaFileError, cmsMediaType, describeLimits } from "@/lib/config/cms/media";
import { cn } from "@/lib/utils";

const ACCEPT = CMS_MEDIA_TYPES.join(",");

async function uploadFile(
  slug: string,
  file: File,
  onUploaded: (next: { url: string; kind: "image" | "video" }) => void,
) {
  const error = cmsMediaFileError(file);
  if (error) {
    toast.error("Upload failed", { description: error });
    return;
  }
  const body = new FormData();
  body.set("slug", slug);
  body.set("file", file);
  try {
    const result = await uploadCmsMediaAction(body);
    if (result.ok) {
      onUploaded({ url: result.url, kind: result.kind });
      toast.success("Uploaded", { description: file.name });
    } else {
      toast.error("Upload failed", { description: result.message });
    }
  } catch {
    toast.error("Upload failed", {
      description: "The upload could not complete. Please try again.",
    });
  }
}

export function MediaPreview({
  url,
  kind,
  className,
  fit = "cover",
}: {
  url: string;
  kind?: "image" | "video";
  className?: string;
  fit?: "cover" | "contain";
}) {
  const frame = cn(
    "relative aspect-video w-full overflow-hidden rounded-(--radius-control) border border-border bg-surface-sunken",
    className,
  );

  if (!url) {
    return (
      <div className={cn(frame, "grid place-items-center border-dashed text-text-muted")}>
        {kind === "video" ? (
          <FilmIcon aria-hidden="true" className="size-5" />
        ) : (
          <ImageIcon aria-hidden="true" className="size-5" />
        )}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className={frame}>
        <video src={url} muted playsInline className="size-full object-cover" />
      </div>
    );
  }

  return (
    <MediaFrame src={safeImageSrc(url, "")} alt="" sizes="320px" frameClassName={frame} className={fit === "contain" ? "object-contain" : undefined} />
  );
}

export function CmsMediaPicker({
  slug,
  url,
  kind = "image",
  label,
  onUploaded,
  onClear,
  compact,
  previewFit,
  faviconOnly = false,
}: {
  slug: string;
  url: string;
  kind?: "image" | "video";
  label: string;
  onUploaded: (next: { url: string; kind: "image" | "video" }) => void;
  onClear?: () => void;
  compact?: boolean;
  previewFit?: "cover" | "contain";
  faviconOnly?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const acceptedTypes: readonly string[] = faviconOnly ? CMS_FAVICON_TYPES : CMS_IMAGE_TYPES;

  function send(file: File | undefined) {
    if (!file || isPending) return;
    if (!acceptedTypes.includes(cmsMediaType(file))) {
      toast.error("Choose an image", { description: describeLimits(true, faviconOnly) });
      return;
    }
    startTransition(() => uploadFile(slug, file, onUploaded));
  }

  return (
    <div className={cn("grid min-w-0 gap-2.5", !compact && "@xl/cms-field:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]")}>
      <MediaPreview url={url} kind={kind} fit={previewFit} />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          send(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-(--radius-control) border border-dashed border-border bg-surface-sunken px-3 py-4 text-center transition-colors",
          dragging && "border-brand bg-brand-wash",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={faviconOnly ? [...acceptedTypes, ".ico", ".png"].join(",") : acceptedTypes.join(",")}
          className="sr-only"
          aria-label={`Upload ${label}`}
          onChange={(event) => {
            send(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? (
              <Loader2Icon
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <UploadIcon aria-hidden="true" className="size-4" />
            )}
            {url ? "Replace" : "Upload"}
          </Button>
          {url && onClear && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <Trash2Icon aria-hidden="true" className="size-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-micro text-text-muted">
          Drag a file here, or choose one from your device.
        </p>
        <p className="text-micro text-text-muted">{describeLimits(true, faviconOnly)}</p>
      </div>
    </div>
  );
}

export function CmsUploadButton({
  slug,
  label,
  onUploaded,
  children,
  iconOnly,
}: {
  slug: string;
  label: string;
  onUploaded: (next: { url: string; kind: "image" | "video" }) => void;
  children?: React.ReactNode;
  iconOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={`Upload ${label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || isPending) return;
          startTransition(() => uploadFile(slug, file, onUploaded));
        }}
      />
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon-sm" : "sm"}
        disabled={isPending}
        aria-label={iconOnly ? `Replace ${label}` : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? (
          <Loader2Icon
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <UploadIcon aria-hidden="true" className="size-4" />
        )}
        {iconOnly ? null : (children ?? "Replace")}
      </Button>
    </>
  );
}
