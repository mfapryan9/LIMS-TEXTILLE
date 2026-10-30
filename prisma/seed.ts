/**
 * Seed: role, satu akun per role, master proses/mesin/p dari Excel "SAMPLE ORDERAN SPK.xlsx",
 * riwayat uji selesai (32 sampel Excel, satu per nilai CR berbeda di tiap sheet),
 * dan contoh antrean aktif bertanggal relatif terhadap hari ini (CR dinamis).
 *
 *   npx prisma db seed                    → tambah/perbarui master; sampel hanya dibuat bila tabel kosong
 *   SEED_RESET=1 npx prisma db seed       → HAPUS semua sampel, uji, audit log & master lalu isi ulang
 *   Password akun baru: SEED_PASSWORD atau "lims12345" (akun yang sudah ada tidak diubah).
 */
import { PrismaClient, type SampleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_SEED } from "../lib/roles";
import { todayJakarta } from "../lib/cr";
import excel from "./data/excel-history.json";

const prisma = new PrismaClient();
const MS_PER_DAY = 86_400_000;

type RoleDef = {
  code: string; name: string; viewMode: "OPERATOR" | "APPROVER" | "PLANNER" | "MONITOR";
  canApprove?: boolean; canEditDue?: boolean; canMarkUrgent?: boolean; canManageMaster?: boolean; canEditSample?: boolean;
};

/** Tanggal kalender (YYYY-MM-DD) → kolom @db.Date */
const date = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
/** Jam tertentu WIB pada tanggal itu → DateTime */
const wib = (isoDate: string, hour: number) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + (hour - 7) * 3600_000);
/** Hari ini (WIB) + n hari → YYYY-MM-DD */
const day = (offset: number) => new Date(Date.parse(todayJakarta() + "T00:00:00Z") + offset * MS_PER_DAY).toISOString().slice(0, 10);

const machineName = (sheet: string) => sheet.replace(/^[A-Z]\.\s*/, "");
const processCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

async function main() {
  // ── Role & akun
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "lims12345", 10);
  const users: Record<string, string> = {};
  for (const r of ROLE_SEED as readonly RoleDef[]) {
    const flags = {
      canApprove: !!r.canApprove, canEditDue: !!r.canEditDue, canMarkUrgent: !!r.canMarkUrgent,
      canManageMaster: !!r.canManageMaster, canEditSample: !!r.canEditSample,
    };
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, viewMode: r.viewMode, ...flags },
      create: { code: r.code, name: r.name, viewMode: r.viewMode, ...flags },
    });
    const username = r.code.toLowerCase().replaceAll("_", ".");
    const user = await prisma.user.upsert({
      where: { username },
      update: { roleId: role.id },
      create: { username, name: r.name, passwordHash, roleId: role.id },
    });
    users[r.code] = user.id;
  }

  if (process.env.SEED_RESET === "1") {
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.testTrial.deleteMany(),
      prisma.sample.deleteMany(),
      prisma.masterProcessTime.deleteMany(),
      prisma.machine.deleteMany(),
      prisma.processType.deleteMany(),
    ]);
    console.log("Reset: sampel, uji, audit log, dan master data dihapus.");
  }

  // ── Master dari Excel: sheet = kelompok mesin, p = processing time sheet, proses = kolom PROSES LAB
  const mach: Record<string, string> = {};
  const proc: Record<string, string> = {};
  for (const m of excel.machines) {
    mach[m.code] = (await prisma.machine.upsert({ where: { code: m.code }, update: { name: machineName(m.sheet), isActive: true }, create: { code: m.code, name: machineName(m.sheet) } })).id;
    for (const name of m.processes) {
      const code = processCode(name);
      proc[name] = (await prisma.processType.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } })).id;
      await prisma.masterProcessTime.upsert({
        where: { processTypeId_machineId: { processTypeId: proc[name], machineId: mach[m.code] } },
        update: { standardDays: m.p },
        create: { processTypeId: proc[name], machineId: mach[m.code], standardDays: m.p },
      });
    }
  }
  console.log(`Master: ${excel.machines.length} mesin, ${Object.keys(proc).length} proses lab.`);

  if ((await prisma.sample.count()) > 0) {
    console.log("Sampel sudah ada, sampel contoh dilewati (pakai SEED_RESET=1 untuk mengisi ulang).");
    return;
  }

  const op = users.OPERATOR_LAB;
  const kaur = users.KAUR_LAB;
  const kasi = users.KASI;
  const ppic = users.PPIC;

  // ── Riwayat selesai dari Excel (status DISETUJUI). Excel tidak mencatat jumlah percobaan → 1 uji, ACC saat TGL SELESAI.
  for (const s of excel.samples) {
    await prisma.sample.create({
      data: {
        orderType: "PRODUKSI", orderNo: s.orderNo, orderDate: date(s.orderDate), spkNo: s.spkNo,
        processTypeId: proc[s.process], machineId: mach[s.machine],
        receivedDate: date(s.receivedDate), dueDate: date(s.dueDate), status: "DISETUJUI",
        createdById: ppic, createdAt: wib(s.orderDate, 8),
        trials: {
          create: {
            trialNo: 1, operatorId: op, status: "SELESAI",
            startedAt: wib(s.startedDate, 8), finishedAt: wib(s.finishedDate, 14),
            notes: `Data historis Excel (${s.sheet}, baris ${s.excelRow})`,
            decision: "APPROVED", approverId: kaur, decidedAt: wib(s.finishedDate, 15),
          },
        },
      },
    });
  }

  // ── Contoh antrean aktif: tanggal relatif terhadap hari ini → CR berubah setiap hari.
  type Trial = { decision?: "APPROVED" | "REJECTED"; note?: string; running?: boolean; approver?: string };
  type Example = {
    machine: string; process: string; recv: number; due: number; status: SampleStatus;
    urgent?: boolean; trials?: Trial[]; color?: string; customer?: string; newToday?: boolean;
  };
  const examples: Example[] = [
    { machine: "CPB", process: "TOPPING REAKTIF", recv: -8, due: -1, status: "DALAM_PROSES", trials: [{ running: true }], color: "CM-102", customer: "PT Sinar Tekstil" },
    { machine: "THERMOSOL", process: "PROOF DISPERSE", recv: -5, due: 2, status: "MENUNGGU", customer: "CV Buana Warna" },
    { machine: "STENTER", process: "RF + SHADING", recv: -6, due: 1, status: "MATCHING_ULANG", trials: [{ decision: "REJECTED", note: "Shade kurang tua dibanding master" }] },
    { machine: "JET", process: "PROOF OPTIC", recv: -2, due: 5, status: "MENUNGGU", urgent: true, customer: "PT Indah Kain" },
    { machine: "WASHING", process: "STRIPPING", recv: -7, due: 0, status: "MENUNGGU_APPROVAL", trials: [{ decision: "REJECTED", note: "Masih belang" }, {}] },
    { machine: "CPB", process: "PROOF REAKTIF", recv: -1, due: 6, status: "MENUNGGU", color: "CM-204" },
    { machine: "THERMOSOL", process: "TOPPING DISPERSE", recv: -3, due: 4, status: "DALAM_PROSES", trials: [{ decision: "REJECTED", note: "Arah warna terlalu merah" }, { running: true }] },
    { machine: "STENTER", process: "SHADING", recv: -9, due: -2, status: "MENUNGGU" },
    { machine: "CPB", process: "PAD BLEACHING (LAB)", recv: -4, due: 3, status: "DALAM_PROSES", urgent: true, trials: [{ running: true }] },
    { machine: "THERMOSOL", process: "FIXASI (LAB)", recv: 0, due: 7, status: "MENUNGGU", newToday: true },
    { machine: "JET", process: "LEVELLING", recv: -6, due: 1, status: "MENUNGGU_APPROVAL", trials: [{}] },
    { machine: "WASHING", process: "CUCI PANAS (LAB)", recv: -2, due: 5, status: "MENUNGGU" },
    { machine: "STENTER", process: "PROOF FINISH", recv: -7, due: 0, status: "DISETUJUI", trials: [{ decision: "REJECTED", note: "Kurang tua" }, { decision: "REJECTED", note: "Kilap berbeda" }, { decision: "APPROVED", approver: "KASI" }] },
    { machine: "CPB", process: "TOPPING REAKTIF", recv: -5, due: 2, status: "DISETUJUI", trials: [{ decision: "REJECTED", note: "Shade terlalu muda" }, { decision: "APPROVED" }], color: "CM-311" },
  ];

  let n = 0;
  for (const e of examples) {
    n++;
    const received = day(e.recv);
    const trials = e.trials ?? [];
    await prisma.sample.create({
      data: {
        orderType: "PRODUKSI", orderNo: `26-39${String(n).padStart(2, "0")}`, orderDate: date(day(e.recv - 1)),
        spkNo: `26039${String(n).padStart(2, "0")}`, customerName: e.customer ?? null, colorCode: e.color ?? null,
        processTypeId: proc[e.process], machineId: mach[e.machine],
        receivedDate: date(received), dueDate: date(day(e.due)), status: e.status,
        createdById: ppic, createdAt: e.newToday ? new Date() : wib(received, 8),
        ...(e.urgent ? { isUrgent: true, urgentReason: "Permintaan prioritas customer", urgentById: ppic, urgentAt: new Date() } : {}),
        trials: {
          // Uji ke-i dijadwalkan berurutan sejak tanggal terima (maks. sampai hari ini)
          create: trials.map((t, i) => {
            const startDay = day(Math.min(e.recv + i, 0));
            const finished = !t.running;
            const decided = t.decision !== undefined;
            return {
              trialNo: i + 1, operatorId: op,
              status: finished ? "SELESAI" : "BERJALAN",
              startedAt: wib(startDay, 8),
              finishedAt: finished ? wib(startDay, 13) : null,
              notes: finished ? `Formula uji ke-${i + 1}` : null,
              decision: t.decision ?? "PENDING",
              approverId: decided ? (t.approver === "KASI" ? kasi : kaur) : null,
              decidedAt: decided ? wib(startDay, 15) : null,
              rejectNote: t.decision === "REJECTED" ? t.note ?? null : null,
            } as const;
          }),
        },
      },
    });
  }
  console.log(`Seed selesai: ${excel.samples.length} riwayat Excel + ${examples.length} contoh antrean aktif.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
