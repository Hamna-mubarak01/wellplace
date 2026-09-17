import { cmsMediaFileError, isVideoType } from "@/lib/config/cms/media";
import { uploadToCmsMedia } from "@/lib/db/storage";
import type { WellPlaceClient } from "@/lib/db/types";

export type CmsUploadResult =
  | { ok: true; url: string; kind: "image" | "video" }
  | { ok: false; message: string };

function safeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return cleaned || "upload";
}

export function explainUploadFailure(raw: string): string {
  const message = raw.toLowerCase();

  if (message.includes("bucket not found") || message.includes("nosuchbucket")) {
    return "Media storage is not set up on this environment yet. The cms-media bucket migration still needs to be applied.";
  }
  if (message.includes("row-level security") || message.includes("unauthorized")) {
    return "You do not have permission to upload media.";
  }
  if (message.includes("exceeded the maximum allowed size") || message.includes("payload too large")) {
    return "That file is larger than this environment allows.";
  }
  if (message.includes("mime type") || message.includes("invalid_mime_type")) {
    return "That file type is not allowed in media storage.";
  }
  if (message.includes("duplicate") || message.includes("already exists")) {
    return "A file with that name was just uploaded. Try again.";
  }
  if (message.includes("fetch failed") || message.includes("network")) {
    return "Could not reach media storage. Check your connection and try again.";
  }

  return `That file could not be uploaded. ${raw}`;
}

export async function uploadCmsMedia(
  client: WellPlaceClient,
  slug: string,
  file: File,
): Promise<CmsUploadResult> {
  const error = cmsMediaFileError(file);
  if (error) return { ok: false, message: error };

  const path = `${slug}/${Date.now()}-${safeName(file.name)}`;

  const uploaded = await uploadToCmsMedia(client, path, file);

  if (!uploaded.ok) {
    console.error(`[cms] upload failed: ${uploaded.message}`);
    return { ok: false, message: explainUploadFailure(uploaded.message) };
  }

  return {
    ok: true,
    url: uploaded.url,
    kind: isVideoType(file.type) ? "video" : "image",
  };
}
