import { permanentRedirect } from "next/navigation";

import { SUITES_PATH } from "@/app/(console)/manage/suites/suites-view";
import { requireManagement } from "@/lib/auth/session";

export default async function ManageAvailabilityRedirect(): Promise<never> {
  await requireManagement();
  permanentRedirect(SUITES_PATH);
}
