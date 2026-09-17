import { formatDubaiDateTime } from "@/lib/domain/time";

export interface DubaiStamp {
  date: string;
  time: string;
}

export function dubaiStamp(instant: string): DubaiStamp {
  const formatted = formatDubaiDateTime(instant);
  const at = formatted.lastIndexOf(" at ");
  if (at === -1) return { date: formatted, time: "" };

  return {
    date: formatted.slice(0, at),
    time: formatted.slice(at + " at ".length),
  };
}

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  console_manual: "Added by staff",
};

export function leadOrigin(source: string | null, campaign: string | null): string {
  if (source && SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  return campaign ?? source ?? "Direct";
}
