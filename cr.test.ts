import { describe, it, expect } from "vitest";
import { calculateCR, defaultDueDate, sortByPriority, withCR, buildStandardTimeMap } from "./cr";

// 29 Okt 2026 pukul 10:00 WIB
const NOW = new Date("2026-10-29T03:00:00Z");

describe("calculateCR", () => {
  it("lewat due date → CR negatif, LATE", () => {
    const r = calculateCR({ dueDate: "2026-10-27", standardDays: 2, now: NOW });
    expect(r).toMatchObject({ daysLeft: -2, cr: -1, urgency: "LATE" });
  });
  it("batas 0 dan 1 → WARNING", () => {
    expect(calculateCR({ dueDate: "2026-10-29", standardDays: 2, now: NOW }).urgency).toBe("WARNING"); // CR 0
    expect(calculateCR({ dueDate: "2026-10-31", standardDays: 2, now: NOW }).urgency).toBe("WARNING"); // CR 1
    expect(calculateCR({ dueDate: "2026-11-01", standardDays: 2, now: NOW }).urgency).toBe("NORMAL"); // CR 1.5
  });
  it("tidak bergeser oleh UTC: 23:30 UTC = 06:30 WIB hari berikutnya", () => {
    const late = new Date("2026-10-28T23:30:00Z"); // 29 Okt 06:30 WIB
    expect(calculateCR({ dueDate: "2026-10-29", standardDays: 1, now: late }).daysLeft).toBe(0);
  });
  it("p tidak valid → cr null", () => {
    expect(calculateCR({ dueDate: "2026-11-05", standardDays: 0, now: NOW }).reason).toBe("NO_STANDARD_TIME");
    expect(calculateCR({ dueDate: "2026-11-05", standardDays: null, now: NOW }).cr).toBeNull();
  });
  it("DISETUJUI tidak dihitung", () => {
    expect(calculateCR({ dueDate: "2026-10-01", standardDays: 2, status: "DISETUJUI", now: NOW }).reason).toBe("COMPLETED");
  });
  it("menerima Date dari kolom @db.Date", () => {
    expect(calculateCR({ dueDate: new Date("2026-10-30T00:00:00Z"), standardDays: 1, now: NOW }).cr).toBe(1);
  });
});

describe("defaultDueDate", () => {
  it("+7 hari melewati pergantian bulan", () => expect(defaultDueDate("2026-10-29")).toBe("2026-11-05"));
});

describe("sortByPriority", () => {
  const base = { isUrgent: false, createdAt: "2026-10-01", processTypeId: "a", machineId: "m" };
  const times = buildStandardTimeMap([{ processTypeId: "a", machineId: "m", standardDays: 2 }]);

  it("CR terkecil di atas, tanpa p di bawah, disetujui paling bawah", () => {
    const rows = withCR(
      [
        { ...base, id: "ok", status: "MENUNGGU" as const, dueDate: "2026-11-10" },
        { ...base, id: "late", status: "MENUNGGU" as const, dueDate: "2026-10-25" },
        { ...base, id: "done", status: "DISETUJUI" as const, dueDate: "2026-10-01" },
        { ...base, id: "nop", status: "MENUNGGU" as const, dueDate: "2026-10-30", machineId: "x" },
      ],
      times,
      NOW,
    );
    expect(sortByPriority(rows).map((r) => r.id)).toEqual(["late", "ok", "nop", "done"]);
  });

  it("URGENT selalu paling atas, walau CR-nya besar; antar-urgent diurutkan CR", () => {
    const rows = withCR(
      [
        { ...base, id: "late", status: "MENUNGGU" as const, dueDate: "2026-10-25" },
        { ...base, id: "urgent-far", status: "MENUNGGU" as const, dueDate: "2026-12-01", isUrgent: true },
        { ...base, id: "urgent-near", status: "DALAM_PROSES" as const, dueDate: "2026-10-31", isUrgent: true },
        { ...base, id: "urgent-done", status: "DISETUJUI" as const, dueDate: "2026-10-31", isUrgent: true },
      ],
      times,
      NOW,
    );
    expect(sortByPriority(rows).map((r) => r.id)).toEqual(["urgent-near", "urgent-far", "late", "urgent-done"]);
  });
});
