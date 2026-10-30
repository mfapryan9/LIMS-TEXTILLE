import Image from "next/image";
import { redirect } from "next/navigation";
import { findSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await findSessionUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line md:grid-cols-2">
        <section className="flex flex-col items-center justify-center gap-6 border-b border-line bg-brand-50/60 px-8 py-10 md:border-b-0 md:border-r">
          <Image
            src="/logo-nagasakti.png"
            alt="PT. Nagasakti Kurnia Textile Mills"
            width={494}
            height={289}
            priority
            className="h-auto w-full max-w-[18rem]"
          />
          <div className="text-center">
            <p className="text-sm font-semibold tracking-wide text-brand-800">LIMS Lab Color Matching</p>
            <p className="mt-1 text-xs text-ink-muted">Penjadwalan pengujian sampel warna berbasis Critical Ratio</p>
          </div>
        </section>

        <section className="px-8 py-10">
          <h1 className="text-xl font-semibold text-ink">Masuk</h1>
          <p className="mb-6 mt-1 text-sm text-ink-muted">Gunakan username dan password yang diberikan admin.</p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
