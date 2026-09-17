import { describe, expect, it } from "vitest";

import { explainUploadFailure } from "@/lib/services/cms-media-service";

describe("upload failures explain themselves — R-33, §5.5", () => {
  it("names the missing bucket instead of saying try again", () => {
    const message = explainUploadFailure("Bucket not found");

    expect(message).toContain("cms-media");
    expect(message.toLowerCase()).not.toContain("try again");
  });

  it("recognises the storage API's own bucket code", () => {
    expect(explainUploadFailure("NoSuchBucket")).toContain("cms-media");
  });

  it("says permission when row-level security refuses the write", () => {
    expect(
      explainUploadFailure("new row violates row-level security policy"),
    ).toBe("You do not have permission to upload media.");
  });

  it("says size when the object is too large for the bucket", () => {
    expect(
      explainUploadFailure("The object exceeded the maximum allowed size"),
    ).toContain("larger than");
  });

  it("says type when the bucket rejects the mime type", () => {
    expect(explainUploadFailure("invalid_mime_type")).toContain("file type");
  });

  it("suggests retrying only where retrying could actually work", () => {
    expect(explainUploadFailure("fetch failed")).toContain("try again");
    expect(explainUploadFailure("Duplicate object")).toContain("Try again");
  });

  it("carries the provider's own words through when it does not recognise them", () => {
    expect(explainUploadFailure("teapot on fire")).toContain("teapot on fire");
  });
});
