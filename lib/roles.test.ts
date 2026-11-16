import { describe, expect, it } from "vitest";
import { assertCan, deriveNotifications, type ChangeSource, type NotifSource, type SessionUser } from "./roles";

const now = new Date("2026-11-14T08:00:00Z");
const row = (o: Partial<NotifSource>): NotifSource => ({
  id: "s1", status: "MENUNGGU", orderNo: "26-4001", spkNo: "26-4001", colorCode: "415", processName: "PROOF REAKTIF",
  isUrgent: false, createdAt: "2026-11-14T07:00:00Z", urgentAt: null, completedAt: null, processorName: null, ...o,
});
const types = (rows: NotifSource[], role: string) => deriveNotifications(rows, role, null, now).map((n) => n.type);

describe("deriveNotifications: notifikasi berbeda per peran (Sprint 3)", () => {
  const incoming = row({ id: "a" });
  const urgent = row({ id: "b", isUrgent: true, urgentAt: "2026-11-14T07:30:00Z" });
  const done = row({ id: "c", status: "DISETUJUI", completedAt: "2026-11-14T06:00:00Z", processorName: "Budi" });
  const all = [incoming, urgent, done];

  it("Admin Lab & Kasi Lab: pengajuan masuk dan urgent (terpisah), tanpa notifikasi selesai", () => {
    expect(types(all, "ADMIN_LAB").sort()).toEqual(["INCOMING", "URGENT"]);
    expect(types(all, "KASI_LAB").sort()).toEqual(["INCOMING", "URGENT"]);
  });

  it("PPIC: hanya notifikasi pengajuan selesai (foto terlampir)", () => {
    const n = deriveNotifications(all, "KAUR_PPIC", null, now);
    expect(types(all, "KASI_PPIC")).toEqual(["DONE"]);
    expect(n.map((x) => x.type)).toEqual(["DONE"]);
    expect(n[0].detail).toContain("Budi");
  });

  it("Kepala PPIC, Kepala Produksi DF, Kepala Lab: hanya notifikasi urgent", () => {
    expect(types(all, "KALAB")).toEqual(["URGENT"]);
    expect(types(all, "KEPALA_PPIC")).toEqual(["URGENT"]);
    expect(types(all, "KEPALA_PRODUKSI_DF")).toEqual(["URGENT"]);
  });

  it("urgent yang sudah selesai tidak lagi menjadi notifikasi urgent", () => {
    expect(types([row({ isUrgent: true, status: "DISETUJUI", completedAt: "2026-11-14T06:00:00Z" })], "KEPALA_PPIC")).toEqual([]);
  });

  it("status belum dibaca mengikuti waktu terakhir notifikasi dibuka", () => {
    const n = deriveNotifications([incoming], "ADMIN_LAB", "2026-11-14T07:10:00Z", now);
    expect(n[0].unread).toBe(false);
  });
});

describe("permintaan edit / hapus PPIC divalidasi lab (Sprint 4)", () => {
  const change = (o: Partial<ChangeSource>): ChangeSource => ({
    id: "c1", sampleId: "s1", type: "EDIT", status: "PENDING", label: "Order 26-4001 · CM 415", reason: null, requesterName: "Rina",
    createdAt: "2026-11-14T07:00:00Z", decidedAt: null, decidedByName: null, decisionNote: null, ...o,
  });

  it("permintaan yang menunggu muncul di notifikasi lab, tidak di PPIC / kepala non-lab", () => {
    const n = deriveNotifications([], "ADMIN_LAB", null, now, [change({ type: "DELETE", reason: "order batal" })]);
    expect(n.map((x) => x.type)).toEqual(["CHANGE"]);
    expect(n[0].title).toContain("hapus");
    expect(deriveNotifications([], "KASI_LAB", null, now, [change({})]).map((x) => x.type)).toEqual(["CHANGE"]);
    expect(deriveNotifications([], "KAUR_PPIC", null, now, [change({})])).toEqual([]);
    expect(deriveNotifications([], "KALAB", null, now, [change({})])).toEqual([]);
    expect(deriveNotifications([], "KEPALA_PPIC", null, now, [change({})])).toEqual([]);
  });

  it("PPIC menerima hasil validasi; hapus yang disetujui tidak menunjuk baris lagi", () => {
    const n = deriveNotifications([], "KASI_PPIC", null, now, [
      change({ id: "a", status: "APPROVED", type: "DELETE", decidedAt: "2026-11-14T07:30:00Z", decidedByName: "Operator Lab" }),
      change({ id: "b", status: "REJECTED", decidedAt: "2026-11-14T07:20:00Z", decisionNote: "sudah dicelup" }),
    ]);
    expect(n.map((x) => x.type)).toEqual(["CHANGE_RESULT", "CHANGE_RESULT"]);
    expect(n[0].sampleId).toBeNull();
    expect(n[1].title).toContain("ditolak");
    expect(n[1].detail).toContain("sudah dicelup");
  });

  it("hanya bagian lab yang boleh memvalidasi dan menggeser urutan urgent", () => {
    const u = (roleCode: string, viewMode: SessionUser["viewMode"]) => ({ roleCode, viewMode } as SessionUser);
    expect(() => assertCan(u("ADMIN_LAB", "OPERATOR"), "validateChange")).not.toThrow();
    expect(() => assertCan(u("KASI_LAB", "OPERATOR"), "reorderUrgent")).not.toThrow();
    expect(() => assertCan(u("KAUR_PPIC", "PLANNER"), "validateChange")).toThrow("FORBIDDEN");
    expect(() => assertCan(u("KALAB", "MONITOR"), "reorderUrgent")).toThrow("FORBIDDEN");
    expect(() => assertCan(u("KEPALA_PPIC", "MONITOR"), "reorderUrgent")).toThrow("FORBIDDEN");
  });
});

describe("aktor Sprint 4", () => {
  it("laporan kinerja untuk kepala, Kasi/Kaur PPIC, dan Kasi Lab; Admin Lab tidak", async () => {
    const { REPORT_ROLES, ROLE_SEED } = await import("./roles");
    expect(ROLE_SEED.map((r) => r.code).sort()).toEqual(["ADMIN_LAB", "KALAB", "KASI_LAB", "KASI_PPIC", "KAUR_PPIC", "KEPALA_PPIC", "KEPALA_PRODUKSI_DF"]);
    expect(REPORT_ROLES).not.toContain("ADMIN_LAB");
    expect(REPORT_ROLES).toHaveLength(6);
  });
});
