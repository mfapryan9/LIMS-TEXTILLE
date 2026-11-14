"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Camera, Check, List, Loader2, Pencil, Plus, ScanLine, Sparkles, Upload, X, Zap } from "lucide-react";
import { defaultDueDate } from "@/lib/cr";
import type { SampleFormResult, SampleInput, SampleTextField } from "@/lib/sample-input";
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
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-ink shadow-soft">
          <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full object-contain" />
        </div>
      )}
      <p className="text-xs text-ink-muted">Posisikan seluruh lembar SPK di dalam bingkai, tegak lurus, dengan cahaya cukup.</p>
      <div className="flex gap-2">
        {!error && <button type="button" onClick={capture} className={primaryBtn}><Camera className="h-4 w-4" aria-hidden />Ambil foto</button>}
        <button type="button" onClick={onCancel} className={ghostBtn}>Batal</button>
      </div>
    </div>
  );
}

/* ───────── Form ───────── */

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:shadow-none";
const ghostBtn = "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50";
const fieldCls = "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft transition focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100";

/** Label + penanda "dari foto" untuk kolom yang diisi OCR. Di luar SampleForm agar input tidak di-mount ulang tiap ketikan. */
function Field({ fromPhoto, label, children, hint }: { fromPhoto: boolean; label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 flex items-center gap-2 font-medium text-ink">
        {label}
        {fromPhoto && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
            <Sparkles className="h-3 w-3" aria-hidden /> dari foto
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

/** Nilai opsi "+ Tambah baru…" di dropdown kelompok mesin / proses lab. */
const NEW = "__new__";

function BackToList({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Kembali pilih dari daftar"
      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
      <List className="h-3.5 w-3.5" aria-hidden /> Daftar
    </button>
  );
}

function FormSection({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-canvas/60 p-4 ring-1 ring-line">
      <legend className="sr-only">{title}</legend>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {desc && <p className="text-xs text-ink-soft">{desc}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
export function SampleForm(props: {
  mode: "create" | "edit";
  initial: SampleInput;
  processTypes: Option[];
  processMachine: Record<string, string>; // proses → mesin (kelompok sheet Excel)
  machines: (Option & { p?: number | null })[];
  canMarkUrgent: boolean;
  onSubmit: (input: SampleInput) => Promise<SampleFormResult>;
  onClose: () => void;
}) {
  const { mode, processTypes, processMachine, machines, canMarkUrgent, onSubmit, onClose } = props;
  const [values, setValues] = useState<SampleInput>(props.initial);
  // Mode isi baru: kelompok mesin / proses lab yang belum ada di daftar
  const [addMachine, setAddMachine] = useState(false);
  const [addProcess, setAddProcess] = useState(false);
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
      // Kelompok mesin (sheet Excel) ↔ proses: proses selalu milik kelompok yang dipilih
      if (k === "processTypeId" && typeof v === "string" && processMachine[v]) next.machineId = processMachine[v];
      if (k === "machineId" && prev.processTypeId && processMachine[prev.processTypeId] !== v) next.processTypeId = "";
      return next;
    });
    if (k === "dueDate") setDueTouched(true);
  };

  // Partai bisa lebih dari satu: daftar isian yang bisa ditambah / dihapus
  const setParty = (i: number, v: string) => setValues((prev) => ({ ...prev, parties: prev.parties.map((p, j) => (j === i ? v : p)) }));
  const addParty = () => setValues((prev) => ({ ...prev, parties: [...prev.parties, ""] }));
  const removeParty = (i: number) => setValues((prev) => ({ ...prev, parties: prev.parties.filter((_, j) => j !== i) }));

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
        for (const k of f) (next as unknown as Record<string, string>)[k] = draft[k] as string;
        if (draft.receivedDate && !draft.dueDate) next.dueDate = defaultDueDate(draft.receivedDate);
        if (draft.processTypeId && !draft.machineId && processMachine[draft.processTypeId]) next.machineId = processMachine[draft.processTypeId];
        return next;
      });
      if (draft.dueDate) setDueTouched(true);
      if (f.includes("machineId" as SpkField) || f.includes("processTypeId" as SpkField)) setAddMachine(false);
      if (f.includes("processTypeId" as SpkField)) setAddProcess(false);
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
      const res = await onSubmit({
        ...values,
        ...(addMachine ? { machineId: "", processTypeId: "" } : { newMachine: "", newMachineP: "" }),
        ...(addProcess || addMachine ? { processTypeId: "" } : { newProcess: "" }),
      });
      if (!res.ok) return setError(res.error);
      if (!addAnother) return onClose();
      // SPK yang sama, warna berikutnya: pertahankan data SPK, kosongkan data warna
      setValues((v) => ({ ...v, colorCode: "", colorName: "", colorDirection: "", parties: [""] }));
      setFound((f) => new Set(Array.from(f).filter((k) => !["colorCode", "colorName", "colorDirection", "parties"].includes(k))));
      setNotice(`Terkirim: order ${values.orderNo}${values.colorCode ? ` · ${values.colorCode}` : ""}. Lanjutkan isi No. CM berikutnya.`);
    });
  }

  const ring = (k: SpkField | SampleTextField) => `${fieldCls} ${found.has(k as SpkField) ? "border-brand-300 bg-brand-50/50" : "border-line"}`;
  const text = (k: SampleTextField, placeholder?: string) => (
    <input value={values[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} className={ring(k)} />
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode === "create" ? "Ajukan ke Lab" : "Edit pengajuan"}>
      <div className="flex max-h-[100dvh] w-full max-w-5xl animate-fade-up flex-col overflow-hidden bg-white shadow-soft sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              {mode === "create" ? <ScanLine className="h-5 w-5" aria-hidden /> : <Pencil className="h-5 w-5" aria-hidden />}
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{mode === "create" ? "Ajukan ke Lab" : `Edit pengajuan order ${props.initial.orderNo || props.initial.spkNo}`}</h2>
              <p className="text-xs text-ink-muted">{mode === "create" ? "Isi data pengajuan atau foto kartu SPK untuk mengisi otomatis, lalu periksa sebelum mengirim." : "Pengajuan hanya dapat diubah selama belum diproses lab. Perubahan dicatat di audit log."}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-soft transition hover:bg-canvas hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          {/* Panel foto SPK */}
          <section className="space-y-3">
            <p className="text-sm font-semibold text-ink">Foto kartu SPK</p>
            {camera ? (
              <LiveCamera onCapture={scan} onCancel={() => setCamera(false)} />
            ) : (
              <>
                <div className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl ${preview ? "bg-canvas ring-1 ring-line" : "border-2 border-dashed border-brand-200 bg-brand-50/40"}`}>
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Foto SPK" className="h-full w-full object-contain" />
                  ) : (
                    <div className="px-6 text-center">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card"><Camera className="h-7 w-7" aria-hidden /></span>
                      <p className="mt-3 text-sm font-semibold text-ink">Scan kartu SPK</p>
                      <p className="mt-1 text-xs text-ink-soft">Kolom di samping terisi otomatis dan tetap bisa diedit.</p>
                    </div>
                  )}
                  {ocr.state === "running" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm" aria-live="polite">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
                      <p className="text-sm font-semibold text-ink">{ocr.label}…</p>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(ocr.progress * 100)}%` }} />
                      </div>
                      <p className="text-xs tabular-nums text-ink-soft">{Math.round(ocr.progress * 100)}%</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={ocr.state === "running"} onClick={() => setCamera(true)} className={primaryBtn}>
                    <Camera className="h-4 w-4" aria-hidden /> Kamera
                  </button>
                  <label className={`${ghostBtn} cursor-pointer`}>
                    <Upload className="h-4 w-4" aria-hidden /> Unggah
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocr.state === "running"}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) scan(f); }} />
                  </label>
                </div>
                {ocr.state === "done" && ocr.text && (
                  <details className="rounded-xl bg-canvas px-3.5 py-2.5 text-xs text-ink-muted ring-1 ring-line">
                    <summary className="cursor-pointer font-semibold text-ink">Teks terbaca dari foto</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{ocr.text.trim()}</pre>
                  </details>
                )}
              </>
            )}
          </section>

          {/* Form isian (selalu bisa diedit) */}
          <section className="space-y-4">
            {notice && (
              <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800 ring-1 ring-brand-200" aria-live="polite">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {notice}
              </p>
            )}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

            <FormSection title="Data order" desc="Nama pengaju, Nomor Order, dan No. CM wajib diisi. Partai opsional dan bisa lebih dari satu.">
              <Field fromPhoto={found.has("requesterName" as SpkField)} label="Nama pengaju">{text("requesterName", "Nama yang mengajukan")}</Field>
              <Field fromPhoto={found.has("orderNo" as SpkField)} label="Nomor Order">{text("orderNo", "mis. 26-3012")}</Field>
              <Field fromPhoto={found.has("colorCode" as SpkField)} label="No. CM">{text("colorCode", "mis. CM-102")}</Field>
              <Field fromPhoto={found.has("colorName" as SpkField)} label="Warna">{text("colorName", "mis. Merah marun")}</Field>
              <Field fromPhoto={found.has("motif" as SpkField)} label="Motif (opsional)">{text("motif", "mis. polos / batik")}</Field>
              <div className="text-sm sm:col-span-2">
                <span className="mb-1.5 flex items-center gap-2 font-medium text-ink">
                  Partai (opsional)
                  <span className="text-xs font-normal text-ink-soft">{values.parties.filter((p) => p.trim()).length} terisi</span>
                  {found.has("parties" as SpkField) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
                      <Sparkles className="h-3 w-3" aria-hidden /> dari foto
                    </span>
                  )}
                </span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {values.parties.map((p, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <input value={p} onChange={(e) => setParty(i, e.target.value)} placeholder={`Partai ${i + 1}, mis. P-0${i + 1}`} aria-label={`Partai ${i + 1}`}
                        className={`${fieldCls} ${found.has("parties" as SpkField) ? "border-brand-300 bg-brand-50/50" : "border-line"}`} />
                      {values.parties.length > 1 && (
                        <button type="button" onClick={() => removeParty(i)} aria-label={`Hapus partai ${i + 1}`} className="shrink-0 rounded-lg p-2 text-ink-soft hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <button type="button" onClick={addParty} className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Tambah partai
                </button>
              </div>
            </FormSection>
            <FormSection title="Proses & jadwal" desc="Pilih dari daftar, atau pilih “+ Tambah baru” bila belum ada. Data baru otomatis masuk daftar pilihan.">
              <Field fromPhoto={found.has("machineId" as SpkField)} label="Kelompok mesin (sheet)">
                {addMachine ? (
                  <span className="block space-y-2">
                    <input autoFocus value={values.newMachine} onChange={(e) => set("newMachine", e.target.value)} placeholder="Nama kelompok mesin baru, mis. F. Rotary" className={`${fieldCls} border-brand-300`} />
                    <span className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-semibold text-ink-muted">p (hari)</span>
                      <input inputMode="decimal" value={values.newMachineP} onChange={(e) => set("newMachineP", e.target.value)} placeholder="p (hari), mis. 1.5" aria-label="p kelompok mesin baru (hari)" className={`${fieldCls} border-brand-300`} />
                      <BackToList onClick={() => { setAddMachine(false); setAddProcess(false); set("newMachine", ""); set("newMachineP", ""); }} />
                    </span>
                  </span>
                ) : (
                  <select value={values.machineId}
                    onChange={(e) => {
                      if (e.target.value === NEW) { setAddMachine(true); setAddProcess(true); set("machineId", ""); set("processTypeId", ""); }
                      else set("machineId", e.target.value);
                    }}
                    className={ring("machineId")}>
                    <option value="">Pilih kelompok mesin</option>
                    {machines.map((m) => <option key={m.id} value={m.id}>{m.name}{m.p ? ` (p ${+m.p.toFixed(2)} hr)` : ""}</option>)}
                    <option value={NEW}>+ Tambah kelompok mesin baru…</option>
                  </select>
                )}
              </Field>
              <Field fromPhoto={found.has("processTypeId" as SpkField)} label="Proses lab">
                {addProcess || addMachine ? (
                  <span className="flex items-center gap-2">
                    <input autoFocus={!addMachine} value={values.newProcess} onChange={(e) => set("newProcess", e.target.value)} placeholder="Nama proses lab baru, mis. PROOF PIGMENT" className={`${fieldCls} border-brand-300 uppercase placeholder:normal-case`} />
                    {!addMachine && <BackToList onClick={() => { setAddProcess(false); set("newProcess", ""); }} />}
                  </span>
                ) : (
                  <select value={values.processTypeId}
                    onChange={(e) => {
                      if (e.target.value === NEW) { setAddProcess(true); set("processTypeId", ""); }
                      else set("processTypeId", e.target.value);
                    }}
                    className={ring("processTypeId")}>
                    <option value="">{values.machineId ? "Pilih proses" : "Pilih proses (kelompok terisi otomatis)"}</option>
                    {/* Tanpa kelompok: semua proses dikelompokkan per sheet; dengan kelompok: hanya proses milik kelompok itu */}
                    {machines
                      .filter((m) => !values.machineId || m.id === values.machineId)
                      .map((m) => (
                        <optgroup key={m.id} label={m.name}>
                          {processTypes.filter((p) => processMachine[p.id] === m.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                      ))}
                    {values.machineId && <option value={NEW}>+ Tambah proses lab baru…</option>}
                  </select>
                )}
              </Field>
              {(addMachine || addProcess) && (
                <p className="text-xs text-ink-muted sm:col-span-2">
                  {addMachine
                    ? "Kelompok mesin & proses baru disimpan ke master data bersama p-nya, lalu muncul di daftar pilihan."
                    : "Proses baru disimpan ke kelompok mesin terpilih (p mengikuti kelompok) dan muncul di daftar pilihan."}
                </p>
              )}
              <Field fromPhoto={found.has("dueDate" as SpkField)} label="Due date" hint={dueTouched ? undefined : "Otomatis hari ini + 7 hari, dapat diubah"}>
                <input type="date" value={values.dueDate} min={values.receivedDate} onChange={(e) => set("dueDate", e.target.value)} className={ring("dueDate")} />
              </Field>
              {canMarkUrgent && (
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 transition sm:col-span-2 ${values.isUrgent ? "bg-fuchsia-50 ring-fuchsia-300" : "bg-white ring-line hover:bg-canvas"}`}>
                  <input type="checkbox" checked={values.isUrgent} onChange={(e) => set("isUrgent", e.target.checked)} className="peer sr-only" />
                  <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-fuchsia-200 ${values.isUrgent ? "bg-gradient-to-r from-fuchsia-600 to-pink-500" : "bg-line"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${values.isUrgent ? "left-[22px]" : "left-0.5"}`} />
                  </span>
                  <span className="text-sm">
                    <span className={`flex items-center gap-1 font-semibold ${values.isUrgent ? "text-fuchsia-700" : "text-ink"}`}><Zap className="h-4 w-4" aria-hidden /> Tandai URGENT</span>
                    <span className="block text-xs text-ink-muted">Langsung paling atas di antrean lab dan notifikasi dikirim ke Kepala PPIC & Kepala Produksi DF.</span>
                  </span>
                </label>
              )}
            </FormSection>

            <FormSection title="Deskripsi" desc="Keterangan tambahan untuk lab.">
              <Field fromPhoto={found.has("problemDescription" as SpkField)} label="Deskripsi order">
                <textarea value={values.problemDescription} onChange={(e) => set("problemDescription", e.target.value)} rows={3} maxLength={1000} placeholder="mis. kebutuhan buyer, jumlah kain, catatan khusus" className={ring("problemDescription")} />
              </Field>
              <Field fromPhoto={found.has("colorDirection" as SpkField)} label="Deskripsi warna">
                <textarea value={values.colorDirection} onChange={(e) => set("colorDirection", e.target.value)} rows={3} maxLength={200} placeholder="mis. lebih biru dari standar, tone hangat" className={ring("colorDirection")} />
              </Field>
            </FormSection>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-6 py-4">
          <button type="button" onClick={onClose} className={ghostBtn}>Batal</button>
          {mode === "create" && (
            <button type="button" disabled={pending || ocr.state === "running"} onClick={() => submit(true)} className={ghostBtn}>
              <Plus className="h-4 w-4" aria-hidden /> Kirim &amp; ajukan No. CM lain
            </button>
          )}
          <button type="button" disabled={pending || ocr.state === "running"} onClick={() => submit(false)} className={primaryBtn}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            {pending ? "Mengirim…" : mode === "create" ? "Kirim pengajuan" : "Simpan perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}