import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";
import {
  CMS_IMAGE_MAX_BYTES,
  CMS_VIDEO_MAX_BYTES,
  CMS_FAVICON_TYPES,
  cmsMediaFileError,
  cmsMediaType,
} from "@/lib/config/cms/media";

describe("CMS upload limits — CLIENT favicon upload fix", () => {
  it.each(["image/vnd.microsoft.icon", "image/x-icon", "", "application/octet-stream"])(
    "accepts ICO files reported as %j and preserves the image size limit",
    (type) => {
      const file = { name: "Favicon.ICO", type, size: CMS_IMAGE_MAX_BYTES };
      expect(CMS_FAVICON_TYPES).toContain(cmsMediaType(file));
      expect(cmsMediaFileError(file)).toBeNull();
      expect(cmsMediaFileError({ ...file, size: 0 })).toContain("empty");
      expect(cmsMediaFileError({ ...file, size: CMS_IMAGE_MAX_BYTES + 1 })).toContain("10MB");
    },
  );

  it("does not treat unrelated or explicitly unsupported files as ICO images", () => {
    expect(cmsMediaFileError({ name: "favicon.ico.html", type: "", size: 100 })).toContain("not supported");
    expect(cmsMediaFileError({ name: "favicon.ico", type: "text/html", size: 100 })).toContain("not supported");
    expect(cmsMediaFileError({ name: "unknown.bin", type: "application/octet-stream", size: 100 })).toContain("not supported");
  });

  it("accepts PNGs larger than the old 1MB limit through the advertised image limit", () => {
    expect(cmsMediaFileError({ type: "image/png", size: 2 * 1024 * 1024 })).toBeNull();
    expect(cmsMediaFileError({ type: "image/png", size: CMS_IMAGE_MAX_BYTES })).toBeNull();
    expect(cmsMediaFileError({ type: "image/png", size: CMS_IMAGE_MAX_BYTES + 1 })).toContain("10MB");
  });

  it("keeps separate limits for images and videos", () => {
    expect(cmsMediaFileError({ type: "video/mp4", size: CMS_VIDEO_MAX_BYTES })).toBeNull();
    expect(cmsMediaFileError({ type: "video/mp4", size: CMS_VIDEO_MAX_BYTES + 1 })).toContain("50MB");
    expect(cmsMediaFileError({ type: "image/png", size: 0 })).toContain("empty");
    expect(cmsMediaFileError({ type: "text/html", size: 100 })).toContain("not supported");
  });

  it("allows full-size CMS files plus multipart overhead through Next actions and proxy", () => {
    const actions = nextConfig.experimental?.serverActions;
    expect(actions?.bodySizeLimit).toBeGreaterThan(CMS_VIDEO_MAX_BYTES);
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBeGreaterThan(CMS_VIDEO_MAX_BYTES);
  });
});
