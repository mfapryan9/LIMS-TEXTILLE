"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCan } from "@/lib/roles";
import { todayJakarta } from "@/lib/cr";
import { validateSampleInput, type SampleFormResult, type SampleInput } from "@/lib/sample-input";

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

export type ActionResult = { ok: true } | { ok: false; error: string };

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Operator mulai memproses pengajuan: wajib mengisi nama pemroses. Status → Dalam proses (tampil di semua user). */
export async function startProcess(sampleId: string, processorName: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "processRequest");
  const name = String(processorName ?? "").trim().replace(/\s{2,}/g, " ");
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Nama pemroses wajib diisi (2–60 karakter)" };

  const res = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const s = await tx.sample.findUnique({ where: { id: sampleId }, include: { trials: { orderBy: { trialNo: "desc" }, take: 1 } } });
    if (!s) return { ok: false, error: "Pengajuan tidak ditemukan" };
    if (s.status !== "MENUNGGU") return { ok: false, error: "Pengajuan ini sudah diproses" };
    const trialNo = (s.trials[0]?.trialNo ?? 0) + 1;
    await tx.testTrial.create({ data: { sampleId, trialNo, operatorId: user.id, notes: `Diproses oleh ${name}` } });
    await tx.sample.update({ where: { id: sampleId }, data: { status: "DALAM_PROSES", processorName: name, processStartedAt: new Date() } });
    await audit(tx, user.id, sampleId, "PROCESS_STARTED", "Sample", sampleId, { status: s.status }, { status: "DALAM_PROSES", processorName: name });
    return { ok: true };
  });
  if (res.ok) revalidatePath("/");
  return res;
}

/** Operator menyelesaikan pengajuan: wajib melampirkan foto hasil uji (memuat resep). PPIC mendapat notifikasi. */
export async function finishProcess(form: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "processRequest");
  const sampleId = String(form.get("sampleId") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Foto hasil uji wajib dilampirkan" };
  if (!PHOTO_TYPES.includes(photo.type)) return { ok: false, error: "Format foto harus JPG, PNG, atau WEBP" };
  if (photo.size > PHOTO_MAX_BYTES) return { ok: false, error: "Ukuran foto maksimal 4 MB" };
  const data = Buffer.from(await photo.arrayBuffer());

  const res = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const s = await tx.sample.findUnique({ where: { id: sampleId }, include: { trials: { orderBy: { trialNo: "desc" }, take: 1 } } });
    if (!s) return { ok: false, error: "Pengajuan tidak ditemukan" };
    if (s.status !== "DALAM_PROSES") return { ok: false, error: "Pengajuan belum diproses atau sudah selesai" };
    const now = new Date();
    const trial = s.trials[0];
    if (trial) {
      await tx.testTrial.update({
        where: { id: trial.id },
        data: { status: "SELESAI", finishedAt: now, decision: "APPROVED", decidedAt: now, notes: note || trial.notes },
      });
    }
    await tx.resultPhoto.upsert({
      where: { sampleId },
      create: { sampleId, mimeType: photo.type, data },
      update: { mimeType: photo.type, data, createdAt: now },
    });
    await tx.sample.update({ where: { id: sampleId }, data: { status: "DISETUJUI", completedAt: now, resultNote: note || null } });
    await audit(tx, user.id, sampleId, "PROCESS_FINISHED", "Sample", sampleId, { status: s.status },
      { status: "DISETUJUI", processorName: s.processorName, note, photoBytes: data.length });
    return { ok: true };
  }, { timeout: 20000 });
  if (res.ok) revalidatePath("/");
  return res;
}

/** Intervensi kepala: membatalkan / menurunkan status urgent sebuah pengajuan (wajib alasan). */
export async function cancelUrgent(sampleId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "interveneUrgent");
  const why = String(reason ?? "").trim();
  if (!why) return { ok: false, error: "Alasan pembatalan urgent wajib diisi" };

  const res = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const s = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!s) return { ok: false, error: "Pengajuan tidak ditemukan" };
    if (!s.isUrgent) return { ok: false, error: "Pengajuan ini tidak berstatus urgent" };
    if (s.status === "DISETUJUI") return { ok: false, error: "Pengajuan sudah selesai" };
    await tx.sample.update({ where: { id: sampleId }, data: { isUrgent: false, urgentReason: null, urgentById: null, urgentAt: null } });
    await audit(tx, user.id, sampleId, "URGENT_CANCELLED", "Sample", sampleId,
      { isUrgent: true, urgentReason: s.urgentReason }, { isUrgent: false, reason: why, by: user.name });
    return { ok: true };
  });
  if (res.ok) revalidatePath("/");
  return res;
}
// ───────────── Tambah / edit SPK ─────────────
// Mengembalikan { ok, error } alih-alih throw: di production pesan error dari throw disembunyikan Next.js,
// padahal form perlu menampilkan alasan gagal (mis. SPK + kode warna sudah terdaftar).

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

function sampleData(d: SampleInput) {
  return {
    orderType: d.orderType,
    orderNo: d.orderNo || null,
    orderDate: d.orderDate ? toDate(d.orderDate) : null,
    spkNo: d.spkNo,
    customerName: d.customerName || null,
    motif: d.motif || null,
    colorDirection: d.colorDirection || null,
    colorCode: d.colorCode || null,
    colorName: d.colorName || null,
    parties: d.parties,
    requesterName: d.requesterName || null,
    processTypeId: d.processTypeId,
    machineId: d.machineId,
    fabricProblem: d.fabricProblem || null,
    problemDescription: d.problemDescription || null,
    receivedDate: toDate(d.receivedDate),
    dueDate: toDate(d.dueDate),
  };
}

/** Error yang pesannya aman ditampilkan ke pengguna di form. */
class FormError extends Error {}

const toCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "BARU";

async function uniqueCode(exists: (code: string) => Promise<boolean>, name: string) {
  const base = toCode(name).slice(0, 40);
  for (let i = 1; ; i++) {
    const code = i === 1 ? base : `${base}_${i}`;
    if (!(await exists(code))) return code;
  }
}

/**
 * Tentukan kelompok mesin & proses lab untuk sampel. Bila operator mengisi nama baru, data master dibuat
 * (kelompok mesin + p, proses lab, dan pasangan proses↔kelompok) sehingga muncul di daftar pilihan berikutnya.
 */
async function resolveMaster(tx: Tx, userId: string, d: SampleInput): Promise<{ machineId: string; processTypeId: string }> {
  // ── Kelompok mesin
  let machineId = d.machineId;
  let p: Prisma.Decimal | null = null;
  if (!machineId) {
    const existing = await tx.machine.findFirst({ where: { name: { equals: d.newMachine, mode: "insensitive" } } });
    if (existing) {
      machineId = existing.id;
      if (!existing.isActive) await tx.machine.update({ where: { id: existing.id }, data: { isActive: true } });
    } else {
      const code = await uniqueCode(async (c) => !!(await tx.machine.findUnique({ where: { code: c } })), d.newMachine);
      const m = await tx.machine.create({ data: { code, name: d.newMachine } });
      machineId = m.id;
      p = new Prisma.Decimal(d.newMachineP);
      await audit(tx, userId, null, "MASTER_CREATED", "Machine", m.id, undefined, { name: d.newMachine, p: d.newMachineP });
    }
  }
  if (!p) {
    const t = await tx.masterProcessTime.findFirst({ where: { machineId } });
    if (t) p = t.standardDays;
    else if (d.newMachineP) p = new Prisma.Decimal(d.newMachineP);
  }
  const machine = await tx.machine.findUnique({ where: { id: machineId } });
  if (!machine) throw new FormError("Kelompok mesin tidak ditemukan");

  // ── Proses lab
  let processTypeId = d.processTypeId;
  if (!processTypeId) {
    const existing = await tx.processType.findFirst({ where: { name: { equals: d.newProcess, mode: "insensitive" } } });
    if (existing) {
      processTypeId = existing.id;
      if (!existing.isActive) await tx.processType.update({ where: { id: existing.id }, data: { isActive: true } });
    } else {
      const code = await uniqueCode(async (c) => !!(await tx.processType.findUnique({ where: { code: c } })), d.newProcess);
      const pt = await tx.processType.create({ data: { code, name: d.newProcess } });
      processTypeId = pt.id;
      await audit(tx, userId, null, "MASTER_CREATED", "ProcessType", pt.id, undefined, { name: d.newProcess, machine: machine.name });
    }
  }

  // ── Pasangan proses ↔ kelompok mesin (p untuk CR). Satu proses hanya milik satu kelompok mesin.
  const times = await tx.masterProcessTime.findMany({ where: { processTypeId }, include: { machine: true, processType: true } });
  const other = times.find((t) => t.machineId !== machineId);
  if (other) throw new FormError(`Proses ${other.processType.name} sudah terdaftar di kelompok ${other.machine.name}. Pilih kelompok itu atau beri nama proses lain.`);
  if (!times.length) {
    if (!p) throw new FormError("p kelompok mesin belum ada, isi p untuk kelompok ini");
    await tx.masterProcessTime.create({ data: { processTypeId, machineId, standardDays: p } });
  }
  return { machineId, processTypeId };
}

const urgentData = (urgent: boolean, userId: string) =>
  urgent
    ? { isUrgent: true, urgentReason: "Diajukan urgent oleh PPIC", urgentById: userId, urgentAt: new Date() }
    : { isUrgent: false, urgentReason: null, urgentById: null, urgentAt: null };

function writeError(e: unknown): SampleFormResult {
  if (e instanceof FormError) return { ok: false, error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { ok: false, error: "Kombinasi No. SPK + kode warna ini sudah terdaftar" };
    if (e.code === "P2003") return { ok: false, error: "Proses atau mesin tidak ditemukan di master data" };
  }
  console.error(e);
  return { ok: false, error: "Gagal menyimpan data, coba lagi" };
}

export async function createSample(input: SampleInput): Promise<SampleFormResult> {
  const user = await getSessionUser();
  assertCan(user, "submitRequest");
  // Pengajuan PPIC: tanggal masuk lab = hari ini (WIB), jenis order produksi
  const v = validateSampleInput({ ...input, orderType: "PRODUKSI", receivedDate: todayJakarta(), orderDate: input.orderDate || todayJakarta() });
  if ("error" in v) return { ok: false, error: v.error };

  if (v.data.isUrgent && !user.canMarkUrgent) return { ok: false, error: "Anda tidak berhak menandai urgent" };

  try {
    await prisma.$transaction(async (tx) => {
      const master = await resolveMaster(tx, user.id, v.data);
      const s = await tx.sample.create({
        data: { ...sampleData({ ...v.data, ...master }), createdById: user.id, ...(v.data.isUrgent ? urgentData(true, user.id) : {}) },
      });
      await audit(tx, user.id, s.id, "SAMPLE_CREATED", "Sample", s.id, undefined, { ...v.data, ...master });
    });
  } catch (e) {
    return writeError(e);
  }
  revalidatePath("/");
  return { ok: true };
}

export async function updateSample(sampleId: string, input: SampleInput): Promise<SampleFormResult> {
  const user = await getSessionUser();
  assertCan(user, "submitRequest");
  const v = validateSampleInput(input);
  if ("error" in v) return { ok: false, error: v.error };

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.sample.findUnique({ where: { id: sampleId } });
      if (!before) throw new Error("NOT_FOUND");
      if (before.status !== "MENUNGGU") throw new FormError("Pengajuan yang sudah diproses lab tidak dapat diubah");
      const urgentChanged = before.isUrgent !== v.data.isUrgent;
      if (urgentChanged && !user.canMarkUrgent) throw new FormError("Anda tidak berhak mengubah status urgent");
      const master = await resolveMaster(tx, user.id, v.data);
      await tx.sample.update({
        where: { id: sampleId },
        data: { ...sampleData({ ...v.data, ...master }), ...(urgentChanged ? urgentData(v.data.isUrgent, user.id) : {}) },
      });
      await audit(tx, user.id, sampleId, "SAMPLE_UPDATED", "Sample", sampleId, JSON.parse(JSON.stringify(before)), { ...v.data, ...master });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") return { ok: false, error: "Pengajuan tidak ditemukan" };
    return writeError(e);
  }
  revalidatePath("/");
  return { ok: true };
}

export async function markNotificationsSeen() {
  const user = await getSessionUser();
  await prisma.user.update({ where: { id: user.id }, data: { notificationsSeenAt: new Date() } });
  revalidatePath("/");
}
