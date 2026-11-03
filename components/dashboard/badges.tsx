import { AlertTriangle, CheckCircle2, Clock3, Zap } from "lucide-react";
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
  machineColor: number; // indeks warna kelompok mesin (lihat MACHINE_TONES)
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

/**
 * Warna pembeda tiap kelompok mesin (urut nama: A. Thermosol, B. CPB, …). Kelompok baru memakai warna berikutnya.
 * Sengaja tidak memakai pink/fuchsia (URGENT) dan merah (Terlambat).
 */
export const MACHINE_TONES = [
  { chip: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-500", solid: "bg-orange-500 text-white", ring: "ring-orange-400", bar: "bg-orange-400" },
  { chip: "bg-blue-50 text-blue-800 ring-blue-200", dot: "bg-blue-500", solid: "bg-blue-600 text-white", ring: "ring-blue-400", bar: "bg-blue-400" },
  { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", solid: "bg-emerald-600 text-white", ring: "ring-emerald-400", bar: "bg-emerald-400" },
  { chip: "bg-violet-50 text-violet-800 ring-violet-200", dot: "bg-violet-500", solid: "bg-violet-600 text-white", ring: "ring-violet-400", bar: "bg-violet-400" },
  { chip: "bg-yellow-50 text-yellow-900 ring-yellow-300", dot: "bg-yellow-400", solid: "bg-yellow-400 text-yellow-950", ring: "ring-yellow-400", bar: "bg-yellow-400" },
  { chip: "bg-cyan-50 text-cyan-800 ring-cyan-200", dot: "bg-cyan-500", solid: "bg-cyan-600 text-white", ring: "ring-cyan-400", bar: "bg-cyan-400" },
  { chip: "bg-indigo-50 text-indigo-800 ring-indigo-200", dot: "bg-indigo-500", solid: "bg-indigo-600 text-white", ring: "ring-indigo-400", bar: "bg-indigo-400" },
  { chip: "bg-lime-50 text-lime-900 ring-lime-300", dot: "bg-lime-500", solid: "bg-lime-500 text-lime-950", ring: "ring-lime-400", bar: "bg-lime-400" },
  { chip: "bg-stone-100 text-stone-800 ring-stone-300", dot: "bg-stone-500", solid: "bg-stone-600 text-white", ring: "ring-stone-400", bar: "bg-stone-400" },
] as const;

export const machineTone = (i: number) => MACHINE_TONES[((i % MACHINE_TONES.length) + MACHINE_TONES.length) % MACHINE_TONES.length];

/** Chip nama kelompok mesin dengan warna khas kelompoknya. */
export function MachineChip({ name, color }: { name: string; color: number }) {
  const t = machineTone(color);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${t.chip}`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${t.dot}`} />
      {name}
    </span>
  );
}

export const STATUS_LABEL: Record<SampleStatusKey, string> = {
  MENUNGGU: "Menunggu",
  DALAM_PROSES: "Dalam proses",
  MENUNGGU_APPROVAL: "Menunggu approval",
  DISETUJUI: "Disetujui (ACC)",
  MATCHING_ULANG: "Matching ulang",
};

/** [latar chip, warna titik] per status */
const STATUS_STYLE: Record<SampleStatusKey, [string, string]> = {
  MENUNGGU: ["bg-slate-100 text-slate-700", "bg-slate-400"],
  DALAM_PROSES: ["bg-sky-50 text-sky-700", "bg-sky-500"],
  MENUNGGU_APPROVAL: ["bg-violet-50 text-violet-700", "bg-violet-500"],
  DISETUJUI: ["bg-emerald-50 text-emerald-700", "bg-emerald-500"],
  MATCHING_ULANG: ["bg-orange-50 text-orange-700", "bg-orange-500"],
};

const chip = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";

export function StatusBadge({ status }: { status: SampleStatusKey }) {
  const [bg, dot] = STATUS_STYLE[status];
  return (
    <span className={`${chip} ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Badge CR: merah (CR<0), kuning (0≤CR≤1), hijau. Selalu ada teks & ikon, tidak hanya warna. */
export function CrBadge({ cr, urgency, daysLeft }: Pick<SampleRow, "cr" | "urgency" | "daysLeft">) {
  if (urgency === "NONE" && cr === null) {
    return <span className={`${chip} bg-slate-100 text-ink-soft`} title="Waktu proses standar belum diatur di master data">p belum diatur</span>;
  }
  const [label, style, Icon] =
    urgency === "LATE"
      ? (["Terlambat", "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200", AlertTriangle] as const)
      : urgency === "WARNING"
        ? (["Mendesak", "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200", Clock3] as const)
        : (["Aman", "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", CheckCircle2] as const);
  return (
    <span className="inline-flex flex-col items-start gap-1 leading-tight">
      <span className={`${chip} ${style}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
      <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-ink-soft">
        CR <span className="text-ink">{cr === null ? "–" : cr.toFixed(2)}</span> · {daysLeft < 0 ? `lewat ${-daysLeft} hr` : `sisa ${daysLeft} hr`}
      </span>
    </span>
  );
}

/** Sengaja mencolok (satu-satunya warna jenuh di tabel) agar sampel urgent langsung terlihat. */
export function UrgentBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500 py-1 pl-2 pr-2.5 text-xs font-bold tracking-wider text-white shadow-[0_4px_14px_-4px_rgba(192,38,211,0.7)]">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <Zap className="h-3.5 w-3.5 fill-white" aria-hidden />
      URGENT
    </span>
  );
}

/** Aksen baris. Urgent: latar fuchsia lembut + garis tebal agar menonjol dari baris lain. */
export const rowAccent = (u: Urgency, urgent: boolean) =>
  urgent
    ? "bg-gradient-to-r from-fuchsia-50 via-fuchsia-50/40 to-transparent shadow-[inset_4px_0_0_0_theme(colors.fuchsia.500)]"
    : u === "LATE"
      ? "shadow-[inset_3px_0_0_0_theme(colors.rose.400)]"
      : u === "WARNING"
        ? "shadow-[inset_3px_0_0_0_theme(colors.amber.300)]"
        : "";

/** "3 hari", atau "< 1 hari" bila masih di hari yang sama */
export const fmtDays = (n: number) => (n <= 0 ? "< 1 hari" : `${n} hari`);

/** Inisial untuk avatar, mis. "Kepala Seksi" → "KS" */
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();