/**
 * Laporan kinerja lab untuk rentang tanggal pengajuan (tanggal WIB, inklusif).
 * Fungsi murni: dipakai dashboard laporan dan ekspor Excel.
 */

export interface ReportSource {
  createdAt: string; // ISO, waktu pengajuan
  dueDate: string; // YYYY-MM-DD
  status: string;
  isUrgent: boolean;
  machineName: string;
  processorName: string | null;
  processStartedAt: string | null; // ISO
  completedAt: string | null; // ISO (Sprint 3)
  approvedAt: string | null; // YYYY-MM-DD, data riwayat (ACC)
  labDays: number;
}

const HOUR = 3_600_000;

/**
 * Data lama (sebelum Sprint 3) diberi pemroses "Operator Lab" dan waktu mulai proses = saat migrasi,
 * sehingga tidak dipakai untuk rata-rata lama menunggu / lama proses.
 */
export const LEGACY_PROCESSOR = "Operator Lab";
const timed = (r: ReportSource) => !!r.processStartedAt && r.processorName !== LEGACY_PROCESSOR;

/** Tanggal kalender WIB (YYYY-MM-DD) dari sebuah instan. */
export const jakartaDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * HOUR).toISOString().slice(0, 10);

export interface GroupStat {
  name: string;
  total: number;
  done: number;
  onTime: number; // selesai ≤ due date
  avgProcessHours: number | null; // mulai proses → selesai
  avgLabDays: number | null; // pengajuan → selesai
}

export interface PerformanceReport {
  from: string;
  to: string;
  total: number;
  urgent: number;
  waiting: number;
  inProcess: number;
  done: number;
  onTime: number; // dari yang selesai
  late: number; // selesai melewati due date
  overdueOpen: number; // belum selesai & sudah lewat due date (per hari ini)
  avgWaitHours: number | null; // pengajuan → mulai diproses
  avgProcessHours: number | null; // mulai diproses → selesai
  avgLabDays: number | null; // pengajuan → selesai
  byProcessor: GroupStat[];
  byMachine: GroupStat[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / HOUR;

/** Tanggal selesai (WIB): completedAt (Sprint 3) atau tanggal ACC (data riwayat). */
export const finishedDate = (r: ReportSource) => (r.completedAt ? jakartaDate(r.completedAt) : r.approvedAt);

export function inRange<T extends Pick<ReportSource, "createdAt">>(rows: T[], from: string, to: string): T[] {
  return rows.filter((r) => {
    const d = jakartaDate(r.createdAt);
    return (!from || d >= from) && (!to || d <= to);
  });
}

function groupStats(rows: ReportSource[], key: (r: ReportSource) => string | null): GroupStat[] {
  const map = new Map<string, ReportSource[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return Array.from(map, ([name, list]) => {
    const done = list.filter((r) => r.status === "DISETUJUI");
    return {
      name,
      total: list.length,
      done: done.length,
      onTime: done.filter((r) => (finishedDate(r) ?? "9999") <= r.dueDate).length,
      avgProcessHours: mean(done.filter((r) => timed(r) && r.completedAt).map((r) => hoursBetween(r.processStartedAt!, r.completedAt!))),
      avgLabDays: mean(done.map((r) => r.labDays)),
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function buildReport(all: ReportSource[], from: string, to: string, today: string): PerformanceReport {
  const rows = inRange(all, from, to);
  const done = rows.filter((r) => r.status === "DISETUJUI");
  const onTime = done.filter((r) => (finishedDate(r) ?? "9999") <= r.dueDate).length;
  return {
    from,
    to,
    total: rows.length,
    urgent: rows.filter((r) => r.isUrgent).length,
    waiting: rows.filter((r) => r.status === "MENUNGGU").length,
    inProcess: rows.filter((r) => r.status === "DALAM_PROSES").length,
    done: done.length,
    onTime,
    late: done.length - onTime,
    overdueOpen: rows.filter((r) => r.status !== "DISETUJUI" && r.dueDate < today).length,
    avgWaitHours: mean(rows.filter(timed).map((r) => hoursBetween(r.createdAt, r.processStartedAt!))),
    avgProcessHours: mean(done.filter((r) => timed(r) && r.completedAt).map((r) => hoursBetween(r.processStartedAt!, r.completedAt!))),
    avgLabDays: mean(done.map((r) => r.labDays)),
    byProcessor: groupStats(rows, (r) => (r.processorName === LEGACY_PROCESSOR ? `${LEGACY_PROCESSOR} (data lama)` : r.processorName)),
    byMachine: groupStats(rows, (r) => r.machineName),
  };
}

/** "2 hari 3 jam", "5 jam", "< 1 jam". */
export function fmtHours(h: number | null): string {
  if (h === null) return "–";
  if (h < 1) return "< 1 jam";
  const t = Math.round(h);
  const d = Math.floor(t / 24);
  const rest = t % 24;
  if (!d) return `${rest} jam`;
  return rest ? `${d} hari ${rest} jam` : `${d} hari`;
}
