"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { todayJakarta } from "@/lib/cr";
import { ghostBtn, inputCls, Modal } from "./PasswordDialog";

export type BulkPreview = { ok: true; total: number; waiting: number; inProcess: number; done: number; photos: number } | { ok: false; error: string };
export type BulkResult = { ok: true; deleted: number } | { ok: false; error: string };

export interface BulkDeleteActions {
  preview: (from: string, to: string) => Promise<BulkPreview>;
  run: (from: string, to: string, reason: string, expected: number) => Promise<BulkResult>;
}

const dangerBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50";

/** Kepala PPIC: hapus banyak pengajuan sekaligus berdasarkan rentang tanggal pengajuan. */
export function BulkDeleteDialog({ actions, onClose }: { actions: BulkDeleteActions; onClose: () => void }) {
  const today = todayJakarta();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Extract<BulkPreview, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const changeDate = (set: (v: string) => void) => (v: string) => { set(v); setPreview(null); setError(null); };

  const check = () =>
    start(async () => {
      setError(null);
      const res = await actions.preview(from, to);
      if (!res.ok) { setPreview(null); return setError(res.error); }
      setPreview(res);
    });

  const remove = () =>
    start(async () => {
      if (!preview) return;
      setError(null);
      const res = await actions.run(from, to, reason, preview.total);
      if (!res.ok) { setPreview(null); return setError(res.error); }
      setDone(res.deleted);
    });

  return (
    <Modal title="Hapus data pengajuan" subtitle="Berdasarkan rentang tanggal pengajuan (WIB)" icon={<Trash2 className="h-5 w-5" aria-hidden />} onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        {done !== null ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">
            {done} pengajuan berhasil dihapus. Salinan datanya tersimpan di audit log.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-sm font-semibold text-ink">
                <span>Dari tanggal</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => changeDate(setFrom)(e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-ink">
                <span>Sampai tanggal</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => changeDate(setTo)(e.target.value)} className={inputCls} />
              </label>
            </div>

            {!preview ? (
              <button type="button" onClick={check} disabled={pending || !from || !to} className={`${ghostBtn} w-full`}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />} Cek jumlah data
              </button>
            ) : preview.total === 0 ? (
              <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-muted ring-1 ring-line" role="status">Tidak ada pengajuan pada rentang tanggal ini.</p>
            ) : (
              <>
                <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200" role="status">
                  <p className="font-bold">{preview.total} pengajuan akan dihapus permanen</p>
                  <p className="mt-1 text-xs">
                    {preview.waiting} pengajuan masuk · {preview.inProcess} sedang diproses · {preview.done} selesai
                    {preview.photos > 0 && ` · ${preview.photos} foto hasil uji`}. Data uji dan foto ikut terhapus.
                  </p>
                  <p className="mt-1 text-xs">Sarankan unduh Excel terlebih dahulu bila data masih diperlukan.</p>
                </div>
                <label className="block space-y-1.5 text-sm font-semibold text-ink">
                  <span>Alasan penghapusan</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="mis. data uji coba sebelum go-live" className={inputCls} />
                </label>
                <button type="button" onClick={remove} disabled={pending || !reason.trim()} className={`${dangerBtn} w-full`}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />} Hapus {preview.total} pengajuan
                </button>
              </>
            )}
          </>
        )}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button type="button" onClick={onClose} className={`${ghostBtn} w-full`}>{done !== null ? "Tutup" : "Batal"}</button>
      </div>
    </Modal>
  );
}
