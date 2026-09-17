import { permanentRedirect } from "next/navigation";

import { requireReception } from "@/lib/auth/session";

export default async function HandoverPage() {
  await requireReception();
  permanentRedirect("/reception/tasks");
}
