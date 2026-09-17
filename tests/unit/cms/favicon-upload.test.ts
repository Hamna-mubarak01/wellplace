import { describe, expect, it, vi } from "vitest";

import type { WellPlaceClient } from "@/lib/db/types";
import { uploadCmsMedia } from "@/lib/services/cms-media-service";

describe("ICO favicon upload — CLIENT", () => {
  it.each(["image/vnd.microsoft.icon", "image/x-icon", "", "application/octet-stream"])(
    "sends a usable image MIME type to storage for %j",
    async (type) => {
      const upload = vi.fn().mockResolvedValue({ error: null });
      const url = "https://example.test/storage/navbar/favicon.ico";
      const client = {
        storage: { from: vi.fn().mockReturnValue({ upload, getPublicUrl: () => ({ data: { publicUrl: url } }) }) },
      } as unknown as WellPlaceClient;
      const file = new File([new Uint8Array([0, 0, 1, 0, 1, 0])], "favicon.ico", { type });

      expect(await uploadCmsMedia(client, "navbar", file)).toEqual({ ok: true, url, kind: "image" });
      const [path, body, options] = upload.mock.calls[0];
      expect(path).toMatch(/^navbar\/\d+-favicon\.ico$/);
      expect(body.type).toBe("image/vnd.microsoft.icon");
      expect(options.contentType).toBe(body.type);
      expect(await body.arrayBuffer()).toEqual(await file.arrayBuffer());
    },
  );
});
