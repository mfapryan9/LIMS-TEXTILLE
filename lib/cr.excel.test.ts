import { describe, it, expect } from "vitest";
import { calculateCR } from "./cr";
import excel from "../prisma/data/excel-history.json";

/**
 * Validasi rumus CR terhadap file "SAMPLE ORDERAN SPK.xlsx".
 * Di Excel: CR = (DUE DATE − TGL ORDER) / p, p = processing time per sheet (kelompok proses/mesin).
 * Jadi calculateCR dengan "hari ini" = TGL ORDER harus menghasilkan angka yang sama.
 */

const p = new Map(excel.machines.map((m) => [m.code, m.p]));
// 10:00 WIB pada tanggal order
const at = (iso: string) => new Date(`${iso}T03:00:00Z`);

describe("CR sama dengan perhitungan Excel", () => {
  for (const s of excel.samples) {
    it(`${s.sheet} baris ${s.excelRow} · SPK ${s.spkNo} · ${s.process}`, () => {
      const r = calculateCR({ dueDate: s.dueDate, standardDays: p.get(s.machine), now: at(s.orderDate) });
      expect(r.cr).toBe(Math.round(s.crExcel * 100) / 100);
    });
  }

  it("mencakup semua sheet", () => {
    expect(new Set(excel.samples.map((s) => s.sheet)).size).toBe(5);
    expect(excel.samples.length).toBe(32);
  });
});
