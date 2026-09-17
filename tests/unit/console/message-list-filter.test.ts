import { describe, expect, it } from "vitest";

import {
  matchingMessages,
  type MessageListItem,
} from "@/components/console/manage/messages/message-list-model";
import type { MessageDocumentGroup } from "@/lib/config/message-documents";

const LABELS: Readonly<Record<string, string>> = {
  waitlist: "Waitlist",
  staff: "Staff access",
  payments: "Payments",
};

function label(group: MessageDocumentGroup): string {
  return LABELS[group] ?? group;
}

function item(
  key: string,
  name: string,
  subject: string,
  group: MessageDocumentGroup,
): MessageListItem {
  return {
    key: key as MessageListItem["key"],
    label: name,
    group,
    audience: "guest",
    connected: true,
    subject,
    status: "published",
    updatedAt: null,
    editHref: `/manage/messages/${key}`,
  };
}

const ITEMS: readonly MessageListItem[] = [
  item("waitlist_confirmation", "Waitlist welcome", "You’re in — welcome", "waitlist"),
  item("staff_invitation", "Console invitation", "Set your password", "staff"),
  item("refund_issued", "Refund issued", "Your WellPlace refund", "payments"),
];

describe("§12 — the message list narrows to what the manager asked for", () => {
  it("returns everything when nothing is asked for", () => {
    expect(matchingMessages(ITEMS, "", null, label)).toHaveLength(3);
  });

  it("treats a search of only spaces as no search", () => {
    expect(matchingMessages(ITEMS, "   ", null, label)).toHaveLength(3);
  });

  it("matches on the template name", () => {
    const found = matchingMessages(ITEMS, "invitation", null, label);

    expect(found.map((entry) => entry.key)).toEqual(["staff_invitation"]);
  });

  it("matches on the subject line", () => {
    const found = matchingMessages(ITEMS, "refund", null, label);

    expect(found.map((entry) => entry.key)).toEqual(["refund_issued"]);
  });

  it("matches on the group's own name", () => {
    const found = matchingMessages(ITEMS, "staff access", null, label);

    expect(found.map((entry) => entry.key)).toEqual(["staff_invitation"]);
  });

  it("ignores capitals", () => {
    expect(matchingMessages(ITEMS, "WAITLIST WELCOME", null, label)).toHaveLength(1);
  });

  it("narrows to one group", () => {
    const found = matchingMessages(ITEMS, "", "payments", label);

    expect(found.map((entry) => entry.key)).toEqual(["refund_issued"]);
  });

  it("applies the group and the search together", () => {
    expect(matchingMessages(ITEMS, "refund", "waitlist", label)).toHaveLength(0);
    expect(matchingMessages(ITEMS, "refund", "payments", label)).toHaveLength(1);
  });

  it("returns nothing when the search matches nothing", () => {
    expect(matchingMessages(ITEMS, "zzzz", null, label)).toHaveLength(0);
  });

  it("keeps the original order of what survives", () => {
    const found = matchingMessages(ITEMS, "e", null, label);

    expect(found.map((entry) => entry.key)).toEqual(
      ITEMS.filter((entry) => found.includes(entry)).map((entry) => entry.key),
    );
  });
});
