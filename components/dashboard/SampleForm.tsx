"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { defaultDueDate } from "@/lib/cr";
import type { SampleFormResult, SampleInput } from "@/lib/sample-input";
import { parseSpkText, type SpkField } from "@/lib/spk-parse";

type Option = { id: string; name: string };

/* ───────── Pra-proses gambar & OCR (Tesseract, berjalan di browser) ───────── */

/** Skala ke ~1800px sisi terpanjang + grayscale + kontras: OCR lebih cepat & akurat untuk SPK cetak. */
async function prepareImage(src: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const source = src instanceof HTMLCanvasElement ? src : await createImageBitmap(src);
  const scale = Math.min(1, 1800 / Math.max(source.width, source.height)) || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const c = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
    d[i] = d[i + 1] = d[i + 2] = c;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function runOcr(canvas: HTMLCanvasElement, onProgress: (p: number, label: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ind+eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      const label = m.status.startsWith("recognizing") ? "Membaca teks" : "Menyiapkan pembaca (sekali di awal)";
      onProgress(m.progress, label);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/* ───────── Kamera langsung (laptop / HP) ───────── */

function LiveCamera({ onCapture, onCancel }: { onCapture: (c: HTMLCanvasElement) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau gunakan tombol unggah foto."));
    if (!navigator.mediaDevices) setError("Browser ini tidak mendukung kamera langsung. Gunakan tombol unggah foto.");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    onCapture(c);
  };

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-ink">
          <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full object-contain" />
        </div>
      )}
      <p className="text-xs text-ink-muted">Posisikan seluruh lembar SPK di dalam bingkai, tegak lurus, dengan cahaya cukup.</p>
      <div className="flex gap-2">
        {!error && <button type="button" onClick={capture} className={primaryBtn}>Ambil foto</button>}
        <button type="button" onClick={onCancel} className={ghostBtn}>Batal</button>
      </div>
    </div>
  );
}

/* ───────── Form ───────── */

const primaryBtn = "rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50";
const ghostBtn = "rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-ink ring-1 ring-line hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50";
const fieldCls = "w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

/** Label + penanda "dari foto" untuk kolom yang diisi OCR. Di luar SampleForm agar input tidak di-mount ulang tiap ketikan. */
function Field({ fromPhoto, label, children, hint }: { fromPhoto: boolean; label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-2 font-medium text-ink">
        {label}
        {fromPhoto && <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-800">dari foto</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function SampleForm(props: {
  mode: "create" | "edit";
  initial: SampleInput;
  processTypes: Option[];
  processMachine: Record<string, string>; // proses → mesin (kelompok sheet Excel)
  machines: Option[];
  onSubmit: (input: SampleInput) => Promise<SampleFormResult>;
  onClose: () => void;
}) {
  const { mode, processTypes, processMachine, machines, onSubmit, onClose } = props;
  const [values, setValues] = useState<SampleInput>(props.initial);
  const [dueTouched, setDueTouched] = useState(mode === "edit");
  const [found, setFound] = useState<Set<SpkField>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<{ state: "idle" | "running" | "done" | "error"; progress: number; label: string; text: string }>({ state: "idle", progress: 0, label: "", text: "" });

  // Esc menutup modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof SampleInput>(k: K, v: SampleInput[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "receivedDate" && !dueTouched && typeof v === "string" && v) next.dueDate = defaultDueDate(v);
      // Proses menentukan kelompok mesin (sheet Excel): isi mesin otomatis, tetap bisa diganti
      if (k === "processTypeId" && typeof v === "string" && processMachine[v]) next.machineId = processMachine[v];
      return next;
    });
    if (k === "dueDate") setDueTouched(true);
  };

  async function scan(src: Blob | HTMLCanvasElement) {
    setCamera(false);
    setError(null);
    setNotice(null);
    setOcr({ state: "running", progress: 0, label: "Menyiapkan gambar", text: "" });
    try {
      const canvas = await prepareImage(src);
      setPreview(canvas.toDataURL("image/jpeg", 0.8));
      const text = await runOcr(canvas, (progress, label) => setOcr((o) => ({ ...o, progress, label })));
      const { draft, found: f } = parseSpkText(text, { processTypes, machines });
      setValues((prev) => {
        const next = { ...prev };
        for (const k of f) (next as Record<string, string>)[k] = draft[k] as string;
        if (draft.receivedDate && !draft.dueDate) next.dueDate = defaultDueDate(draft.receivedDate);
        if (draft.processTypeId && !draft.machineId && processMachine[draft.processTypeId]) next.machineId = processMachine[draft.processTypeId];
        return next;
      });
      if (draft.dueDate) setDueTouched(true);
      setFound(new Set(f));
      setOcr({ state: "done", progress: 1, label: "", text });
      setNotice(f.length ? `${f.length} kolom terisi dari foto. Periksa kembali sebelum menyimpan.` : "Teks terbaca, tetapi tidak ada kolom yang dikenali. Isi form secara manual.");
    } catch (e) {
      console.error(e);
      setOcr({ state: "error", progress: 0, label: "", text: "" });
      setError("Foto gagal dibaca. Pastikan koneksi internet aktif (data bahasa OCR diunduh saat pertama kali) lalu coba lagi.");
    }
  }

  function submit(addAnother: boolean) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await onSubmit(values);
      if (!res.ok) return setError(res.error);
      if (!addAnother) return onClose();
      // SPK yang sama, warna berikutnya: pertahankan data SPK, kosongkan data warna
      setValues((v) => ({ ...v, colorCode: "", colorDirection: "" }));
      setFound((f) => new Set(Array.from(f).filter((k) => k !== "colorCode" && k !== "colorDirection")));
      setNotice(`Tersimpan: SPK ${values.spkNo}${values.colorCode ? ` · ${values.colorCode}` : ""}. Lanjutkan isi warna berikutnya.`);
    });
  }

  const ring = (k: SpkField | "problemDescription") => `${fieldCls} ${found.has(k as SpkField) ? "border-brand-300 bg-brand-50/50" : "border-line"}`;
  const text = (k: Exclude<keyof SampleInput, "orderType">, placeholder?: string) => (
    <input value={values[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} className={ring(k)} />
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode === "create" ? "Tambah SPK" : "Edit SPK"}>
      <div className="flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-xl sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">{mode === "create" ? "Tambah SPK" : `Edit SPK ${props.initial.spkNo}`}</h2>
            <p className="text-xs text-ink-muted">{mode === "create" ? "Foto lembar SPK untuk mengisi otomatis, lalu periksa dan edit hasilnya." : "Perbaiki data SPK. Perubahan dicatat di audit log."}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-sm text-ink-muted hover:bg-canvas" aria-label="Tutup">✕</button>
        </div>

        <div className="grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          {/* Panel foto SPK */}
          <section className="space-y-3">
            <p className="text-sm font-semibold text-ink">Foto SPK</p>
            {camera ? (
              <LiveCamera onCapture={scan} onCancel={() => setCamera(false)} />
            ) : (
              <>
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-canvas ring-1 ring-line">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Foto SPK" className="h-full w-full object-contain" />
                  ) : (
                    <p className="px-6 text-center text-xs text-ink-soft">Belum ada foto. Hasil baca akan mengisi kolom di samping dan tetap bisa diedit.</p>
                  )}
                </div>
                {ocr.state === "running" && (
                  <div aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round(ocr.progress * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{ocr.label}… {Math.round(ocr.progress * 100)}%</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={ocr.state === "running"} onClick={() => setCamera(true)} className={primaryBtn}>Buka kamera</button>
                  <label className={`${ghostBtn} cursor-pointer`}>
                    Unggah / foto dari HP
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocr.state === "running"}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) scan(f); }} />
                  </label>
                </div>
                {ocr.state === "done" && ocr.text && (
                  <details className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted ring-1 ring-line">
                    <summary className="cursor-pointer font-medium text-ink">Teks terbaca dari foto</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{ocr.text.trim()}</pre>
                  </details>
                )}
              </>
            )}
          </section>

          {/* Form isian (selalu bisa diedit) */}
          <section className="space-y-4">
            {notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-200" aria-live="polite">{notice}</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field fromPhoto={found.has("spkNo" as SpkField)} label="No. SPK">{text("spkNo", "mis. 2602108")}</Field>
              <Field fromPhoto={found.has("orderNo" as SpkField)} label="No. order (opsional)">{text("orderNo", "mis. 26-3012")}</Field>
              <Field fromPhoto={found.has("orderDate" as SpkField)} label="Tanggal order (opsional)">
                <input type="date" value={values.orderDate} onChange={(e) => set("orderDate", e.target.value)} className={ring("orderDate")} />
              </Field>
              <Field fromPhoto={found.has("orderType" as SpkField)} label="Jenis order">
                <select value={values.orderType} onChange={(e) => set("orderType", e.target.value as SampleInput["orderType"])} className={ring("orderType")}>
                  <option value="PRODUKSI">Produksi</option>
                  <option value="MARKETING">Marketing</option>
                </select>
              </Field>
              <Field fromPhoto={found.has("customerName" as SpkField)} label="Customer (opsional)">{text("customerName", "PT …")}</Field>
              <Field fromPhoto={found.has("motif" as SpkField)} label="Motif (opsional)">{text("motif")}</Field>
              <Field fromPhoto={found.has("colorCode" as SpkField)} label="Kode warna (opsional)">{text("colorCode", "CM-102")}</Field>
              <Field fromPhoto={found.has("colorDirection" as SpkField)} label="Arah warna (opsional)">{text("colorDirection", "mis. lebih biru")}</Field>
              <Field fromPhoto={found.has("processTypeId" as SpkField)} label="Proses lab">
                <select value={values.processTypeId} onChange={(e) => set("processTypeId", e.target.value)} className={ring("processTypeId")}>
                  <option value="">Pilih proses</option>
                  {processTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field fromPhoto={found.has("machineId" as SpkField)} label="Mesin">
                <select value={values.machineId} onChange={(e) => set("machineId", e.target.value)} className={ring("machineId")}>
                  <option value="">Pilih mesin</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field fromPhoto={found.has("receivedDate" as SpkField)} label="Tanggal terima">
                <input type="date" value={values.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} className={ring("receivedDate")} />
              </Field>
              <Field fromPhoto={found.has("dueDate" as SpkField)} label="Due date" hint={dueTouched ? undefined : "Otomatis tanggal terima + 7 hari"}>
                <input type="date" value={values.dueDate} min={values.receivedDate} onChange={(e) => set("dueDate", e.target.value)} className={ring("dueDate")} />
              </Field>
              <Field fromPhoto={found.has("fabricProblem" as SpkField)} label="Problem kain (opsional)">{text("fabricProblem", "mis. belang")}</Field>
              <Field fromPhoto={found.has("problemDescription" as SpkField)} label="Keterangan problem (opsional)">{text("problemDescription")}</Field>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3">
          <button type="button" onClick={onClose} className={ghostBtn}>Batal</button>
          {mode === "create" && (
            <button type="button" disabled={pending || ocr.state === "running"} onClick={() => submit(true)} className={ghostBtn}>
              Simpan &amp; tambah warna lain
            </button>
          )}
          <button type="button" disabled={pending || ocr.state === "running"} onClick={() => submit(false)} className={primaryBtn}>
            {pending ? "Menyimpan…" : mode === "create" ? "Simpan SPK" : "Simpan perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
