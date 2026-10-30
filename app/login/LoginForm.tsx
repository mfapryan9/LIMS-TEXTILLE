"use client";

import { useState, useTransition } from "react";
import { login } from "./actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
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
        <input type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. operator.lab" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ink">Password</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60">
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
