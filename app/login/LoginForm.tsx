"use client";

import { useState, useTransition } from "react";
import { login } from "./actions";

const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await login(email, password); // berhasil → redirect di server
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Email</span>
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Password</span>
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-indigo-800 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-900 disabled:opacity-50">
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
