/**
 * Critical Ratio (CR) = (D - t) / p
 *   D - t : sisa HARI KALENDER antara tanggal hari ini (t) dan deadline (D)
 *   p     : waktu proses standar (hari) dari MasterProcessTimes [Proses + Mesin]
 *
 * Aturan penting:
 * - Hari dihitung berdasarkan tanggal kalender zona Asia/Jakarta (WIB), bukan selisih jam,
 *   sehingga hasil tidak bergeser saat server Vercel berjalan di UTC.
 * - Kolom dueDate bertipe @db.Date → Prisma mengembalikan 00:00 UTC pada tanggal itu,
 *   maka komponen tanggalnya dibaca dengan getUTC*.
 */

export const LAB_TZ = "Asia/Jakarta";
const MS_PER_DAY = 86_400_000;

export type SampleStatusKey =
  | "MENUNGGU"
  | "DALAM_PROSES"
  | "MENUNGGU_APPROVAL"
  | "DISETUJUI"
  | "MATCHING_ULANG";

/** Status yang masih membutuhkan penjadwalan. DISETUJUI keluar dari antrean. */
export const ACTIVE_STATUSES: SampleStatusKey[] = [
  "MENUNGGU",
  "DALAM_PROSES",
  "MENUNGGU_APPROVAL",
  "MATCHING_ULANG",
];

export type Urgency = "LATE" | "WARNING" | "NORMAL" | "NONE";

export interface CrResult {
  /** CR dibulatkan 2 desimal; null bila tidak bisa dihitung (p tidak ada / sampel selesai) */
  cr: number | null;
  /** Sisa hari (D - t). Negatif = lewat due date */
  daysLeft: number;
  urgency: Urgency;
  /** Alasan bila cr = null */
  reason?: "NO_STANDARD_TIME" | "COMPLETED";
}

/** Nomor hari (hari sejak epoch) dari tanggal kalender Jakarta untuk instan waktu tertentu. */
export function jakartaDayNumber(instant: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / MS_PER_DAY;
}

/** Nomor hari dari nilai kolom @db.Date (atau string "YYYY-MM-DD"). */
export function dateOnlyDayNumber(value: Date | string): number {
  if (typeof value === "string") {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / MS_PER_DAY;
  }
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / MS_PER_DAY;
}

/** Sisa hari (D - t). Negatif jika sudah lewat. */
export function daysUntil(dueDate: Date | string, now: Date = new Date()): number {
  return dateOnlyDayNumber(dueDate) - jakartaDayNumber(now);
}

/** Terima number | string | Prisma.Decimal (punya toNumber / toString). */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

export function classifyUrgency(cr: number): Exclude<Urgency, "NONE"> {
  if (cr < 0) return "LATE";
  if (cr <= 1) return "WARNING";
  return "NORMAL";
}

export function calculateCR(input: {
  dueDate: Date | string;
  standardDays: unknown | null | undefined;
  status?: SampleStatusKey;
  now?: Date;
}): CrResult {
  const daysLeft = daysUntil(input.dueDate, input.now);

  if (input.status === "DISETUJUI") {
    return { cr: null, daysLeft, urgency: "NONE", reason: "COMPLETED" };
  }

  const p = input.standardDays == null ? NaN : toNumber(input.standardDays);
  if (!Number.isFinite(p) || p <= 0) {
    // Tanpa p yang valid CR tidak bisa dihitung. Bila sudah lewat due date tetap ditandai LATE.
    return {
      cr: null,
      daysLeft,
      urgency: daysLeft < 0 ? "LATE" : "NONE",
      reason: "NO_STANDARD_TIME",
    };
  }

  // Hindari floating-point noise (mis. 0.30000000000000004)
  const cr = Math.round((daysLeft / p) * 100) / 100;
  return { cr, daysLeft, urgency: classifyUrgency(cr) };
}

// ───────────── Pengayaan & pengurutan antrean ─────────────

export interface SchedulableSample {
  id: string;
  status: SampleStatusKey;
  isUrgent: boolean;
  dueDate: Date | string;
  createdAt: Date | string;
  processTypeId: string;
  machineId: string;
}

export type StandardTimeMap = Map<string, number>; // key: `${processTypeId}:${machineId}`

export const standardTimeKey = (processTypeId: string, machineId: string) =>
  `${processTypeId}:${machineId}`;

export function buildStandardTimeMap(
  rows: { processTypeId: string; machineId: string; standardDays: unknown }[],
): StandardTimeMap {
  return new Map(rows.map((r) => [standardTimeKey(r.processTypeId, r.machineId), toNumber(r.standardDays)]));
}

export type WithCR<T> = T & CrResult & { standardDays: number | null };

export function withCR<T extends SchedulableSample>(
  samples: T[],
  times: StandardTimeMap,
  now: Date = new Date(),
): WithCR<T>[] {
  return samples.map((s) => {
    const p = times.get(standardTimeKey(s.processTypeId, s.machineId)) ?? null;
    return { ...s, standardDays: p, ...calculateCR({ dueDate: s.dueDate, standardDays: p, status: s.status, now }) };
  });
}

/**
 * Urutan antrean (4 kelompok):
 *   0. Sampel aktif yang ditandai URGENT (selalu paling atas)
 *   1. Sampel aktif dengan CR (CR terkecil di atas; CR negatif = terlambat paling atas)
 *   2. Sampel aktif tanpa CR (p belum diatur), diurutkan berdasarkan due date
 *   3. Sampel DISETUJUI
 * Di dalam setiap kelompok: CR terkecil → due date terdekat → dibuat paling awal.
 */
export function sortByPriority<T extends WithCR<SchedulableSample>>(rows: T[]): T[] {
  const rank = (r: T) => (r.status === "DISETUJUI" ? 3 : r.isUrgent ? 0 : r.cr === null ? 2 : 1);
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (a.cr !== null && b.cr !== null && a.cr !== b.cr) return a.cr - b.cr;
    const dd = dateOnlyDayNumber(a.dueDate) - dateOnlyDayNumber(b.dueDate);
    if (dd !== 0) return dd;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/** Deadline default = tanggal terima + 7 hari (bisa diubah user). Mengembalikan "YYYY-MM-DD". */
export function defaultDueDate(receivedDate: Date | string, addDays = 7): string {
  const base = dateOnlyDayNumber(receivedDate) + addDays;
  return new Date(base * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Tanggal hari ini (Jakarta) sebagai "YYYY-MM-DD" – untuk default field Tanggal Terima. */
export function todayJakarta(now: Date = new Date()): string {
  return new Date(jakartaDayNumber(now) * MS_PER_DAY).toISOString().slice(0, 10);
}
