"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="font-semibold text-slate-900">Terjadi kesalahan</p>
        <p className="mt-1 text-sm text-slate-600">
          {error.message === "FORBIDDEN" ? "Anda tidak memiliki izin untuk aksi ini." : "Aksi gagal diproses. Muat ulang data lalu coba lagi."}
        </p>
        <button type="button" onClick={reset} className="mt-4 rounded-md bg-indigo-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-900">
          Muat ulang
        </button>
      </div>
    </main>
  );
}
