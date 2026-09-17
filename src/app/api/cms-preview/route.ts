import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { requireManagement } from "@/lib/auth/session";
import { CMS_PREVIEW_COOKIE } from "@/lib/config/cms/preview";
import { cmsPage } from "@/lib/config/cms/registry";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const draft = await draftMode();
  const store = await cookies();
  if (params.get("exit") === "1") {
    draft.disable();
    store.delete(CMS_PREVIEW_COOKIE);
    redirect("/");
  }
  await requireManagement();
  const page = cmsPage(params.get("slug") ?? "");
  if (!page) return new Response("Choose a website CMS page.", { status: 400 });
  draft.enable();
  store.set(CMS_PREVIEW_COOKIE, page.slug, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect(page.route ?? "/");
}
