const SPACE_AND_ZERO_WIDTH =
  /[\s\u00a0\u1680\u2000-\u200f\u202f\u205f\u2028\u2029\u3000\ufeff]/g;

export function normaliseEmail(email: string): string {
  return email.replace(SPACE_AND_ZERO_WIDTH, "").replace(/\.+$/, "").toLowerCase();
}
