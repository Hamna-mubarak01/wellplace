import { CMS_MEDIA_BUCKET, cmsMediaType } from "@/lib/config/cms/media";
import type { WellPlaceClient } from "@/lib/db/types";

export type StorageUpload =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function uploadToCmsMedia(
  client: WellPlaceClient,
  path: string,
  file: File,
): Promise<StorageUpload> {
  const bucket = client.storage.from(CMS_MEDIA_BUCKET);
  const contentType = cmsMediaType(file);
  const body = contentType === file.type ? file : new File([file], file.name, { type: contentType });

  const { error } = await bucket.upload(path, body, {
    cacheControl: "31536000",
    contentType,
  });

  if (error) return { ok: false, message: error.message };

  return { ok: true, url: bucket.getPublicUrl(path).data.publicUrl };
}
