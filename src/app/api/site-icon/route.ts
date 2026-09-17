import { publishedSiteIcon } from "@/lib/services/site-icon";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { url: await publishedSiteIcon() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
