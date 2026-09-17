export type ExportFormat = "csv" | "xlsx";

export const EXPORT_CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function parseExportFormat(value: string | null): ExportFormat {
  return value === "xlsx" ? "xlsx" : "csv";
}
