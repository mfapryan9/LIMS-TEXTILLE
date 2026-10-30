"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function login(username: string, password: string): Promise<{ error: string }> {
  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
  // Pesan sama untuk username tidak ada / password salah agar tidak membocorkan akun yang terdaftar.
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Username atau password salah" };
  }
  createSession(user.id);
  redirect("/");
}

export async function logout() {
  destroySession();
  redirect("/login");
}
