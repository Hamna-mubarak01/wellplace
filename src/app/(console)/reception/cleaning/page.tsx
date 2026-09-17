import { redirect } from "next/navigation";
import { requireReception } from "@/lib/auth/session";
import { isScheduleDate } from "@/lib/console/schedule-range";

export default async function CleaningPage({ searchParams }: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireReception();
  const { date } = await searchParams;
  redirect(`/reception${isScheduleDate(date) ? `?date=${date}` : ""}#tasks`);
}
