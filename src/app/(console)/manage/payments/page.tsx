import { redirect } from "next/navigation";

import { requireManagement } from "@/lib/auth/session";

const FINANCE_PAYMENTS = "/manage/finance/payments";

export default async function PaymentsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManagement();
  const params = await searchParams;
  const forwarded = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") forwarded.set(key, value);
  }
  const query = forwarded.toString();
  redirect(query ? `${FINANCE_PAYMENTS}?${query}` : FINANCE_PAYMENTS);
}
