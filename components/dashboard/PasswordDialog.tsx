"use client";

import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { PASSWORD_MIN, type UserFormResult } from "@/lib/user-input";

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft transition focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100";
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:shadow-none";
export const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50";

/** Kerangka modal kecil (tutup dengan Esc / tombol X / klik latar). */
export function Modal({ title, subtitle, icon, onClose, children }: { title: string; subtitle?: string; icon: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md animate-fade-up overflow-hidden bg-white shadow-soft sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
            <div>
              <h2 className="font-bold text-ink">{title}</h2>
              {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-xl p-2 text-ink-soft hover:bg-canvas hover:text-ink"><X className="h-5 w-5" aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PasswordInput({ label, value, onChange, autoComplete, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink">{label}</span>
      <span className="relative block">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} className={`${inputCls} pr-11`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:bg-canvas hover:text-ink">
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </span>
    </label>
  );
}

/**
 * Ganti password sendiri (mode "own": wajib password lama) atau reset password akun lain oleh Kepala Lab (mode "reset").
 */
export function PasswordDialog(props:
  | { mode: "own"; onSubmit: (oldPw: string, newPw: string) => Promise<UserFormResult>; onClose: () => void }
  | { mode: "reset"; targetName: string; onSubmit: (newPw: string) => Promise<UserFormResult>; onClose: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < PASSWORD_MIN) return setError(`Password baru minimal ${PASSWORD_MIN} karakter`);
    if (pw !== pw2) return setError("Konfirmasi password tidak sama");
    start(async () => {
      const res = props.mode === "own" ? await props.onSubmit(oldPw, pw) : await props.onSubmit(pw);
      if (!res.ok) return setError(res.error);
      setDone(true);
    });
  };

  return (
    <Modal
      title={props.mode === "own" ? "Ganti Password" : "Reset Password"}
      subtitle={props.mode === "own" ? "Untuk akun Anda sendiri" : `Akun ${props.targetName}`}
      icon={<KeyRound className="h-5 w-5" aria-hidden />}
      onClose={props.onClose}
    >
      {done ? (
        <div className="space-y-4 p-6">
          <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">
            {props.mode === "own"
              ? "Password berhasil diganti. Gunakan password baru saat login berikutnya. Perangkat lain yang masih login akan otomatis keluar."
              : `Password ${props.targetName} berhasil di-reset dan akun itu otomatis keluar dari semua perangkat. Sampaikan password baru kepada yang bersangkutan.`}
          </p>
          <div className="flex justify-end"><button type="button" onClick={props.onClose} className={primaryBtn}>Selesai</button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 p-6">
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
          {props.mode === "own" && <PasswordInput label="Password lama" value={oldPw} onChange={setOldPw} autoComplete="current-password" autoFocus />}
          <PasswordInput label="Password baru" value={pw} onChange={setPw} autoComplete="new-password" autoFocus={props.mode === "reset"} />
          <PasswordInput label="Ulangi password baru" value={pw2} onChange={setPw2} autoComplete="new-password" />
          <p className="text-xs text-ink-soft">Minimal {PASSWORD_MIN} karakter. Sebaiknya gabungan huruf dan angka.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={props.onClose} className={ghostBtn}>Batal</button>
            <button type="submit" disabled={pending || (props.mode === "own" && !oldPw) || !pw || !pw2} className={primaryBtn}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Simpan password
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
