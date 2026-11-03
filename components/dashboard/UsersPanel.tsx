"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { KeyRound, Loader2, Pencil, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import type { NewUserInput, UpdateUserInput, UserFormResult } from "@/lib/user-input";
import { initials } from "./badges";
import { ghostBtn, inputCls, Modal, PasswordDialog, PasswordInput, primaryBtn } from "./PasswordDialog";

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  viewMode: "OPERATOR" | "APPROVER" | "PLANNER" | "MONITOR";
  canApprove: boolean;
  canEditSample: boolean;
  canManageUsers: boolean;
}

export interface UserRowData {
  id: string;
  username: string;
  name: string;
  roleId: string;
  isActive: boolean;
  createdAt: string; // ISO
}

export interface UserAdmin {
  users: UserRowData[];
  roles: RoleOption[];
  create: (input: NewUserInput) => Promise<UserFormResult>;
  update: (userId: string, input: UpdateUserInput) => Promise<UserFormResult>;
  resetPassword: (userId: string, newPassword: string) => Promise<UserFormResult>;
}

/** Ringkasan hak akses peran, sesuai aturan di lib/roles.ts. */
export function roleAccess(r: RoleOption): { label: string; tone: string; text: string } {
  if (r.viewMode === "OPERATOR" || r.canEditSample)
    return { label: "Operator", tone: "bg-sky-50 text-sky-800 ring-sky-200", text: "Input & edit SPK, urgent, tambah kelompok mesin/proses, jalankan uji" };
  if (r.canApprove)
    return {
      label: r.canManageUsers ? "Approver + kelola pengguna" : "Approver",
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      text: r.canManageUsers ? "ACC / reject hasil uji dan kelola akun pengguna" : "ACC / reject hasil uji",
    };
  return { label: "Monitor", tone: "bg-stone-100 text-stone-700 ring-stone-300", text: "Hanya pantau antrean & hasil uji" };
}

export function UsersPanel({ admin, meId }: { admin: UserAdmin; meId: string }) {
  const { users, roles } = admin;
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<null | { kind: "create" } | { kind: "edit"; user: UserRowData } | { kind: "reset"; user: UserRowData }>(null);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = [...users].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
    if (!s) return list;
    return list.filter((u) => [u.username, u.name, roleById.get(u.roleId)?.name].some((v) => v?.toLowerCase().includes(s)));
  }, [users, q, roleById]);
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <section className="space-y-5" aria-label="Kelola pengguna">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Users className="h-5 w-5 text-brand-400" aria-hidden /> Daftar akun
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-line">{activeCount} aktif · {users.length} total</span>
        </h2>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <span className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, username, peran" aria-label="Cari pengguna" className={`${inputCls} pl-10`} />
          </span>
          <button type="button" onClick={() => setDialog({ kind: "create" })} className={primaryBtn}><UserPlus className="h-4 w-4" aria-hidden /> Tambah pengguna</button>
        </div>
      </div>

      <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Daftar akun pengguna DyeLIMS</caption>
          <thead className="border-b border-line bg-surface/60 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3">Pengguna</th>
              <th scope="col" className="px-4 py-3">Peran</th>
              <th scope="col" className="px-4 py-3">Hak akses</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((u) => {
              const role = roleById.get(u.roleId);
              const access = role ? roleAccess(role) : null;
              const me = u.id === meId;
              return (
                <tr key={u.id} className={`transition-colors hover:bg-canvas/60 ${u.isActive ? "" : "opacity-60"}`}>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-3">
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">{initials(u.name)}</span>
                      <span className="leading-tight">
                        <span className="block font-semibold text-ink">{u.name}{me && <span className="ml-1.5 rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">Anda</span>}</span>
                        <span className="block font-mono text-xs text-ink-muted">{u.username}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-ink">{role?.name ?? "–"}</td>
                  <td className="px-4 py-3.5">
                    {access && (
                      <>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${access.tone}`}>
                          {role?.canManageUsers && <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}{access.label}
                        </span>
                        <p className="mt-1 text-xs text-ink-soft">{access.text}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-stone-400"}`} />
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setDialog({ kind: "edit", user: u })} className={`${ghostBtn} whitespace-nowrap px-3 py-1.5 text-xs`} aria-label={`Edit ${u.name}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                      </button>
                      {!me && (
                        <button type="button" onClick={() => setDialog({ kind: "reset", user: u })} className={`${ghostBtn} whitespace-nowrap px-3 py-1.5 text-xs`} aria-label={`Reset password ${u.name}`}>
                          <KeyRound className="h-3.5 w-3.5" aria-hidden /> Reset password
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="px-6 py-10 text-center text-sm text-ink-soft">Tidak ada akun yang cocok.</p>}
      </div>

      {dialog?.kind === "create" && <UserDialog roles={roles} onClose={() => setDialog(null)} onSubmit={(v) => admin.create(v as NewUserInput)} />}
      {dialog?.kind === "edit" && (
        <UserDialog roles={roles} user={dialog.user} isMe={dialog.user.id === meId} onClose={() => setDialog(null)}
          onSubmit={(v) => admin.update(dialog.user.id, v as UpdateUserInput)} />
      )}
      {dialog?.kind === "reset" && (
        <PasswordDialog mode="reset" targetName={dialog.user.name} onClose={() => setDialog(null)} onSubmit={(pw) => admin.resetPassword(dialog.user.id, pw)} />
      )}
    </section>
  );
}

/** Tambah akun baru, atau edit nama / peran / status akun. */
function UserDialog({ roles, user, isMe = false, onSubmit, onClose }: {
  roles: RoleOption[];
  user?: UserRowData;
  isMe?: boolean;
  onSubmit: (v: NewUserInput | UpdateUserInput) => Promise<UserFormResult>;
  onClose: () => void;
}) {
  const edit = !!user;
  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [roleId, setRoleId] = useState(user?.roleId ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const role = roles.find((r) => r.id === roleId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!edit && pw !== pw2) return setError("Konfirmasi password tidak sama");
    start(async () => {
      const res = await onSubmit(edit ? { name, roleId, isActive } : { username, name, roleId, password: pw });
      if (!res.ok) return setError(res.error);
      onClose();
    });
  };

  return (
    <Modal title={edit ? `Edit ${user.name}` : "Tambah Pengguna"} subtitle={edit ? `Username ${user.username}` : "Akun baru langsung bisa dipakai login"}
      icon={edit ? <Pencil className="h-5 w-5" aria-hidden /> : <UserPlus className="h-5 w-5" aria-hidden />} onClose={onClose}>
      <form onSubmit={submit} className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
        {!edit && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink">Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} autoFocus autoComplete="off" placeholder="mis. operator.lab2" className={`${inputCls} font-mono`} />
            <span className="mt-1 block text-xs text-ink-soft">Huruf kecil, angka, titik, garis bawah, atau strip. Tidak bisa diubah setelah dibuat.</span>
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Nama lengkap / jabatan</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={edit} placeholder="mis. Budi Santoso" className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink">Peran</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={isMe} className={`${inputCls} disabled:opacity-60`}>
            <option value="">Pilih peran</option>
            {(["OPERATOR", "APPROVER", "MONITOR", "PLANNER"] as const).map((vm) => {
              const list = roles.filter((r) => r.viewMode === vm);
              if (!list.length) return null;
              const label = { OPERATOR: "Operator (input SPK & uji)", APPROVER: "Approver (ACC / reject)", MONITOR: "Monitor (hanya pantau)", PLANNER: "Planner" }[vm];
              return <optgroup key={vm} label={label}>{list.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>;
            })}
          </select>
          {role && <span className="mt-1 block text-xs text-ink-soft">Hak akses: {roleAccess(role).text}.</span>}
          {isMe && <span className="mt-1 block text-xs text-amber-700">Peran akun sendiri tidak bisa diubah.</span>}
        </label>
        {edit ? (
          <label className={`flex items-center gap-3 rounded-xl p-3 ring-1 ring-line ${isMe ? "opacity-60" : "cursor-pointer hover:bg-canvas"}`}>
            <input type="checkbox" checked={isActive} disabled={isMe} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            <span className="text-sm">
              <span className="block font-semibold text-ink">Akun aktif</span>
              <span className="block text-xs text-ink-muted">Akun nonaktif tidak bisa login; riwayat uji & ACC-nya tetap tersimpan.</span>
            </span>
          </label>
        ) : (
          <>
            <PasswordInput label="Password awal" value={pw} onChange={setPw} autoComplete="new-password" />
            <PasswordInput label="Ulangi password" value={pw2} onChange={setPw2} autoComplete="new-password" />
            <p className="text-xs text-ink-soft">Minimal 8 karakter. Pengguna bisa menggantinya sendiri lewat menu Ganti Password.</p>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Batal</button>
          <button type="submit" disabled={pending || !name.trim() || !roleId || (!edit && (!username || !pw || !pw2))} className={primaryBtn}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {edit ? "Simpan perubahan" : "Buat akun"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
