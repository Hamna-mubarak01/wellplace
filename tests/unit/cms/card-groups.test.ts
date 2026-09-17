import { describe, expect, it } from "vitest";

import { cmsPage } from "@/lib/config/cms/registry";
import type { CmsRepeaterFieldSpec } from "@/lib/config/cms/types";

const HOME_CMS_PAGE = cmsPage("home")!;

function cardFields() {
  const section = HOME_CMS_PAGE.sections.find((entry) => entry.key === "difference");
  const cards = section?.fields.find((field) => field.key === "cards") as
    | CmsRepeaterFieldSpec
    | undefined;
  return cards?.fields ?? [];
}

describe("difference card editor — Front and Back tabs", () => {
  it("puts every card field in exactly one of the two groups", () => {
    const fields = cardFields();

    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect(["Front", "Back"], field.key).toContain(field.group);
    }
  });

  it("keeps the front to what the front actually shows", () => {
    const front = cardFields()
      .filter((field) => field.group === "Front")
      .map((field) => field.key);

    expect(front).toEqual(["image", "imageAlt", "label", "title"]);
  });

  it("keeps the back to what the back actually shows", () => {
    const back = cardFields()
      .filter((field) => field.group === "Back")
      .map((field) => field.key);

    expect(back).toEqual(["icon", "backLabel", "backTitle", "detail", "action"]);
  });

  it("labels the two sides the same, because the tab already says which side", () => {
    const fields = cardFields();
    const label = fields.find((field) => field.key === "label");
    const backLabel = fields.find((field) => field.key === "backLabel");

    expect(label?.label).toBe("Label");
    expect(backLabel?.label).toBe("Label");
  });

  it("leaves ungrouped lists ungrouped, so they render as a plain form", () => {
    const gallery = HOME_CMS_PAGE.sections.find((entry) => entry.key === "gallery");
    const shots = gallery?.fields.find((field) => field.key === "shots") as
      | CmsRepeaterFieldSpec
      | undefined;

    for (const field of shots?.fields ?? []) {
      expect(field.group).toBeUndefined();
    }
  });
});
