import { permanentRedirect } from "next/navigation";

import { requireManagement } from "@/lib/auth/session";
import { suitePath } from "@/app/(console)/manage/suites/suites-view";

export default async function ManageSuiteRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  permanentRedirect(suitePath(id));
}
