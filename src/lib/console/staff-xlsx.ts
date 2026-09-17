import type { StaffRow } from "@/lib/db/queries/staff";
import { STAFF_CSV_COLUMNS, staffExportRow } from "@/lib/console/staff-csv";
import { createXlsx } from "@/lib/console/xlsx";

export function staffXlsx(members: readonly StaffRow[]): Promise<ArrayBuffer> {
  return createXlsx("Staff", STAFF_CSV_COLUMNS, members.map(staffExportRow));
}
