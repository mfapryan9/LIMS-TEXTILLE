import type { SampleStatusKey, Urgency } from "@/lib/cr";

export type SampleRow = {
  id: string;
  orderNo: string | null;
  orderDate: string | null; // YYYY-MM-DD
  spkNo: string;
  orderType: "PRODUKSI" | "MARKETING";
  customerName: string | null;
  motif: string | null;
  colorDirection: string | null;
  colorCode: string | null;
  processName: string;
  machineId: string;
  machineName: string;
  processTypeId: string;
  fabricProblem: string | null;
  problemDescription: string | null;
  receivedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: SampleStatusKey;
  isUrgent: boolean;
  trialNo: number; // jumlah uji / matching warna dengan master (0 = belum pernah)
  rejectedCount: number; // berapa kali ditolak (rework)
  lastRejectNote: string | null; // alasan rework terakhir, untuk operator
  openTrialId: string | null; // percobaan yang sedang berjalan
  pendingTrialId: string | null; // percobaan yang menunggu approval
  approvedTrialNo: number | null; // di-ACC pada uji ke-n
  approvedAt: string | null; // YYYY-MM-DD (WIB)
  approverName: string | null;
  approvedNotes: string | null; // catatan/formula percobaan yang di-ACC
  labDays: number; // lama di lab: masuk lab → ACC (atau → hari ini bila belum selesai)
  cr: number | null;
  crAtOrder: number | null; // CR saat order masuk (t = TGL ORDER), sama dengan perhitungan Excel
  daysLeft: number;
  urgency: Urgency;
  standardDays: number | null;
};

export const STATUS_LABEL: Record<SampleStatusKey, string> = {
  MENUNGGU: "Menunggu",
  DALAM_PROSES: "Dalam proses",
  MENUNGGU_APPROVAL: "Menunggu approval",
  DISETUJUI: "Disetujui (ACC)",
  MATCHING_ULANG: "Matching ulang",
};

const STATUS_STYLE: Record<SampleStatusKey, string> = {
  MENUNGGU: "bg-slate-50 text-slate-700 ring-slate-200",
  DALAM_PROSES: "bg-sky-50 text-sky-800 ring-sky-200",
  MENUNGGU_APPROVAL: "bg-violet-50 text-violet-800 ring-violet-200",
  DISETUJUI: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  MATCHING_ULANG: "bg-orange-50 text-orange-800 ring-orange-200",
};

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

export function StatusBadge({ status }: { status: SampleStatusKey }) {
  return <span className={`${pill} ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** Badge CR: merah lembut (CR<0), kuning lembut (0≤CR≤1), hijau lembut. Selalu ada teks, tidak hanya warna. */
export function CrBadge({ cr, urgency, daysLeft }: Pick<SampleRow, "cr" | "urgency" | "daysLeft">) {
  if (urgency === "NONE" && cr === null) {
    return <span className={`${pill} bg-canvas text-ink-soft ring-line`} title="Waktu proses standar belum diatur di master data">p belum diatur</span>;
  }
  const label = urgency === "LATE" ? "Terlambat" : urgency === "WARNING" ? "Mendesak" : "Aman";
  const style =
    urgency === "LATE"
      ? "bg-rose-100 text-rose-800 ring-rose-300 font-semibold"
      : urgency === "WARNING"
        ? "bg-amber-100 text-amber-900 ring-amber-300"
        : "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return (
    <span className="inline-flex flex-col items-start leading-tight">
      <span className={`${pill} ${style}`}>{label}</span>
      <span className="mt-0.5 text-[11px] tabular-nums text-ink-soft">
        CR {cr === null ? "–" : cr.toFixed(2)} · {daysLeft < 0 ? `lewat ${-daysLeft} hr` : `sisa ${daysLeft} hr`}
      </span>
    </span>
  );
}

/** Sengaja mencolok (satu-satunya warna jenuh di tabel) agar sampel urgent langsung terlihat. */
export function UrgentBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-fuchsia-600 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white shadow-sm ring-2 ring-fuchsia-300">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      URGENT
    </span>
  );
}

/** Aksen tepi kiri & latar baris. Urgent: latar fuchsia + garis tebal agar menonjol dari baris lain. */
export const rowAccent = (u: Urgency, urgent: boolean) =>
  urgent
    ? "border-l-[6px] border-l-fuchsia-600 bg-fuchsia-50"
    : u === "LATE"
      ? "border-l-4 border-l-rose-400"
      : u === "WARNING"
        ? "border-l-4 border-l-amber-300"
        : "border-l-4 border-l-transparent";

/** "3 hari", atau "< 1 hari" bila masih di hari yang sama */
export const fmtDays = (n: number) => (n <= 0 ? "< 1 hari" : `${n} hari`);
