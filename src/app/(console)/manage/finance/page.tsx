import { redirect } from "next/navigation";

import { requireManagement } from "@/lib/auth/session";
import { FINANCE_PATH } from "@/lib/config/finance";

export default async function FinancePage() {
  await requireManagement();
  redirect(FINANCE_PATH.payments);
}
