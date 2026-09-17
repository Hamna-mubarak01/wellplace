import { redirect } from "next/navigation";
import { requireReception } from "@/lib/auth/session";

export default async function AlertsPage() {
  await requireReception();
  redirect("/reception#attention");
}
