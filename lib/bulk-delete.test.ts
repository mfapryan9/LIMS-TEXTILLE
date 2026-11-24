import { describe, expect, it } from "vitest";
import { createdAtRange } from "./bulk-delete";

describe("createdAtRange (hapus massal per tanggal pengajuan WIB)", () => {
  it("dari 00.00 WIB sampai akhir hari tanggal sampai", () => {
    const r = createdAtRange("2026-11-01", "2026-11-24");
    expect(r).toEqual({ ok: true, gte: new Date("2026-10-31T17:00:00Z"), lt: new Date("2026-11-24T17:00:00Z") });
  });

  it("satu hari saja", () => {
    const r = createdAtRange("2026-11-24", "2026-11-24");
    if (!r.ok) throw new Error(r.error);
    expect(r.lt.getTime() - r.gte.getTime()).toBe(24 * 3_600_000);
    // 23.59 WIB tanggal 24 masih termasuk, 00.00 WIB tanggal 25 tidak
    expect(new Date("2026-11-24T16:59:00Z") < r.lt).toBe(true);
    expect(new Date("2026-11-24T17:00:00Z") < r.lt).toBe(false);
  });

  it("menolak tanggal kosong, tidak valid, atau terbalik", () => {
    expect(createdAtRange("", "2026-11-24").ok).toBe(false);
    expect(createdAtRange("2026-02-30", "2026-03-01").ok).toBe(false);
    expect(createdAtRange("24/11/2026", "2026-11-24").ok).toBe(false);
    expect(createdAtRange("2026-11-25", "2026-11-24")).toEqual({ ok: false, error: "Tanggal dari tidak boleh setelah tanggal sampai" });
  });
});
