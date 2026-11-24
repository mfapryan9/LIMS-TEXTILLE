import { sampleLabel } from "./codes";

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
 * Seed untuk tabel roles (aktor Sprint 4).
 * - Kepala Produksi DF, Kepala PPIC, Kepala Laboratorium: memantau, melihat laporan kinerja, dan mengintervensi
 *   (membatalkan) urgent. Kepala PPIC juga dapat menghapus data pengajuan; Kepala Laboratorium mengelola akun.
 * - Kepala Seksi PPIC & Kepala Urusan PPIC: mengoperasikan sisi PPIC (mengajukan ke lab, minta edit/hapus, urutan urgent) + laporan kinerja.
 * - Kepala Seksi Laboratorium: mengoperasikan sisi lab (proses, selesai + foto, validasi edit/hapus) + laporan kinerja.
 * - Admin Lab: mengoperasikan sisi lab, tanpa laporan kinerja.
 */
export const ROLE_SEED = [
  { code: "KEPALA_PRODUKSI_DF", name: "Kepala Produksi DF", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "KEPALA_PPIC", name: "Kepala PPIC", viewMode: "MONITOR", canInterveneUrgent: true },
  { code: "KALAB", name: "Kepala Laboratorium", viewMode: "MONITOR", canInterveneUrgent: true, canManageUsers: true },
  { code: "KASI_PPIC", name: "Kepala Seksi PPIC", viewMode: "PLANNER", canEditSample: true, canEditDue: true, canMarkUrgent: true },
  { code: "KAUR_PPIC", name: "Kepala Urusan PPIC", viewMode: "PLANNER", canEditSample: true, canEditDue: true, canMarkUrgent: true },
  { code: "KASI_LAB", name: "Kepala Seksi Laboratorium", viewMode: "OPERATOR" },
  { code: "ADMIN_LAB", name: "Admin Lab", viewMode: "OPERATOR" },
] as const;

/** Operasional lab: notifikasi pengajuan masuk/urgent/validasi, memproses, memvalidasi edit/hapus. */
export const LAB_ROLES = ["ADMIN_LAB", "KASI_LAB"];
/** Operasional PPIC: mengajukan ke lab, mengatur urutan urgent; notifikasi pengajuan selesai & hasil validasi. */
export const PPIC_ROLES = ["KASI_PPIC", "KAUR_PPIC"];
/** Laporan kinerja: seluruh kepala, Kasi & Kaur PPIC, Kasi Lab (Admin Lab tidak). */
export const REPORT_ROLES = ["KEPALA_PRODUKSI_DF", "KEPALA_PPIC", "KALAB", "KASI_PPIC", "KAUR_PPIC", "KASI_LAB"];
/** Kepala yang menerima notifikasi setiap pengajuan urgent (dan dapat mengintervensinya). */
export const URGENT_WATCH_ROLES = ["KEPALA_PPIC", "KEPALA_PRODUKSI_DF", "KALAB"];

/** Status yang relevan per tampilan (tab default di dashboard). */
export const VIEW_DEFAULT_STATUSES: Record<ViewMode, string[] | "ALL"> = {
  OPERATOR: ["MENUNGGU", "DALAM_PROSES"],
  APPROVER: "ALL",
  PLANNER: "ALL",
  MONITOR: "ALL",
};

export type Permission =
  | "submitRequest" | "processRequest" | "interveneUrgent" | "markUrgent" | "manageUsers" | "manageMaster"
  | "validateChange" | "reorderUrgent" | "deleteSample";

/** Bagian lab: memvalidasi permintaan edit/hapus PPIC. */
export const isLabRole = (roleCode: string) => LAB_ROLES.includes(roleCode);

/** PPIC (Kasi & Kaur): mengatur urutan antar-pengajuan urgent karena PPIC yang mengetahui kebutuhan produksi. */
export const isPpicRole = (roleCode: string) => PPIC_ROLES.includes(roleCode);

/** Menghapus data pengajuan secara langsung (tanpa validasi lab), status apa pun: hanya Kepala PPIC. */
export const SAMPLE_DELETE_ROLES = ["KEPALA_PPIC"];
export const canDeleteSample = (roleCode: string) => SAMPLE_DELETE_ROLES.includes(roleCode);

/** SERVER-SIDE guard: panggil di setiap server action / route handler. UI hanya menyembunyikan tombol. */
export function assertCan(user: SessionUser, action: Permission) {
  const ok =
    (action === "submitRequest" && user.canEditSample) ||
    (action === "processRequest" && user.viewMode === "OPERATOR") ||
    (action === "interveneUrgent" && user.canInterveneUrgent) ||
    (action === "markUrgent" && user.canMarkUrgent) ||
    (action === "manageUsers" && user.canManageUsers) ||
    (action === "manageMaster" && user.canManageMaster) ||
    (action === "validateChange" && isLabRole(user.roleCode)) ||
    (action === "reorderUrgent" && isPpicRole(user.roleCode)) ||
    (action === "deleteSample" && canDeleteSample(user.roleCode));
  if (!ok) throw new Error("FORBIDDEN");
}

// ───────────── Notifikasi (diturunkan dari data, berbeda per peran) ─────────────

/**
 * INCOMING = pengajuan masuk (lab), URGENT = pengajuan urgent (lab & kepala), DONE = pengajuan selesai (PPIC),
 * CHANGE = permintaan edit/hapus dari PPIC yang menunggu validasi (lab), CHANGE_RESULT = hasil validasi (PPIC).
 */
export type NotifType = "INCOMING" | "URGENT" | "DONE" | "CHANGE" | "CHANGE_RESULT";

export interface Notif {
  key: string;
  type: NotifType;
  sampleId: string | null; // null bila pengajuan sudah dihapus
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

export interface ChangeSource {
  id: string;
  sampleId: string | null;
  type: "EDIT" | "DELETE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  label: string;
  reason: string | null;
  requesterName: string | null;
  createdAt: string; // ISO
  decidedAt: string | null; // ISO
  decidedByName: string | null;
  decisionNote: string | null;
}

const DONE_WINDOW_MS = 14 * 24 * 3600 * 1000;
const ACTIVE = ["MENUNGGU", "DALAM_PROSES"];
export const CHANGE_LABEL = { EDIT: "edit", DELETE: "hapus" } as const;

export function deriveNotifications(rows: NotifSource[], roleCode: string, seenAt: string | null, now: Date = new Date(), changes: ChangeSource[] = []): Notif[] {
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  const isLab = LAB_ROLES.includes(roleCode);
  const watchUrgent = isLab || URGENT_WATCH_ROLES.includes(roleCode);
  const isPpic = PPIC_ROLES.includes(roleCode);
  const out: (Notif & { at: number })[] = [];

  for (const s of rows) {
    const label = sampleLabel(s);
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
  for (const c of changes) {
    if (isLab && c.status === "PENDING") {
      const at = new Date(c.createdAt).getTime();
      out.push({
        key: `change-${c.id}`, type: "CHANGE", sampleId: c.sampleId, at, unread: at > seen,
        title: `Permintaan ${CHANGE_LABEL[c.type]} ${c.label}`,
        detail: `Dari PPIC${c.requesterName ? ` (${c.requesterName})` : ""} · menunggu validasi lab${c.reason ? ` · ${c.reason}` : ""}`,
      });
    }
    if (isPpic && c.status !== "PENDING" && c.decidedAt) {
      const at = new Date(c.decidedAt).getTime();
      if (now.getTime() - at < DONE_WINDOW_MS) {
        const ok = c.status === "APPROVED";
        out.push({
          key: `change-${c.id}`, type: "CHANGE_RESULT", sampleId: c.type === "DELETE" && ok ? null : c.sampleId, at, unread: at > seen,
          title: `Permintaan ${CHANGE_LABEL[c.type]} ${c.label} ${ok ? "disetujui" : "ditolak"} lab`,
          detail: `${c.decidedByName ? `Oleh ${c.decidedByName}` : "Divalidasi lab"}${c.decisionNote ? ` · ${c.decisionNote}` : ""}`,
        });
      }
    }
  }

  // Terbaru di atas
  return out.sort((a, b) => b.at - a.at).map(({ at: _at, ...n }) => n);
}
