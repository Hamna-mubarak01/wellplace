import { redirect } from "next/navigation";

import { requireManagement } from "@/lib/auth/session";
import { CONSOLE_HOME } from "@/lib/auth/console";

export default async function ManageIndexPage() {
  await requireManagement();
  redirect(CONSOLE_HOME.manage);
}
