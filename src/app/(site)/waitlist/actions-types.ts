export type WaitlistResult =
  | { status: "joined" }
  | { status: "already_on_list" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "rate_limited" }
  | { status: "error" };
