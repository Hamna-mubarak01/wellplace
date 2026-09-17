import { siteIconResponse } from "@/lib/services/site-icon";

export const dynamic = "force-dynamic";

export async function GET() {
  return siteIconResponse("/site-icons/favicon.ico");
}
