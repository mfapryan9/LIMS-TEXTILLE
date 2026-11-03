import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle2, Gauge, ScanLine } from "lucide-react";
import { findSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Gauge, title: "Prioritas Critical Ratio", text: "Antrean otomatis berdasarkan CR hari ini per kelompok mesin." },
  { icon: ScanLine, title: "Scan Kartu SPK", text: "Foto SPK, kolom terisi otomatis, tinggal periksa dan simpan." },
  { icon: CheckCircle2, title: "Riwayat Uji & ACC", text: "Lihat uji ke berapa yang di-ACC dan durasinya di lab." },
];

/** Wordmark nama aplikasi: "DRAGON" putih/marun, "LIMS" emas. */
function Wordmark({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold uppercase tracking-[0.08em] ${className}`}>
      <span className={light ? "text-white" : "text-brand-700"}>Dragon</span>{" "}
      <span className={light ? "text-accent-200" : "text-accent-600"}>LIMS</span>
    </span>
  );
}

export default async function LoginPage() {
  if (await findSessionUser()) redirect("/");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel brand */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-12 py-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-300/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative flex items-center gap-3">
          <Image src="/logo-emblem-white.png" alt="" width={44} height={44} className="h-11 w-11" priority />
          <div className="leading-tight">
            <p className="text-sm font-semibold">PT. Nagasakti Kurnia Textile Mills</p>
            <p className="text-xs text-accent-200">Laboratorium Color Matching</p>
          </div>
        </div>

        <div className="relative my-auto max-w-lg py-10">
          <Image src="/logo-nagasakti-white.png" alt="PT. Nagasakti Kurnia Textile Mills" width={494} height={289} className="mb-8 h-auto w-56 opacity-95" priority />

          <h1 className="text-5xl leading-none"><Wordmark light /></h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand-100">Laboratory Information Management System</p>
          <div aria-hidden className="mt-6 h-1 w-14 rounded-full bg-accent" />

          <p className="mt-6 text-2xl font-bold leading-snug tracking-tight">
            Jadwal uji warna yang <span className="text-accent-200">tepat waktu</span>, setiap hari.
          </p>
          <ul className="mt-8 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-accent-200" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-brand-100/80">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/70">© {new Date().getFullYear()} Dragon LIMS · PT. Nagasakti Kurnia Textile Mills</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center bg-canvas px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Image src="/logo-nagasakti.png" alt="PT. Nagasakti Kurnia Textile Mills" width={494} height={289} className="h-auto w-44" priority />
          </div>

          <p className="text-2xl leading-none"><Wordmark /></p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Laboratory Information Management System</p>
          <div aria-hidden className="mt-4 h-1 w-10 rounded-full bg-accent" />

          <h2 className="mt-8 text-3xl font-bold tracking-tight text-ink">Selamat Datang</h2>
          <p className="mb-8 mt-2 text-sm text-ink-muted">Masuk dengan username dan password yang diberikan admin.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
