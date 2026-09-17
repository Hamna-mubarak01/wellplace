import { redirect } from "next/navigation";
import { requireReception } from "@/lib/auth/session";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; to?: string; preview?: string }> }) {
  await requireReception();
  const { view, date, to, preview } = await searchParams;
  const query = new URLSearchParams();
  if (typeof view === "string") query.set("view", view);
  if (typeof date === "string") query.set("date", date);
  if (typeof to === "string") query.set("to", to);
  if (typeof preview === "string") query.set("preview", preview);
  redirect(`/reception?${query.toString()}`);
}
