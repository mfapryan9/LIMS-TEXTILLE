import type { SampleStatusKey, Urgency } from "@/lib/cr";

export type SampleRow = {
  id: string;
  spkNo: string;
  orderType: "PRODUKSI" | "MARKETING";
  customerName: string;
  motif: string;
  colorDirection: string;
  colorCode: string;
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
  trialNo: number; // percobaan terakhir (0 = belum ada)
  openTrialId: string | null; // percobaan yang sedang berjalan
  pendingTrialId: string | null; // percobaan yang menunggu approval
  cr: number | null;
  daysLeft: number;
  urgency: Urgency;
  standardDays: number | null;
};

export const STATUS_LABEL: Record<SampleStatusKey, string> = {
  MENUNGGU: "Menunggu",
  DALAM_PROSES: "Dalam proses",
  MENUNGGU_APPROVAL: "Menunggu approval",
  DISETUJUI: "Disetujui",
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

export function UrgentBadge() {
  return <span className={`${pill} bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-300 font-semibold tracking-wide`}>URGENT</span>;
}

/** Titik warna kecil berdasarkan stempel urgensi untuk tepi kiri baris. */
export const rowAccent = (u: Urgency, urgent: boolean) =>
  urgent ? "border-l-fuchsia-400" : u === "LATE" ? "border-l-rose-400" : u === "WARNING" ? "border-l-amber-300" : "border-l-transparent";
