"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { login } from "./actions";

const field =
  "w-full rounded-xl border border-line bg-white py-3 pl-11 pr-3 text-sm text-ink shadow-card placeholder:text-ink-soft transition focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await login(username, password); // berhasil → redirect di server
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ink">Username</span>
        <span className="relative block">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. operator.lab" className={field} />
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ink">Password</span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-11`} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:bg-canvas hover:text-ink">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Memproses…" : "Masuk"}
        {!pending && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />}
      </button>
    </form>
  );
}
