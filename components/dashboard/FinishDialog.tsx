"use client";

import { useState, useTransition } from "react";
import { Camera, CheckCircle2, ImageUp, Loader2, RotateCw } from "lucide-react";
import { ghostBtn, inputCls, Modal, primaryBtn } from "./PasswordDialog";
import type { SampleRow } from "./badges";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Foto hasil uji selalu disimpan LANDSCAPE: foto tegak (portrait) diputar 90°, lalu diperkecil (maks. 1600 px, JPEG)
 * agar unggah cepat dan hemat penyimpanan. flip = putar 180° tambahan bila hasilnya terbalik.
 */
async function toLandscape(bitmap: ImageBitmap, flip: boolean): Promise<Blob> {
  const portrait = bitmap.height > bitmap.width;
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = portrait ? h : w;
  canvas.height = portrait ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(((portrait ? 90 : 0) + (flip ? 180 : 0)) * (Math.PI / 180));
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses foto"))), "image/jpeg", 0.85));
}

/** Operator menandai pengajuan selesai: wajib melampirkan foto hasil uji lab (memuat resep yang sudah sesuai). */
export function FinishDialog({ row, onSubmit, onClose }: { row: SampleRow; onSubmit: (form: FormData) => Promise<Result>; onClose: () => void }) {
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [flip, setFlip] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function render(bitmap: ImageBitmap, flipped: boolean) {
    const blob = await toLandscape(bitmap, flipped);
    setPhoto(blob);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      setSource(bitmap);
      setFlip(false);
      await render(bitmap, false);
    } catch {
      setError("Foto tidak dapat dibaca. Coba foto lain (JPG/PNG).");
    } finally {
      setBusy(false);
    }
  }

  async function rotate180() {
    if (!source) return;
    setBusy(true);
    try {
      await render(source, !flip);
      setFlip(!flip);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (!photo) return setError("Foto hasil uji wajib dilampirkan");
    const form = new FormData();
    form.set("sampleId", row.id);
    form.set("note", note);
    form.set("photo", new File([photo], `hasil-${row.orderNo ?? row.spkNo}.jpg`, { type: "image/jpeg" }));
    start(async () => {
      const res = await onSubmit(form);
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  const label = `Order ${row.orderNo ?? row.spkNo}${row.colorCode ? ` · CM ${row.colorCode}` : ""}`;
  return (
    <Modal title="Selesaikan pengajuan" subtitle={`${label} · diproses oleh ${row.processorName ?? "-"}`} icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} onClose={onClose}>
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
        <div>
          <p className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-ink">
            <span>Foto hasil uji lab <span className="text-rose-600">*</span></span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">Mode landscape</span>
          </p>
          <div className={`flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl ${preview ? "bg-canvas ring-1 ring-line" : "border-2 border-dashed border-brand-200 bg-brand-50/40"}`}>
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Pratinjau foto hasil uji" className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-xs text-ink-soft">Foto lembar hasil uji yang memuat resep yang sudah sesuai. Pegang HP mendatar (landscape); foto tegak otomatis diputar menjadi landscape.</p>
            )}
          </div>
          {preview && (
            <button type="button" onClick={rotate180} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
              <RotateCw className="h-3.5 w-3.5" aria-hidden /> Putar 180° (bila foto terbalik)
            </button>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={`${primaryBtn} cursor-pointer`}>
              <Camera className="h-4 w-4" aria-hidden /> Kamera
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <label className={`${ghostBtn} cursor-pointer`}>
              <ImageUp className="h-4 w-4" aria-hidden /> Unggah foto
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Catatan / resep (opsional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="mis. Reaktif Red 1,2% + Yellow 0,4%, suhu 60°C" className={inputCls} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={ghostBtn}>Batal</button>
          <button type="button" onClick={submit} disabled={pending || busy || !photo} className={primaryBtn}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} Tandai selesai
          </button>
        </div>
      </div>
    </Modal>
  );
}
