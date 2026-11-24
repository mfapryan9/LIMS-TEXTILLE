"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCan } from "@/lib/roles";
import { buildStandardTimeMap, sortByPriority, todayJakarta, withCR } from "@/lib/cr";
import { isProcessorGroup } from "@/lib/processors";
import { sampleLabel } from "@/lib/codes";
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

/** Operator mulai memproses pengajuan: wajib memilih grup pemroses. Status → Dalam proses (tampil di semua user). */
export async function startProcess(sampleId: string, processorName: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "processRequest");
  const name = String(processorName ?? "").trim();
  if (!isProcessorGroup(name)) return { ok: false, error: "Pilih grup pemroses dari daftar" };

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
    await tx.sample.update({ where: { id: sampleId }, data: { isUrgent: false, urgentReason: null, urgentById: null, urgentAt: null, urgentRank: null } });
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
    : { isUrgent: false, urgentReason: null, urgentById: null, urgentAt: null, urgentRank: null };

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

// ───────────── Edit / hapus pengajuan: diminta PPIC, berlaku setelah divalidasi lab ─────────────

type DiffItem = { field: string; before: string; after: string };
const labelOf = sampleLabel;
const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Daftar kolom yang berubah (ditampilkan ke lab saat validasi). */
async function buildDiff(before: Prisma.SampleGetPayload<{ include: { machine: true; processType: true } }>, d: SampleInput): Promise<DiffItem[]> {
  const machineName = d.machineId ? (await prisma.machine.findUnique({ where: { id: d.machineId } }))?.name ?? "" : d.newMachine;
  const processName = d.processTypeId ? (await prisma.processType.findUnique({ where: { id: d.processTypeId } }))?.name ?? "" : d.newProcess;
  const pairs: [string, string, string][] = [
    ["Nama pengaju", before.requesterName ?? "", d.requesterName],
    ["Customer", before.customerName ?? "", d.customerName],
    ["Nomor Order", before.orderNo ?? "", d.orderNo],
    ["No. CM", before.colorCode ?? "", d.colorCode],
    ["Warna", before.colorName ?? "", d.colorName],
    ["Motif", before.motif ?? "", d.motif],
    ["Partai", before.parties.join(", "), d.parties.join(", ")],
    ["Kelompok mesin", before.machine.name, machineName],
    ["Proses lab", before.processType.name, processName],
    ["Due date", dateStr(before.dueDate), d.dueDate],
    ["Urgent", before.isUrgent ? "Ya" : "Tidak", d.isUrgent ? "Ya" : "Tidak"],
    ["Deskripsi order", before.problemDescription ?? "", d.problemDescription],
    ["Deskripsi warna", before.colorDirection ?? "", d.colorDirection],
  ];
  return pairs.filter(([, a, b]) => a !== b).map(([field, a, b]) => ({ field, before: a || "–", after: b || "–" }));
}

/** Pengajuan yang masih bisa diminta edit / hapus (belum selesai). */
const EDITABLE = ["MENUNGGU", "DALAM_PROSES"];

/** PPIC meminta perubahan data pengajuan. Data belum berubah sampai bagian lab menyetujui. */
export async function requestEdit(sampleId: string, input: SampleInput): Promise<SampleFormResult> {
  const user = await getSessionUser();
  assertCan(user, "submitRequest");
  const v = validateSampleInput(input);
  if ("error" in v) return { ok: false, error: v.error };

  const before = await prisma.sample.findUnique({ where: { id: sampleId }, include: { machine: true, processType: true, changeRequests: { where: { status: "PENDING" } } } });
  if (!before) return { ok: false, error: "Pengajuan tidak ditemukan" };
  if (!EDITABLE.includes(before.status)) return { ok: false, error: "Pengajuan yang sudah selesai tidak dapat diubah" };
  if (before.changeRequests.length) return { ok: false, error: "Masih ada permintaan yang menunggu validasi lab untuk pengajuan ini" };
  if (before.isUrgent !== v.data.isUrgent && !user.canMarkUrgent) return { ok: false, error: "Anda tidak berhak mengubah status urgent" };
  const diff = await buildDiff(before, v.data);
  if (!diff.length) return { ok: false, error: "Tidak ada data yang diubah" };

  await prisma.$transaction(async (tx) => {
    const c = await tx.changeRequest.create({
      data: {
        sampleId, type: "EDIT", label: labelOf(before), requestedById: user.id, requesterName: v.data.requesterName || before.requesterName,
        payload: JSON.parse(JSON.stringify({ input: v.data, diff })) as Prisma.InputJsonValue,
      },
    });
    await audit(tx, user.id, sampleId, "CHANGE_REQUESTED", "ChangeRequest", c.id, undefined, { type: "EDIT", diff });
  });
  revalidatePath("/");
  return { ok: true };
}

/** PPIC meminta pengajuan dihapus (wajib alasan). Pengajuan baru terhapus setelah disetujui lab. */
export async function requestDelete(sampleId: string, reason: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "submitRequest");
  const why = String(reason ?? "").trim().slice(0, 300);
  if (!why) return { ok: false, error: "Alasan penghapusan wajib diisi" };
  const s = await prisma.sample.findUnique({ where: { id: sampleId }, include: { changeRequests: { where: { status: "PENDING" } } } });
  if (!s) return { ok: false, error: "Pengajuan tidak ditemukan" };
  if (!EDITABLE.includes(s.status)) return { ok: false, error: "Pengajuan yang sudah selesai tidak dapat dihapus" };
  if (s.changeRequests.length) return { ok: false, error: "Masih ada permintaan yang menunggu validasi lab untuk pengajuan ini" };
  await prisma.$transaction(async (tx) => {
    const c = await tx.changeRequest.create({ data: { sampleId, type: "DELETE", label: labelOf(s), reason: why, requestedById: user.id, requesterName: s.requesterName } });
    await audit(tx, user.id, sampleId, "CHANGE_REQUESTED", "ChangeRequest", c.id, undefined, { type: "DELETE", reason: why });
  });
  revalidatePath("/");
  return { ok: true };
}

/** PPIC membatalkan permintaannya selama belum divalidasi lab. */
export async function cancelChange(changeId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "submitRequest");
  const c = await prisma.changeRequest.findUnique({ where: { id: changeId } });
  if (!c || c.status !== "PENDING") return { ok: false, error: "Permintaan sudah divalidasi atau tidak ditemukan" };
  await prisma.$transaction(async (tx) => {
    await tx.changeRequest.delete({ where: { id: changeId } });
    await audit(tx, user.id, c.sampleId, "CHANGE_CANCELLED", "ChangeRequest", changeId, { type: c.type }, undefined);
  });
  revalidatePath("/");
  return { ok: true };
}

/** Bagian lab memvalidasi permintaan edit/hapus. Disetujui → perubahan diterapkan / pengajuan dihapus. */
export async function decideChange(changeId: string, approve: boolean, note: string): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "validateChange");
  const why = String(note ?? "").trim().slice(0, 300);
  if (!approve && !why) return { ok: false, error: "Alasan penolakan wajib diisi" };

  try {
    const res = await prisma.$transaction(async (tx): Promise<ActionResult> => {
      const c = await tx.changeRequest.findUnique({ where: { id: changeId } });
      if (!c || c.status !== "PENDING") return { ok: false, error: "Permintaan sudah divalidasi atau tidak ditemukan" };
      const decided = { status: approve ? ("APPROVED" as const) : ("REJECTED" as const), decidedById: user.id, decidedAt: new Date(), decisionNote: why || null };
      const s = approve && c.sampleId ? await tx.sample.findUnique({ where: { id: c.sampleId } }) : null;
      await tx.changeRequest.update({ where: { id: changeId }, data: decided });
      await audit(tx, user.id, c.sampleId, approve ? "CHANGE_APPROVED" : "CHANGE_REJECTED", "ChangeRequest", changeId, { type: c.type }, { note: why });
      if (s && c.type === "DELETE") {
        await audit(tx, user.id, s.id, "SAMPLE_DELETED", "Sample", s.id, JSON.parse(JSON.stringify(s)), { changeRequestId: changeId, reason: c.reason });
        await tx.sample.delete({ where: { id: s.id } }); // relasi change_requests & audit_logs → null, uji & foto ikut terhapus
      }
      if (s && c.type === "EDIT") {
        const v = validateSampleInput((c.payload as unknown as { input: SampleInput }).input);
        if ("error" in v) throw new FormError(v.error);
        const master = await resolveMaster(tx, user.id, v.data);
        const urgentChanged = s.isUrgent !== v.data.isUrgent;
        await tx.sample.update({
          where: { id: s.id },
          data: { ...sampleData({ ...v.data, ...master }), ...(urgentChanged ? urgentData(v.data.isUrgent, c.requestedById) : {}) },
        });
        await audit(tx, user.id, s.id, "SAMPLE_UPDATED", "Sample", s.id, JSON.parse(JSON.stringify(s)), { ...v.data, ...master, changeRequestId: changeId });
      }
      return { ok: true };
    }, { timeout: 20000 });
    if (res.ok) revalidatePath("/");
    return res;
  } catch (e) {
    const r = writeError(e);
    return r.ok ? { ok: false, error: "Gagal menyimpan data, coba lagi" } : r;
  }
}

// ───────────── Urutan urgent manual (PPIC) ─────────────

/** Geser pengajuan urgent ke atas / bawah / paling atas di antara pengajuan urgent aktif. */
export async function moveUrgent(sampleId: string, direction: "up" | "down" | "top"): Promise<ActionResult> {
  const user = await getSessionUser();
  assertCan(user, "reorderUrgent");
  const res = await prisma.$transaction(async (tx): Promise<ActionResult> => {
    const [list, times] = await Promise.all([
      tx.sample.findMany({
        where: { isUrgent: true, status: { in: ["MENUNGGU", "DALAM_PROSES"] } },
        select: { id: true, status: true, isUrgent: true, dueDate: true, createdAt: true, processTypeId: true, machineId: true, urgentRank: true },
      }),
      tx.masterProcessTime.findMany(),
    ]);
    const ids = sortByPriority(withCR(list, buildStandardTimeMap(times))).map((s) => s.id);
    const i = ids.indexOf(sampleId);
    if (i < 0) return { ok: false, error: "Pengajuan ini bukan urgent aktif" };
    const j = direction === "top" ? 0 : direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length || j === i) return { ok: true };
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k];
      const s = list.find((x) => x.id === id)!;
      if (s.urgentRank !== k + 1) await tx.sample.update({ where: { id }, data: { urgentRank: k + 1 } });
    }
    await audit(tx, user.id, sampleId, "URGENT_REORDERED", "Sample", sampleId, { position: i + 1 }, { position: j + 1 });
    return { ok: true };
  }, { timeout: 20000 });
  if (res.ok) revalidatePath("/");
  return res;
}

export async function markNotificationsSeen() {
  const user = await getSessionUser();
  await prisma.user.update({ where: { id: user.id }, data: { notificationsSeenAt: new Date() } });
  revalidatePath("/");
}
