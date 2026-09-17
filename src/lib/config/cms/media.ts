export const CMS_MEDIA_BUCKET = "cms-media";
export const CMS_ICO_TYPES = ["image/vnd.microsoft.icon", "image/x-icon"] as const;
export const CMS_FAVICON_TYPES = ["image/png", ...CMS_ICO_TYPES] as const;

export const CMS_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const CMS_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export const CMS_MEDIA_TYPES = [...CMS_IMAGE_TYPES, ...CMS_ICO_TYPES, ...CMS_VIDEO_TYPES] as const;

export const CMS_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CMS_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const CMS_UPLOAD_REQUEST_MAX_BYTES = CMS_VIDEO_MAX_BYTES + 64 * 1024;

export function cmsMediaType(file: { type: string; name?: string }): string {
  if (
    (CMS_ICO_TYPES as readonly string[]).includes(file.type) ||
    ((!file.type || file.type === "application/octet-stream") && /\.ico$/i.test(file.name ?? ""))
  ) return CMS_ICO_TYPES[0];
  return file.type;
}

export function cmsMediaFileError(file: { type: string; size: number; name?: string }): string | null {
  const type = cmsMediaType(file);
  if (!(CMS_MEDIA_TYPES as readonly string[]).includes(type)) {
    return "That file type is not supported.";
  }
  if (file.size === 0) return "Choose a file that is not empty.";
  const limit = maxBytesFor(type);
  return file.size > limit
    ? `That file is larger than ${Math.round(limit / 1024 / 1024)}MB.`
    : null;
}

export function isVideoType(type: string): boolean {
  return (CMS_VIDEO_TYPES as readonly string[]).includes(type);
}

export function maxBytesFor(type: string): number {
  return isVideoType(type) ? CMS_VIDEO_MAX_BYTES : CMS_IMAGE_MAX_BYTES;
}

export function describeLimits(imagesOnly = false, faviconOnly = false): string {
  if (faviconOnly) return `PNG or ICO up to ${CMS_IMAGE_MAX_BYTES / 1024 / 1024}MB`;
  const images = `PNG, JPG, WebP, GIF or AVIF up to ${CMS_IMAGE_MAX_BYTES / 1024 / 1024}MB`;
  return imagesOnly ? images : `${images} · MP4 or WebM up to ${CMS_VIDEO_MAX_BYTES / 1024 / 1024}MB`;
}
