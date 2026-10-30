"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCan } from "@/lib/roles";

/**
 * Server Actions untuk dashboard (interface SampleActions).
 * Setiap aksi: cek izin di server (assertCan) → ubah data dalam transaksi → tulis AuditLog.
 */

type Tx = Prisma.TransactionClient;

function audit(tx: Tx, userId: string, sampleId: string | null, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) {
  return tx.auditLog.create({
    data: {
      userId, sampleId, action, entity, entityId,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
    },
  });
}

function fail(message: string): never {
  throw new Error(message);
}

export async function startTrial(sampleId: string) {
  const user = await getSessionUser();
  assertCan(user, "runTrial");

  await prisma.$transaction(async (tx) => {
    const s = await tx.sample.findUnique({ where: { id: sampleId }, include: { trials: { orderBy: { trialNo: "desc" }, take: 1 } } });
    if (!s) fail("Sampel tidak ditemukan");
    if (s.status !== "MENUNGGU" && s.status !== "MATCHING_ULANG") fail("Sampel tidak dalam status yang bisa diuji");
    if (s.trials[0]?.status === "BERJALAN") fail("Masih ada percobaan yang berjalan");

    const trialNo = (s.trials[0]?.trialNo ?? 0) + 1;
    const trial = await tx.testTrial.create({ data: { sampleId, trialNo, operatorId: user.id } });
    await tx.sample.update({ where: { id: sampleId }, data: { status: "DALAM_PROSES" } });
    await audit(tx, user.id, sampleId, "TRIAL_STARTED", "TestTrial", trial.id, { status: s.status }, { status: "DALAM_PROSES", trialNo });
  });
  revalidatePath("/");
}

export async function finishTrial(trialId: string, notes: string) {
  const user = await getSessionUser();
  assertCan(user, "runTrial");
  if (!notes.trim()) fail("Catatan percobaan wajib diisi");

  await prisma.$transaction(async (tx) => {
    const t = await tx.testTrial.findUnique({ where: { id: trialId } });
    if (!t || t.status !== "BERJALAN") fail("Percobaan tidak sedang berjalan");

    await tx.testTrial.update({ where: { id: trialId }, data: { status: "SELESAI", finishedAt: new Date(), notes: notes.trim() } });
    await tx.sample.update({ where: { id: t.sampleId }, data: { status: "MENUNGGU_APPROVAL" } });
    await audit(tx, user.id, t.sampleId, "TRIAL_FINISHED", "TestTrial", trialId, undefined, { notes: notes.trim() });
  });
  revalidatePath("/");
}

async function decide(trialId: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const user = await getSessionUser();
  assertCan(user, "approve");
  if (decision === "REJECTED" && !note?.trim()) fail("Alasan matching ulang wajib diisi");

  await prisma.$transaction(async (tx) => {
    const t = await tx.testTrial.findUnique({ where: { id: trialId } });
    if (!t || t.status !== "SELESAI" || t.decision !== "PENDING") fail("Percobaan tidak menunggu approval");

    await tx.testTrial.update({
      where: { id: trialId },
      data: { decision, approverId: user.id, decidedAt: new Date(), rejectNote: decision === "REJECTED" ? note!.trim() : null },
    });
    const status = decision === "APPROVED" ? "DISETUJUI" : "MATCHING_ULANG";
    await tx.sample.update({ where: { id: t.sampleId }, data: { status } });
    await audit(tx, user.id, t.sampleId, decision, "TestTrial", trialId, undefined, { status, note: note?.trim() });
  });
  revalidatePath("/");
}

export async function approve(trialId: string) {
  await decide(trialId, "APPROVED");
}

export async function reject(trialId: string, note: string) {
  await decide(trialId, "REJECTED", note);
}

export async function changeDueDate(sampleId: string, dueDate: string, reason: string) {
  const user = await getSessionUser();
  assertCan(user, "editDue");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate))) fail("Format due date tidak valid");
  if (!reason.trim()) fail("Alasan perubahan wajib diisi");

  await prisma.$transaction(async (tx) => {
    const s = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!s) fail("Sampel tidak ditemukan");
    if (s.status === "DISETUJUI") fail("Sampel sudah disetujui");

    await tx.sample.update({ where: { id: sampleId }, data: { dueDate: new Date(`${dueDate}T00:00:00Z`) } });
    await audit(tx, user.id, sampleId, "DUE_DATE_CHANGED", "Sample", sampleId,
      { dueDate: s.dueDate.toISOString().slice(0, 10) }, { dueDate, reason: reason.trim() });
  });
  revalidatePath("/");
}

export async function setUrgent(sampleId: string, urgent: boolean, reason: string) {
  const user = await getSessionUser();
  assertCan(user, "markUrgent");

  await prisma.$transaction(async (tx) => {
    const s = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!s) fail("Sampel tidak ditemukan");

    await tx.sample.update({
      where: { id: sampleId },
      data: urgent
        ? { isUrgent: true, urgentReason: reason.trim() || null, urgentById: user.id, urgentAt: new Date() }
        : { isUrgent: false, urgentReason: null, urgentById: null, urgentAt: null },
    });
    await audit(tx, user.id, sampleId, urgent ? "URGENT_MARKED" : "URGENT_REMOVED", "Sample", sampleId,
      { isUrgent: s.isUrgent }, { isUrgent: urgent, reason: reason.trim() });
  });
  revalidatePath("/");
}

export async function markNotificationsSeen() {
  const user = await getSessionUser();
  await prisma.user.update({ where: { id: user.id }, data: { notificationsSeenAt: new Date() } });
  revalidatePath("/");
}
