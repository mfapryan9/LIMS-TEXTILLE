/**
 * Rentang tanggal untuk hapus massal (Kepala PPIC). Tanggal dibaca sebagai tanggal pengajuan WIB,
 * sama seperti filter tanggal di Laporan kinerja: "dari" mulai pukul 00.00 WIB, "sampai" ikut seluruh harinya.
 */
const HOUR = 3_600_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function wibMidnight(date: string): number | null {
  const m = ISO.exec(date);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t - 7 * HOUR; // 00.00 WIB = 17.00 UTC hari sebelumnya
}

export type DateRange = { ok: true; gte: Date; lt: Date } | { ok: false; error: string };

export function createdAtRange(from: string, to: string): DateRange {
  const start = wibMidnight(String(from ?? ""));
  const end = wibMidnight(String(to ?? ""));
  if (start === null || end === null) return { ok: false, error: "Isi tanggal dari dan sampai dengan benar" };
  if (start > end) return { ok: false, error: "Tanggal dari tidak boleh setelah tanggal sampai" };
  return { ok: true, gte: new Date(start), lt: new Date(end + 24 * HOUR) };
}
