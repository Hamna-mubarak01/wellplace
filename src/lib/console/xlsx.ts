import { Workbook } from "exceljs";

export type SpreadsheetCell = string | number | null | undefined;

const MINIMUM_COLUMN_WIDTH = 12;
const MAXIMUM_COLUMN_WIDTH = 48;
const COLUMN_PADDING = 2;

function safeCell(value: SpreadsheetCell): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  return /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
}

export async function createXlsx(
  sheetName: string,
  columns: readonly string[],
  rows: readonly (readonly SpreadsheetCell[])[],
): Promise<ArrayBuffer> {
  const workbook = new Workbook();
  workbook.creator = "WellPlace";

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow(columns);
  for (const row of rows) worksheet.addRow(row.map(safeCell));

  worksheet.getRow(1).font = { bold: true };
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  worksheet.columns.forEach((column) => {
    let width = MINIMUM_COLUMN_WIDTH;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      width = Math.max(width, String(cell.value ?? "").length + COLUMN_PADDING);
    });
    column.width = Math.min(width, MAXIMUM_COLUMN_WIDTH);
  });

  return workbook.xlsx.writeBuffer();
}
