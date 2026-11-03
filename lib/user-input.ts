/** Validasi data akun pengguna (dipakai ulang di server; jangan percaya input client). */

export const PASSWORD_MIN = 8;

export type UserFormResult = { ok: true } | { ok: false; error: string };

export interface NewUserInput {
  username: string;
  name: string;
  roleId: string;
  password: string;
}

export interface UpdateUserInput {
  name: string;
  roleId: string;
  isActive: boolean;
}

/** Username: huruf kecil, angka, titik, garis bawah, strip; 3–30 karakter (mis. operator.lab2). */
export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function checkUsername(username: string): string | null {
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return "Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau strip (tanpa spasi)";
  if (!/^[a-z0-9]/.test(username)) return "Username harus diawali huruf atau angka";
  return null;
}

export function checkName(name: string): string | null {
  if (name.length < 2) return "Nama minimal 2 karakter";
  if (name.length > 80) return "Nama maksimal 80 karakter";
  return null;
}

export function checkPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter`;
  if (password.length > 72) return "Password maksimal 72 karakter"; // batas bcrypt
  if (password.trim() !== password) return "Password tidak boleh diawali / diakhiri spasi";
  return null;
}

const cleanName = (raw: unknown) => (typeof raw === "string" ? raw.trim().replace(/\s{2,}/g, " ") : "");

export function validateNewUser(raw: NewUserInput): { error: string } | { data: NewUserInput } {
  const data = { username: normalizeUsername(raw.username), name: cleanName(raw.name), roleId: typeof raw.roleId === "string" ? raw.roleId : "", password: raw.password };
  const err = checkUsername(data.username) ?? checkName(data.name) ?? (data.roleId ? null : "Peran wajib dipilih") ?? checkPassword(data.password);
  return err ? { error: err } : { data };
}

export function validateUpdateUser(raw: UpdateUserInput): { error: string } | { data: UpdateUserInput } {
  const data = { name: cleanName(raw.name), roleId: typeof raw.roleId === "string" ? raw.roleId : "", isActive: raw.isActive === true };
  const err = checkName(data.name) ?? (data.roleId ? null : "Peran wajib dipilih");
  return err ? { error: err } : { data };
}
