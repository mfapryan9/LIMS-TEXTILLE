import { describe, expect, it } from "vitest";
import { deriveNotifications, type NotifSource } from "./roles";

const now = new Date("2026-11-14T08:00:00Z");
const row = (o: Partial<NotifSource>): NotifSource => ({
  id: "s1", status: "MENUNGGU", orderNo: "26-4001", spkNo: "26-4001", colorCode: "CM-415", processName: "PROOF REAKTIF",
  isUrgent: false, createdAt: "2026-11-14T07:00:00Z", urgentAt: null, completedAt: null, processorName: null, ...o,
});
const types = (rows: NotifSource[], role: string) => deriveNotifications(rows, role, null, now).map((n) => n.type);

describe("deriveNotifications: notifikasi berbeda per peran (Sprint 3)", () => {
  const incoming = row({ id: "a" });
  const urgent = row({ id: "b", isUrgent: true, urgentAt: "2026-11-14T07:30:00Z" });
  const done = row({ id: "c", status: "DISETUJUI", completedAt: "2026-11-14T06:00:00Z", processorName: "Budi" });
  const all = [incoming, urgent, done];

  it("operator & kepala lab: pengajuan masuk dan urgent (terpisah), tanpa notifikasi selesai", () => {
    expect(types(all, "OPERATOR_LAB").sort()).toEqual(["INCOMING", "URGENT"]);
    expect(types(all, "KALAB").sort()).toEqual(["INCOMING", "URGENT"]);
  });

  it("PPIC: hanya notifikasi pengajuan selesai (foto terlampir)", () => {
    const n = deriveNotifications(all, "PPIC", null, now);
    expect(n.map((x) => x.type)).toEqual(["DONE"]);
    expect(n[0].detail).toContain("Budi");
  });

  it("Kepala PPIC & Kepala Produksi DF: hanya notifikasi urgent", () => {
    expect(types(all, "KEPALA_PPIC")).toEqual(["URGENT"]);
    expect(types(all, "KEPALA_PRODUKSI_DF")).toEqual(["URGENT"]);
  });

  it("urgent yang sudah selesai tidak lagi menjadi notifikasi urgent", () => {
    expect(types([row({ isUrgent: true, status: "DISETUJUI", completedAt: "2026-11-14T06:00:00Z" })], "KEPALA_PPIC")).toEqual([]);
  });

  it("status belum dibaca mengikuti waktu terakhir notifikasi dibuka", () => {
    const n = deriveNotifications([incoming], "OPERATOR_LAB", "2026-11-14T07:10:00Z", now);
    expect(n[0].unread).toBe(false);
  });
});
