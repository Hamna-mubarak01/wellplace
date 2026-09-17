export type ContactResult =
  | { status: "sent" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "rate_limited" }
  | { status: "error" };
