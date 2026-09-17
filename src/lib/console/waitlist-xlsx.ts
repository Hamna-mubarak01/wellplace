import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import {
  WAITLIST_CSV_COLUMNS,
  waitlistExportRow,
} from "@/lib/console/waitlist-csv";
import { createXlsx } from "@/lib/console/xlsx";

export function waitlistXlsx(rows: readonly WaitlistLead[]): Promise<ArrayBuffer> {
  return createXlsx("Waitlist", WAITLIST_CSV_COLUMNS, rows.map(waitlistExportRow));
}
