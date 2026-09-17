"use client";

import { useRef, useState, useTransition } from "react";
import { UploadIcon } from "lucide-react";
import { uploadMessageImage } from "@/app/(console)/manage/messages/document-actions";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/ui/input";
import { CMS_IMAGE_TYPES, cmsMediaFileError } from "@/lib/config/cms/media";

export function ImageUpload({
  disabled,
  onUploaded,
}: {
  disabled: boolean;
  onUploaded: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Input
        ref={input}
        type="file"
        accept={CMS_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-label="Choose an image"
        disabled={disabled || pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const invalid = cmsMediaFileError(file);
          setError(invalid);
          if (invalid) return;
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set("file", file);
              const result = await uploadMessageImage(form);
              if (result.ok) onUploaded(result.url);
              else setError(result.message);
            } catch {
              setError(
                "The upload could not finish. Check your connection and try again.",
              );
            }
          });
        }}
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={disabled || pending}
        onClick={() => input.current?.click()}
      >
        <UploadIcon aria-hidden="true" className="size-4" />
        {pending ? "Uploading…" : "Upload image"}
      </Button>
      {error && (
        <p role="alert" className="text-console-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
