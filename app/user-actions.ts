"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createSession, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCan } from "@/lib/roles";
import { checkPassword, validateNewUser, validateUpdateUser, type NewUserInput, type UpdateUserInput, type UserFormResult } from "@/lib/user-input";

/**
 * Kelola akun (Kepala Laboratorium) + ganti password sendiri (semua akun).
 * Password tidak pernah ditulis ke audit log. Ganti / reset password membatalkan sesi lama akun itu.
 */

const hash = (pw: string) => bcrypt.hash(pw, 10);

function audit(userId: string, action: string, entityId: string, before?: unknown, after?: unknown) {
  return prisma.auditLog.create({
    data: {
      userId, action, entity: "User", entityId,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
    },
  });
}

/** Ganti password akun sendiri: wajib password lama. Sesi di perangkat lain otomatis keluar. */
export async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<UserFormResult> {
  const me = await getSessionUser();
  const u = await prisma.user.findUnique({ where: { id: me.id } });
  if (!u || !(await bcrypt.compare(String(oldPassword ?? ""), u.passwordHash))) return { ok: false, error: "Password lama salah" };
  const err = checkPassword(newPassword);
  if (err) return { ok: false, error: err };
  if (oldPassword === newPassword) return { ok: false, error: "Password baru harus berbeda dari password lama" };

  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hash(newPassword), passwordChangedAt: new Date() } });
  await audit(me.id, "PASSWORD_CHANGED", me.id);
  createSession(me.id); // sesi baru untuk perangkat ini; sesi lama tidak berlaku
  return { ok: true };
}

export async function createUser(input: NewUserInput): Promise<UserFormResult> {
  const me = await getSessionUser();
  assertCan(me, "manageUsers");
  const v = validateNewUser(input);
  if ("error" in v) return { ok: false, error: v.error };
  if (!(await prisma.role.findUnique({ where: { id: v.data.roleId } }))) return { ok: false, error: "Peran tidak ditemukan" };

  try {
    const u = await prisma.user.create({
      data: { username: v.data.username, name: v.data.name, roleId: v.data.roleId, passwordHash: await hash(v.data.password) },
    });
    await audit(me.id, "USER_CREATED", u.id, undefined, { username: u.username, name: u.name, roleId: u.roleId });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: `Username ${v.data.username} sudah dipakai` };
    console.error(e);
    return { ok: false, error: "Gagal menyimpan akun, coba lagi" };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserFormResult> {
  const me = await getSessionUser();
  assertCan(me, "manageUsers");
  const v = validateUpdateUser(input);
  if ("error" in v) return { ok: false, error: v.error };

  const before = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!before) return { ok: false, error: "Akun tidak ditemukan" };
  const role = await prisma.role.findUnique({ where: { id: v.data.roleId } });
  if (!role) return { ok: false, error: "Peran tidak ditemukan" };

  // Cegah terkunci: tidak bisa menonaktifkan / mengganti peran akun sendiri,
  // dan harus selalu ada minimal satu akun aktif yang bisa mengelola pengguna.
  if (userId === me.id && (!v.data.isActive || v.data.roleId !== before.roleId))
    return { ok: false, error: "Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri" };
  const losesManager = before.isActive && before.role.canManageUsers && (!v.data.isActive || !role.canManageUsers);
  if (losesManager) {
    const managers = await prisma.user.count({ where: { isActive: true, role: { canManageUsers: true } } });
    if (managers <= 1) return { ok: false, error: "Harus ada minimal satu akun aktif yang bisa mengelola pengguna" };
  }

  await prisma.user.update({ where: { id: userId }, data: v.data });
  await audit(me.id, "USER_UPDATED", userId,
    { name: before.name, roleId: before.roleId, isActive: before.isActive }, v.data);
  revalidatePath("/");
  return { ok: true };
}

/** Reset password akun lain (mis. lupa password). Akun itu otomatis keluar dari semua perangkat. */
export async function resetUserPassword(userId: string, newPassword: string): Promise<UserFormResult> {
  const me = await getSessionUser();
  assertCan(me, "manageUsers");
  const err = checkPassword(newPassword);
  if (err) return { ok: false, error: err };
  if (userId === me.id) return { ok: false, error: "Untuk akun sendiri gunakan menu Ganti Password" };
  if (!(await prisma.user.findUnique({ where: { id: userId } }))) return { ok: false, error: "Akun tidak ditemukan" };

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(newPassword), passwordChangedAt: new Date() } });
  await audit(me.id, "PASSWORD_RESET", userId);
  revalidatePath("/");
  return { ok: true };
}
