/**
 * Ekspor ke Excel (.xlsx) di browser. ExcelJS dimuat saat tombol diklik saja agar halaman tetap ringan.
 */

export type Cell = string | number | null;
export interface SheetSpec {
  name: string;
  title?: string; // baris judul di atas tabel
  columns: { header: string; width?: number }[];
  rows: Cell[][];
}

export async function downloadXlsx(filename: string, sheets: SheetSpec[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "DyeLIMS";
  wb.created = new Date();

  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name.slice(0, 31));
    let headerRow = 1;
    if (spec.title) {
      ws.addRow([spec.title]).font = { bold: true, size: 13, color: { argb: "FF5C1A16" } };
      ws.addRow([]);
      headerRow = 3;
    }
    const head = ws.addRow(spec.columns.map((c) => c.header));
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8A2B25" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    for (const r of spec.rows) ws.addRow(r).alignment = { vertical: "top", wrapText: true };
    spec.columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width ?? 16));
    ws.views = [{ state: "frozen", ySplit: headerRow }];
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: spec.columns.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
