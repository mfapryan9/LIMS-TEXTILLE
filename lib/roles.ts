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
  notificationsSeenAt: string | null;
}

/** Seed untuk tabel roles. Approval utama HANYA KAUR_LAB; role atasan = MONITOR (read-only). */
export const ROLE_SEED = [
  { code: "OPERATOR_LAB", name: "Operator Lab", viewMode: "OPERATOR" },
  { code: "KAUR_LAB", name: "Kepala Urusan Laboratorium", viewMode: "APPROVER", canApprove: true, canManageMaster: true },
  { code: "KASI", name: "Kepala Seksi", viewMode: "MONITOR" },
  { code: "KALAB", name: "Kepala Laboratorium", viewMode: "MONITOR" },
  { code: "PPIC", name: "PPIC", viewMode: "PLANNER", canEditDue: true, canMarkUrgent: true },
  { code: "KEPALA_PPIC", name: "Kepala PPIC", viewMode: "MONITOR" },
  { code: "MARKETING", name: "Marketing", viewMode: "PLANNER", canEditDue: true, canMarkUrgent: true },
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
    (action === "editSample" && user.canEditDue) || // PPIC & Marketing menginput / mengoreksi data SPK

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
  rows: WithCR<SchedulableSample & { spkNo: string; customerName: string; colorCode: string }>[],
  seenAt: string | null,
  now: Date = new Date(),
): Notif[] {
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const out: Notif[] = [];

  for (const s of rows) {
    if (s.status === "DISETUJUI") continue;
    const label = `${s.spkNo} · ${s.colorCode}`;
    const created = new Date(s.createdAt).getTime();

    if (s.urgency === "LATE") {
      out.push({ key: `late-${s.id}`, type: "LATE", sampleId: s.id, title: `${label} terlambat`, detail: `Lewat ${Math.abs(s.daysLeft)} hari dari due date · ${s.customerName}`, unread: true });
    } else if (s.urgency === "WARNING") {
      out.push({ key: `near-${s.id}`, type: "NEAR_DEADLINE", sampleId: s.id, title: `${label} mendekati deadline`, detail: `CR ${s.cr} · sisa ${s.daysLeft} hari · ${s.customerName}`, unread: true });
    }
    if (s.isUrgent) {
      out.push({ key: `urgent-${s.id}`, type: "URGENT", sampleId: s.id, title: `${label} ditandai URGENT`, detail: s.customerName, unread: true });
    }
    if (now.getTime() - created < NEW_WINDOW_MS) {
      out.push({ key: `new-${s.id}`, type: "NEW", sampleId: s.id, title: `Sampel baru ${label}`, detail: s.customerName, unread: created > seen });
    }
  }
  // Terlambat → urgent → mendekati → baru
  const order: Record<NotifType, number> = { LATE: 0, URGENT: 1, NEAR_DEADLINE: 2, NEW: 3 };
  return out.sort((a, b) => order[a.type] - order[b.type]);
}
