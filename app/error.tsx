"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md animate-fade-up rounded-3xl bg-white p-8 text-center shadow-soft ring-1 ring-line">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-bold text-ink">Terjadi kesalahan</p>
        <p className="mt-1 text-sm text-ink-muted">
          {error.message === "FORBIDDEN" ? "Anda tidak memiliki izin untuk aksi ini." : "Aksi gagal diproses. Muat ulang data lalu coba lagi."}
        </p>
        <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-700">
          <RefreshCw className="h-4 w-4" aria-hidden /> Muat ulang
        </button>
      </div>
    </main>
  );
}
