"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadXlsx, type SheetSpec } from "@/lib/export-xlsx";
import { STATUS_LABEL, type SampleRow } from "./badges";
import { fmtDate, fmtStamp } from "./SampleTable";

const COLUMNS: { header: string; width?: number; get: (r: SampleRow) => string | number | null }[] = [
  { header: "Nomor Order", width: 14, get: (r) => r.orderNo ?? r.spkNo },
  { header: "No. SPK", width: 12, get: (r) => r.spkNo },
  { header: "Customer", width: 22, get: (r) => r.customerName },
  { header: "No. CM", width: 12, get: (r) => r.colorCode },
  { header: "Warna", width: 16, get: (r) => r.colorName },
  { header: "Motif", width: 14, get: (r) => r.motif },
  { header: "Partai", width: 16, get: (r) => r.parties.join(", ") || null },
  { header: "Kelompok mesin", width: 16, get: (r) => r.machineName },
  { header: "Proses lab", width: 20, get: (r) => r.processName },
  { header: "Nama pengaju", width: 18, get: (r) => r.requesterName },
  { header: "Waktu pengajuan", width: 20, get: (r) => fmtStamp(r.createdAt) },
  { header: "Due date", width: 13, get: (r) => fmtDate(r.dueDate) },
  { header: "Urgent", width: 8, get: (r) => (r.isUrgent ? "Ya" : null) },
  { header: "Status", width: 16, get: (r) => STATUS_LABEL[r.status] },
  { header: "CR", width: 7, get: (r) => (r.status === "DISETUJUI" ? null : r.cr) },
  { header: "Pemroses", width: 26, get: (r) => r.processorName },
  { header: "Mulai diproses", width: 20, get: (r) => (r.processStartedAt ? fmtStamp(r.processStartedAt) : null) },
  { header: "Selesai", width: 20, get: (r) => (r.completedAt ? fmtStamp(r.completedAt) : r.approvedAt ? fmtDate(r.approvedAt) : null) },
  { header: "Lama di lab (hari)", width: 12, get: (r) => r.labDays },
  { header: "Resep / catatan hasil", width: 28, get: (r) => r.resultNote ?? r.approvedNotes },
  { header: "Deskripsi order", width: 30, get: (r) => r.problemDescription },
  { header: "Deskripsi warna", width: 26, get: (r) => r.colorDirection },
];

/** Sheet daftar pengajuan (dipakai di antrean, hasil uji, dan laporan kinerja). */
export function rowsSheet(name: string, rows: SampleRow[], title?: string): SheetSpec {
  return {
    name,
    title,
    columns: [{ header: "No", width: 5 }, ...COLUMNS.map(({ header, width }) => ({ header, width }))],
    rows: rows.map((r, i) => [i + 1, ...COLUMNS.map((c) => c.get(r) ?? null)]),
  };
}

/** Nama file dengan tanggal hari ini (WIB), mis. DyeLIMS-pengajuan-2026-11-16.xlsx */
export const fileStamp = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export function ExportButton({ label = "Unduh Excel", build }: { label?: string; build: () => { filename: string; sheets: SheetSpec[] } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const { filename, sheets } = build();
            await downloadXlsx(filename, sheets);
          } catch (e) {
            console.error(e);
            setError("Gagal membuat file Excel");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-emerald-700 shadow-card ring-1 ring-emerald-200 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}
        {busy ? "Menyiapkan…" : label}
      </button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
