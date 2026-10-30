/**
 * Seed awal: role, satu akun per role, master proses/mesin/waktu standar, dan sampel contoh.
 * Aman dijalankan berulang: master data di-upsert, sampel contoh hanya dibuat bila tabel samples kosong.
 *
 *   npx prisma db seed            (password default: SEED_PASSWORD atau "lims12345")
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_SEED } from "../lib/roles";
import { todayJakarta } from "../lib/cr";

const prisma = new PrismaClient();

const PROCESS_TYPES = [
  { code: "REAKTIF", name: "Dyeing Reaktif" },
  { code: "DISPERSE", name: "Dyeing Disperse" },
  { code: "FINISHING", name: "Finishing" },
];

const MACHINES = [
  { code: "JD-01", name: "Jet Dyeing JD-01" },
  { code: "W-02", name: "Winch W-02" },
  { code: "LD-03", name: "Lab Dyer LD-03" },
];

// p (hari) per [proses + mesin]. FINISHING + W-02 sengaja tidak diisi → tampil "p belum diatur".
const STANDARD_TIMES: [string, string, number][] = [
  ["REAKTIF", "JD-01", 2],
  ["REAKTIF", "LD-03", 1],
  ["DISPERSE", "JD-01", 3],
  ["DISPERSE", "W-02", 2.5],
  ["FINISHING", "LD-03", 1.5],
];

const MS_PER_DAY = 86_400_000;
const day = (offset: number) => new Date(Date.parse(todayJakarta() + "T00:00:00Z") + offset * MS_PER_DAY);

type RoleDef = { code: string; name: string; viewMode: "OPERATOR" | "APPROVER" | "PLANNER" | "MONITOR"; canApprove?: boolean; canEditDue?: boolean; canMarkUrgent?: boolean; canManageMaster?: boolean };

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "lims12345", 10);

  const users: Record<string, string> = {};
  for (const r of ROLE_SEED as readonly RoleDef[]) {
    const flags = { canApprove: !!r.canApprove, canEditDue: !!r.canEditDue, canMarkUrgent: !!r.canMarkUrgent, canManageMaster: !!r.canManageMaster };
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, viewMode: r.viewMode, ...flags },
      create: { code: r.code, name: r.name, viewMode: r.viewMode, ...flags },
    });
    const username = r.code.toLowerCase().replaceAll("_", ".");
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, name: r.name, passwordHash, roleId: role.id },
    });
    users[r.code] = user.id;
  }

  const proc: Record<string, string> = {};
  for (const p of PROCESS_TYPES) {
    proc[p.code] = (await prisma.processType.upsert({ where: { code: p.code }, update: { name: p.name }, create: p })).id;
  }
  const mach: Record<string, string> = {};
  for (const m of MACHINES) {
    mach[m.code] = (await prisma.machine.upsert({ where: { code: m.code }, update: { name: m.name }, create: m })).id;
  }
  for (const [p, m, standardDays] of STANDARD_TIMES) {
    await prisma.masterProcessTime.upsert({
      where: { processTypeId_machineId: { processTypeId: proc[p], machineId: mach[m] } },
      update: { standardDays },
      create: { processTypeId: proc[p], machineId: mach[m], standardDays },
    });
  }

  if ((await prisma.sample.count()) > 0) {
    console.log("Sampel sudah ada, sampel contoh dilewati.");
    return;
  }

  const op = users.OPERATOR_LAB;
  const kaur = users.KAUR_LAB;
  const ppic = users.PPIC;
  const base = { createdById: ppic, fabricProblem: null as string | null };

  const samples = [
    { spkNo: "SPK-2026-101", orderType: "PRODUKSI", customerName: "PT Sinar Tekstil", motif: "Polos", colorDirection: "Lebih biru", colorCode: "CM-102", p: "REAKTIF", m: "JD-01", recv: -8, due: -2, status: "DALAM_PROSES", trials: [{ status: "BERJALAN" }] },
    { spkNo: "SPK-2026-104", orderType: "MARKETING", customerName: "CV Buana Warna", motif: "Batik Parang", colorDirection: "Lebih merah", colorCode: "CM-204", p: "DISPERSE", m: "JD-01", recv: -5, due: 2, status: "MENUNGGU", trials: [] },
    { spkNo: "SPK-2026-107", orderType: "PRODUKSI", customerName: "PT Global Fabric", motif: "Twill", colorDirection: "Lebih tua", colorCode: "CM-311", p: "REAKTIF", m: "LD-03", recv: -3, due: 4, status: "MENUNGGU_APPROVAL", fabricProblem: "Belang", trials: [{ status: "SELESAI" }] },
    { spkNo: "SPK-2026-110", orderType: "MARKETING", customerName: "PT Indah Kain", motif: "Floral", colorDirection: "Lebih cerah", colorCode: "CM-415", p: "DISPERSE", m: "W-02", recv: -2, due: 12, status: "MENUNGGU", urgent: true, trials: [] },
    { spkNo: "SPK-2026-112", orderType: "PRODUKSI", customerName: "PT Sinar Tekstil", motif: "Polos", colorDirection: "Lebih muda", colorCode: "CM-108", p: "REAKTIF", m: "JD-01", recv: -6, due: 1, status: "MATCHING_ULANG", trials: [{ status: "SELESAI", decision: "REJECTED", rejectNote: "Warna terlalu kusam" }] },
    { spkNo: "SPK-2026-115", orderType: "PRODUKSI", customerName: "CV Mitra Benang", motif: "Dobby", colorDirection: "Lebih hijau", colorCode: "CM-520", p: "FINISHING", m: "W-02", recv: -1, due: 6, status: "MENUNGGU", trials: [] },
    { spkNo: "SPK-2026-118", orderType: "MARKETING", customerName: "PT Nusantara Mode", motif: "Jacquard", colorDirection: "Lebih kuning", colorCode: "CM-612", p: "FINISHING", m: "LD-03", recv: -1, due: 7, status: "MENUNGGU", trials: [] },
    { spkNo: "SPK-2026-095", orderType: "PRODUKSI", customerName: "PT Global Fabric", motif: "Polos", colorDirection: "Sesuai standar", colorCode: "CM-299", p: "DISPERSE", m: "JD-01", recv: -10, due: -1, status: "DISETUJUI", trials: [{ status: "SELESAI", decision: "REJECTED", rejectNote: "Kurang tua" }, { status: "SELESAI", decision: "APPROVED" }] },
    { spkNo: "SPK-2026-120", orderType: "PRODUKSI", customerName: "CV Buana Warna", motif: "Ripstop", colorDirection: "Lebih biru", colorCode: "CM-701", p: "REAKTIF", m: "LD-03", recv: 0, due: 7, status: "MENUNGGU", trials: [] },
  ] as const;

  for (const s of samples) {
    await prisma.sample.create({
      data: {
        ...base,
        spkNo: s.spkNo, orderType: s.orderType, customerName: s.customerName, motif: s.motif,
        colorDirection: s.colorDirection, colorCode: s.colorCode,
        fabricProblem: "fabricProblem" in s ? s.fabricProblem : null,
        processTypeId: proc[s.p], machineId: mach[s.m],
        receivedDate: day(s.recv), dueDate: day(s.due), status: s.status,
        ...("urgent" in s ? { isUrgent: true, urgentReason: "Permintaan prioritas", urgentById: ppic, urgentAt: new Date() } : {}),
        trials: {
          create: s.trials.map((t, i) => {
            const decision = "decision" in t ? t.decision : "PENDING";
            return {
              trialNo: i + 1, operatorId: op, status: t.status,
              finishedAt: t.status === "SELESAI" ? new Date() : null,
              notes: t.status === "SELESAI" ? "Formula disimpan" : null,
              decision,
              approverId: decision === "PENDING" ? null : kaur,
              decidedAt: decision === "PENDING" ? null : new Date(),
              rejectNote: "rejectNote" in t ? t.rejectNote : null,
            };
          }),
        },
      },
    });
  }
  console.log(`Seed selesai: ${samples.length} sampel contoh.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
