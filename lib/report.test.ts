import { describe, expect, it } from "vitest";
import { buildReport, fmtHours, inRange, jakartaDate, type ReportSource } from "./report";
import { isProcessorGroup, PROCESSOR_GROUP_NAMES } from "./processors";

const r = (o: Partial<ReportSource>): ReportSource => ({
  createdAt: "2026-11-10T02:00:00Z", dueDate: "2026-11-17", status: "MENUNGGU", isUrgent: false, machineName: "A. Thermosol",
  processorName: null, processStartedAt: null, completedAt: null, approvedAt: null, labDays: 0, ...o,
});

describe("laporan kinerja (rentang tanggal custom)", () => {
  it("tanggal pengajuan memakai kalender WIB", () => {
    expect(jakartaDate("2026-11-09T18:30:00Z")).toBe("2026-11-10"); // 01.30 WIB
  });

  it("menyaring rentang dari–sampai (inklusif), kosong = tanpa batas", () => {
    const rows = [r({ createdAt: "2026-11-01T02:00:00Z" }), r({ createdAt: "2026-11-10T02:00:00Z" }), r({ createdAt: "2026-11-20T02:00:00Z" })];
    expect(inRange(rows, "2026-11-01", "2026-11-10")).toHaveLength(2);
    expect(inRange(rows, "2026-11-11", "")).toHaveLength(1);
    expect(inRange(rows, "", "")).toHaveLength(3);
  });

  it("menghitung selesai, tepat waktu, rata-rata menunggu & proses, per grup", () => {
    const g = PROCESSOR_GROUP_NAMES[0];
    const rows = [
      r({ status: "DISETUJUI", processorName: g, processStartedAt: "2026-11-10T04:00:00Z", completedAt: "2026-11-10T10:00:00Z", labDays: 0 }),
      r({ status: "DISETUJUI", processorName: g, processStartedAt: "2026-11-10T06:00:00Z", completedAt: "2026-11-18T06:00:00Z", labDays: 8 }), // terlambat
      r({ status: "DALAM_PROSES", processorName: PROCESSOR_GROUP_NAMES[1], processStartedAt: "2026-11-10T03:00:00Z" }),
      r({ status: "MENUNGGU", isUrgent: true, dueDate: "2026-11-12" }),
    ];
    const rep = buildReport(rows, "2026-11-01", "2026-11-30", "2026-11-16");
    expect([rep.total, rep.done, rep.onTime, rep.late, rep.urgent, rep.overdueOpen]).toEqual([4, 2, 1, 1, 1, 1]);
    expect(rep.avgWaitHours).toBeCloseTo((2 + 4 + 1) / 3);
    expect(rep.avgProcessHours).toBeCloseTo((6 + 192) / 2);
    expect(rep.byProcessor[0]).toMatchObject({ name: g, total: 2, done: 2, onTime: 1 });
  });

  it("data lama (pemroses 'Operator Lab' hasil migrasi) tidak memengaruhi rata-rata lama menunggu", () => {
    const rows = [
      r({ status: "DALAM_PROSES", processorName: "Operator Lab", createdAt: "2026-10-01T01:00:00Z", processStartedAt: "2026-11-14T02:00:00Z" }),
      r({ status: "DALAM_PROSES", processorName: PROCESSOR_GROUP_NAMES[0], processStartedAt: "2026-11-10T05:00:00Z" }),
    ];
    const rep = buildReport(rows, "", "", "2026-11-16");
    expect(rep.avgWaitHours).toBeCloseTo(3);
    expect(rep.byProcessor.map((x) => x.name)).toContain("Operator Lab (data lama)");
  });

  it("format durasi jam / hari", () => {
    expect(fmtHours(null)).toBe("–");
    expect(fmtHours(0.4)).toBe("< 1 jam");
    expect(fmtHours(5.2)).toBe("5 jam");
    expect(fmtHours(47.8)).toBe("2 hari");
    expect(fmtHours(27)).toBe("1 hari 3 jam");
  });
});

describe("grup pemroses lab", () => {
  it("empat grup tetap, nama grup memuat anggotanya", () => {
    expect(PROCESSOR_GROUP_NAMES).toEqual([
      "Grup ALNI, ATYKAH, SELA",
      "Grup ALFATH, KASIM, NOPAL",
      "Grup PIO, NURJANAH, JELYN",
      "Grup RAHMA, SYIFA, CAHYONO",
    ]);
    expect(isProcessorGroup("Grup PIO, NURJANAH, JELYN")).toBe(true);
    expect(isProcessorGroup("Budi")).toBe(false);
  });
});
