import { redirect } from "next/navigation";
import { findSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await findSessionUser()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-lg font-semibold text-slate-900">LIMS Lab Color Matching</p>
        <p className="mb-5 text-sm text-slate-500">PT Nagasakti · masuk untuk melanjutkan</p>
        <LoginForm />
      </div>
    </main>
  );
}
