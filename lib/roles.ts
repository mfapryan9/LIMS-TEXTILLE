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
  canManageUsers: boolean;
  canInterveneUrgent: boolean;
  notificationsSeenAt: string | null;
}

/**
 * Seed untuk tabel roles (alur Sprint 3).
 * - PPIC: satu-satunya yang mengajukan sampel ke lab (boleh urgent) dan mengedit pengajuan yang belum diproses.
 * - Operator Lab: memproses pengajuan (isi nama pemroses) lalu menyelesaikannya dengan foto hasil uji.
 * - Seluruh kepala: monitoring + dapat mengintervensi (membatalkan) urgent. Kepala Laboratorium juga mengelola akun.
 */
export const ROLE_SEED = [
  { code: "PPIC", name: "PPIC", viewMode: "PLANNER", canEditSample: true, canEditDue: true, canMarkUrgent: true },
  { code: "OPERATOR_LAB", name: "Operator Lab", viewMode: "OPERATOR" },
  { code: "KALAB", name: "Kepala Laboratorium", viewMode: "MONITOR", canInterveneUrgent: true, canManageUsers: true },
  { code: "KEPALA_PRODUKSI_DF", name: "Kepala Produksi DF", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "KEPALA_PPIC", name: "Kepala PPIC", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "KAUR_LAB", name: "Kepala Urusan Laboratorium", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "KASI", name: "Kepala Seksi", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "ADMIN", name: "Admin Sistem", viewMode: "MONITOR" },
] as const;

/** Peran yang berada di laboratorium: menerima notifikasi pengajuan masuk & urgent. */
export const LAB_ROLES = ["OPERATOR_LAB", "KALAB", "KAUR_LAB", "KASI"];
/** Kepala yang menerima notifikasi setiap pengajuan urgent. */
export const URGENT_WATCH_ROLES = ["KEPALA_PPIC", "KEPALA_PRODUKSI_DF"];

/** Status yang relevan per tampilan (tab default di dashboard). */
export const VIEW_DEFAULT_STATUSES: Record<ViewMode, string[] | "ALL"> = {
  OPERATOR: ["MENUNGGU", "DALAM_PROSES"],
  APPROVER: "ALL",
  PLANNER: "ALL",
  MONITOR: "ALL",
};

export type Permission = "submitRequest" | "processRequest" | "interveneUrgent" | "markUrgent" | "manageUsers" | "manageMaster";

/** SERVER-SIDE guard: panggil di setiap server action / route handler. UI hanya menyembunyikan tombol. */
export function assertCan(user: SessionUser, action: Permission) {
  const ok =
    (action === "submitRequest" && user.canEditSample) ||
    (action === "processRequest" && user.viewMode === "OPERATOR") ||
    (action === "interveneUrgent" && user.canInterveneUrgent) ||
    (action === "markUrgent" && user.canMarkUrgent) ||
    (action === "manageUsers" && user.canManageUsers) ||
    (action === "manageMaster" && user.canManageMaster);
  if (!ok) throw new Error("FORBIDDEN");
}

// ───────────── Notifikasi (diturunkan dari data, berbeda per peran) ─────────────

/** INCOMING = pengajuan masuk (lab), URGENT = pengajuan urgent (lab & kepala), DONE = pengajuan selesai (PPIC). */
export type NotifType = "INCOMING" | "URGENT" | "DONE";

export interface Notif {
  key: string;
  type: NotifType;
  sampleId: string;
  title: string;
  detail: string;
  unread: boolean;
}

export interface NotifSource {
  id: string;
  status: string;
  orderNo: string | null;
  spkNo: string;
  colorCode: string | null;
  processName: string;
  isUrgent: boolean;
  createdAt: string; // ISO
  urgentAt: string | null; // ISO
  completedAt: string | null; // ISO
  processorName: string | null;
  requesterName?: string | null;
}

const DONE_WINDOW_MS = 14 * 24 * 3600 * 1000;
const ACTIVE = ["MENUNGGU", "DALAM_PROSES"];

export function deriveNotifications(rows: NotifSource[], roleCode: string, seenAt: string | null, now: Date = new Date()): Notif[] {
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const isLab = LAB_ROLES.includes(roleCode);
  const watchUrgent = isLab || URGENT_WATCH_ROLES.includes(roleCode);
  const isPpic = roleCode === "PPIC";
  const out: (Notif & { at: number })[] = [];

  for (const s of rows) {
    const label = `Order ${s.orderNo ?? s.spkNo}${s.colorCode ? ` · ${s.colorCode}` : ""}`;
    const active = ACTIVE.includes(s.status);
    const created = new Date(s.createdAt).getTime();

    if (watchUrgent && active && s.isUrgent) {
      const at = s.urgentAt ? new Date(s.urgentAt).getTime() : created;
      out.push({
        key: `urgent-${s.id}`, type: "URGENT", sampleId: s.id, at, unread: at > seen,
        title: `Pengajuan URGENT ${label}`,
        detail: s.status === "DALAM_PROSES" ? `Sedang diproses${s.processorName ? ` oleh ${s.processorName}` : ""}` : `${s.processName} · menunggu diproses`,
      });
    } else if (isLab && s.status === "MENUNGGU") {
      out.push({ key: `in-${s.id}`, type: "INCOMING", sampleId: s.id, at: created, unread: created > seen, title: `Pengajuan masuk ${label}`, detail: `${s.processName}${s.requesterName ? ` · diajukan oleh ${s.requesterName}` : ""}` });
    }

    if (isPpic && s.status === "DISETUJUI" && s.completedAt) {
      const at = new Date(s.completedAt).getTime();
      if (now.getTime() - at < DONE_WINDOW_MS) {
        out.push({
          key: `done-${s.id}`, type: "DONE", sampleId: s.id, at, unread: at > seen,
          title: `Pengajuan selesai ${label}`,
          detail: `Selesai${s.processorName ? ` oleh ${s.processorName}` : ""} · foto hasil uji terlampir`,
        });
      }
    }
  }
  // Terbaru di atas
  return out.sort((a, b) => b.at - a.at).map(({ at: _at, ...n }) => n);
}
