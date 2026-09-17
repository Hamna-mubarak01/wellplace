"use client";

import { ActionError } from "@/components/shared/action-error";
import { NO_SUITE_MESSAGE } from "@/lib/domain/action-errors";

export type WalkInNotice =
  | { kind: "no_suite" }
  | { kind: "refused"; message: string }
  | { kind: "error"; message: string };

export interface WalkInResultNoticeProps {
  notice: WalkInNotice;
  ref?: React.Ref<HTMLDivElement>;
}

export function WalkInResultNotice({ notice, ref }: WalkInResultNoticeProps) {
  return (
    <ActionError
      ref={ref}
      title={notice.kind === "no_suite" ? "This visit does not fit the available suites" : "Please review this booking"}
      message={notice.kind === "no_suite" ? NO_SUITE_MESSAGE : notice.message}
      remedy="The details you entered are still here."
    />
  );
}
