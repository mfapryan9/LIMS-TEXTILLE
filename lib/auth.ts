import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/roles";

/**
 * Sesi sederhana: cookie httpOnly berisi `userId.expiresAt.signature` (HMAC-SHA256 dengan AUTH_SECRET).
 * Data user & izin selalu dibaca ulang dari database, jadi perubahan role/nonaktif langsung berlaku.
 */

const COOKIE = "lims_session";
const MAX_AGE_SEC = 7 * 24 * 3600;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET belum diatur (minimal 32 karakter)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSession(userId: string) {
  const payload = `${userId}.${Date.now() + MAX_AGE_SEC * 1000}`;
  cookies().set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

function readSession(): { userId: string; issuedAt: number } | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const [userId, exp, sig] = raw.split(".");
  if (!userId || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(exp) < Date.now()) return null;
  return { userId, issuedAt: Number(exp) - MAX_AGE_SEC * 1000 };
}

/** User yang sedang login, atau null. */
export async function findSessionUser(): Promise<SessionUser | null> {
  const s = readSession();
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.userId }, include: { role: true } });
  if (!u || !u.isActive) return null;
  // Password diganti / di-reset setelah sesi ini dibuat → wajib login ulang
  if (u.passwordChangedAt && u.passwordChangedAt.getTime() > s.issuedAt) return null;
  return {
    id: u.id,
    name: u.name,
    roleCode: u.role.code,
    viewMode: u.role.viewMode,
    canApprove: u.role.canApprove,
    canEditDue: u.role.canEditDue,
    canMarkUrgent: u.role.canMarkUrgent,
    canManageMaster: u.role.canManageMaster,
    canEditSample: u.role.canEditSample,
    canManageUsers: u.role.canManageUsers,
    notificationsSeenAt: u.notificationsSeenAt?.toISOString() ?? null,
  };
}

/** Wajib login: arahkan ke /login bila belum. */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await findSessionUser();
  if (!user) redirect("/login");
  return user;
}
