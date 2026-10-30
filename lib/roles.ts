import type { WithCR, SchedulableSample } from "./cr";

export type ViewMode = "OPERATOR" | "APPROVER" | "PLANNER" | "MONITOR";

export interface SessionUser {
  id: string;
  name: string;
  roleCode: string;
  viewMode: ViewMode;
  canApprove: boolean;
  canEditDue: boolean;
  canMarkUrgent: boolean;
  canManageMaster: boolean;
  canEditSample: boolean;
  notificationsSeenAt: string | null;
}

/** Seed untuk tabel roles. "Kepala" (Kaur Lab & Kasi) = approver; Operator & Kepala bisa tambah (scan) / edit SPK. */
export const ROLE_SEED = [
  { code: "OPERATOR_LAB", name: "Operator Lab", viewMode: "OPERATOR", canEditSample: true },
  { code: "KAUR_LAB", name: "Kepala Urusan Laboratorium", viewMode: "APPROVER", canApprove: true, canEditSample: true, canManageMaster: true },
  { code: "KASI", name: "Kepala Seksi", viewMode: "APPROVER", canApprove: true, canEditSample: true },
  { code: "KALAB", name: "Kepala Laboratorium", viewMode: "MONITOR" },
  { code: "PPIC", name: "PPIC", viewMode: "PLANNER", canEditDue: true, canMarkUrgent: true, canEditSample: true },
  { code: "KEPALA_PPIC", name: "Kepala PPIC", viewMode: "MONITOR" },
  { code: "MARKETING", name: "Marketing", viewMode: "PLANNER", canEditDue: true, canMarkUrgent: true, canEditSample: true },
  { code: "KEPALA_MARKETING", name: "Kepala Marketing", viewMode: "MONITOR" },
  { code: "ADMIN", name: "Admin Sistem", viewMode: "MONITOR", canManageMaster: true },
] as const;

/** Status yang relevan per tampilan (tab default di dashboard). */
export const VIEW_DEFAULT_STATUSES: Record<ViewMode, string[] | "ALL"> = {
  OPERATOR: ["MENUNGGU", "DALAM_PROSES", "MATCHING_ULANG"],
  APPROVER: ["MENUNGGU_APPROVAL"],
  PLANNER: "ALL",
  MONITOR: "ALL",
};

/** SERVER-SIDE guard: panggil di setiap server action / route handler. UI hanya menyembunyikan tombol. */
export function assertCan(user: SessionUser, action: "approve" | "editDue" | "markUrgent" | "runTrial" | "manageMaster" | "editSample") {
  const ok =
    (action === "approve" && user.canApprove) ||
    (action === "editDue" && user.canEditDue) ||
    (action === "editSample" && user.canEditSample) ||
    (action === "markUrgent" && user.canMarkUrgent) ||
    (action === "manageMaster" && user.canManageMaster) ||
    (action === "runTrial" && user.viewMode === "OPERATOR");
  if (!ok) throw new Error("FORBIDDEN");
}

// ───────────── Notifikasi (diturunkan dari data, tanpa tabel tambahan) ─────────────

export type NotifType = "NEW" | "NEAR_DEADLINE" | "LATE" | "URGENT";

export interface Notif {
  key: string;
  type: NotifType;
  sampleId: string;
  title: string;
  detail: string;
  unread: boolean;
}

const NEW_WINDOW_MS = 24 * 3600 * 1000;

export function deriveNotifications(
  rows: WithCR<SchedulableSample & { spkNo: string; customerName: string | null; colorCode: string | null }>[],
  seenAt: string | null,
  now: Date = new Date(),
): Notif[] {
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const out: Notif[] = [];

  for (const s of rows) {
    if (s.status === "DISETUJUI") continue;
    const label = s.colorCode ? `${s.spkNo} · ${s.colorCode}` : `SPK ${s.spkNo}`;
    const customer = s.customerName ?? "";
    const created = new Date(s.createdAt).getTime();

    if (s.urgency === "LATE") {
      out.push({ key: `late-${s.id}`, type: "LATE", sampleId: s.id, title: `${label} terlambat`, detail: `Lewat ${Math.abs(s.daysLeft)} hari dari due date${customer && ` · ${customer}`}`, unread: true });
    } else if (s.urgency === "WARNING") {
      out.push({ key: `near-${s.id}`, type: "NEAR_DEADLINE", sampleId: s.id, title: `${label} mendekati deadline`, detail: `CR ${s.cr} · sisa ${s.daysLeft} hari${customer && ` · ${customer}`}`, unread: true });
    }
    if (s.isUrgent) {
      out.push({ key: `urgent-${s.id}`, type: "URGENT", sampleId: s.id, title: `${label} ditandai URGENT`, detail: customer || "Prioritas utama", unread: true });
    }
    if (now.getTime() - created < NEW_WINDOW_MS) {
      out.push({ key: `new-${s.id}`, type: "NEW", sampleId: s.id, title: `Sampel baru ${label}`, detail: customer || "Masuk antrean lab", unread: created > seen });
    }
  }
  // Terlambat → urgent → mendekati → baru
  const order: Record<NotifType, number> = { LATE: 0, URGENT: 1, NEAR_DEADLINE: 2, NEW: 3 };
  return out.sort((a, b) => order[a.type] - order[b.type]);
}
