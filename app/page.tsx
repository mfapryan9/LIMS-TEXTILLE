import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildStandardTimeMap, calculateCR, dateOnlyDayNumber, jakartaDayNumber, sortByPriority, withCR } from "@/lib/cr";
import { deriveNotifications, type ChangeSource } from "@/lib/roles";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { PendingChange, SampleRow } from "@/components/dashboard/badges";
import { changeOwnPassword, createUser, resetUserPassword, updateUser } from "@/app/user-actions";
import { cancelChange, cancelUrgent, createSample, decideChange, finishProcess, markNotificationsSeen, moveUrgent, requestDelete, requestEdit, startProcess } from "@/app/actions";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic"; // CR bergantung pada tanggal hari ini → jangan di-cache statis

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Tanggal kalender WIB dari sebuah instan, sebagai YYYY-MM-DD. */
const jakartaIso = (d: Date) => new Date(jakartaDayNumber(d) * 86_400_000).toISOString().slice(0, 10);

export default async function DashboardPage() {
  const user = await getSessionUser();

  const changeSince = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const [samples, times, machines, processTypes, changes] = await Promise.all([
    prisma.sample.findMany({
      include: {
        processType: true,
        machine: true,
        trials: { orderBy: { trialNo: "asc" }, include: { approver: { select: { name: true } } } },
        resultPhoto: { select: { id: true } }, // hanya penanda ada foto; gambarnya diambil lewat /hasil/[id]
      },
    }),
    prisma.masterProcessTime.findMany(),
    prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.processType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    // Permintaan edit/hapus PPIC: yang menunggu validasi lab + hasil validasi 14 hari terakhir (notifikasi PPIC)
    prisma.changeRequest.findMany({
      where: { OR: [{ status: "PENDING" }, { decidedAt: { gte: changeSince } }] },
      include: { decidedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const pendingBySample = new Map<string, PendingChange>(
    changes
      .filter((c) => c.status === "PENDING" && c.sampleId)
      .map((c) => [c.sampleId!, {
        id: c.id, type: c.type, reason: c.reason, requesterName: c.requesterName, createdAt: c.createdAt.toISOString(),
        diff: ((c.payload as { diff?: PendingChange["diff"] } | null)?.diff) ?? [],
      }]),
  );
  const changeSources: ChangeSource[] = changes.map((c) => ({
    id: c.id, sampleId: c.sampleId, type: c.type, status: c.status, label: c.label, reason: c.reason, requesterName: c.requesterName,
    createdAt: c.createdAt.toISOString(), decidedAt: c.decidedAt?.toISOString() ?? null, decidedByName: c.decidedBy?.name ?? null, decisionNote: c.decisionNote,
  }));

  // Kelola pengguna: hanya dimuat untuk Kepala Laboratorium (canManageUsers)
  const [users, roles] = user.canManageUsers
    ? await Promise.all([
        prisma.user.findMany({ select: { id: true, username: true, name: true, roleId: true, isActive: true, createdAt: true } }),
        prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true, viewMode: true, canApprove: true, canEditSample: true, canManageUsers: true, canInterveneUrgent: true } }),
      ])
    : [[], []];

  const timeMap = buildStandardTimeMap(times);
  const enriched = sortByPriority(
    withCR(
      samples.map((s) => ({ ...s, dueDate: iso(s.dueDate), receivedDate: iso(s.receivedDate) })),
      timeMap,
    ),
  );
  const today = jakartaDayNumber();
  // Warna khas kelompok mesin = urutan nama (A. Thermosol = 0, B. CPB = 1, …); kelompok tidak aktif di akhir
  const machineColor = (id: string) => { const i = machines.findIndex((m) => m.id === id); return i < 0 ? machines.length : i; };

  const rows: SampleRow[] = enriched.map((s) => {
    const last = s.trials[s.trials.length - 1];
    const approved = s.trials.find((t) => t.decision === "APPROVED");
    const firstStart = s.trials[0]?.startedAt;
    // Masuk lab = tanggal terima, atau mulai uji pertama bila tercatat lebih awal (ada di data Excel)
    const labStart = Math.min(dateOnlyDayNumber(s.receivedDate), firstStart ? jakartaDayNumber(firstStart) : Infinity);
    const labEnd = s.completedAt ? jakartaDayNumber(s.completedAt) : approved?.decidedAt ? jakartaDayNumber(approved.decidedAt) : today;
    const orderDate = s.orderDate ? iso(s.orderDate) : null;

    return {
      id: s.id, orderNo: s.orderNo, orderDate, spkNo: s.spkNo, orderType: s.orderType,
      customerName: s.customerName, motif: s.motif, colorDirection: s.colorDirection, colorCode: s.colorCode,
      processTypeId: s.processTypeId, processName: s.processType.name,
      machineId: s.machineId, machineName: s.machine.name, machineColor: machineColor(s.machineId),
      fabricProblem: s.fabricProblem, problemDescription: s.problemDescription,
      receivedDate: s.receivedDate, dueDate: s.dueDate,
      status: s.status, isUrgent: s.isUrgent,
      createdAt: s.createdAt.toISOString(), urgentAt: s.urgentAt?.toISOString() ?? null,
      urgentRank: s.urgentRank, pendingChange: pendingBySample.get(s.id) ?? null,
      colorName: s.colorName, parties: s.parties, requesterName: s.requesterName,
      processorName: s.processorName, processStartedAt: s.processStartedAt?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null, resultNote: s.resultNote, hasPhoto: !!s.resultPhoto,
      trialNo: last?.trialNo ?? 0,
      rejectedCount: s.trials.filter((t) => t.decision === "REJECTED").length,
      lastRejectNote: [...s.trials].reverse().find((t) => t.rejectNote)?.rejectNote ?? null,
      openTrialId: last?.status === "BERJALAN" ? last.id : null,
      pendingTrialId: last && last.status === "SELESAI" && last.decision === "PENDING" ? last.id : null,
      approvedTrialNo: approved?.trialNo ?? null,
      approvedAt: approved?.decidedAt ? jakartaIso(approved.decidedAt) : null,
      approverName: approved?.approver?.name ?? null,
      approvedNotes: approved?.notes ?? null,
      labDays: Math.max(0, labEnd - labStart),
      cr: s.cr, daysLeft: s.daysLeft, urgency: s.urgency, standardDays: s.standardDays,
      // CR saat order masuk (t = TGL ORDER) = angka di Excel; hanya informasi, urutan memakai CR hari ini
      crAtOrder: orderDate && s.standardDays
        ? calculateCR({ dueDate: s.dueDate, standardDays: s.standardDays, now: new Date(`${orderDate}T03:00:00Z`) }).cr
        : null,
    };
  });

  // Notifikasi berbeda per peran: lab (pengajuan masuk, urgent, validasi edit/hapus), PPIC (selesai, hasil validasi), kepala (urgent)
  const notifs = deriveNotifications(rows, user.roleCode, user.notificationsSeenAt, new Date(), changeSources);

  return (
    <DashboardClient
      user={user}
      rows={rows}
      notifs={notifs}
      machines={machines.map((m, color) => {
        // Kelompok mesin = sheet Excel; p sama untuk semua proses di kelompoknya
        const own = times.filter((t) => t.machineId === m.id);
        return {
          id: m.id,
          name: m.name,
          color,
          p: own.length ? own[0].standardDays.toNumber() : null,
          processes: processTypes.filter((p) => own.some((t) => t.processTypeId === p.id)).map((p) => p.name),
        };
      })}
      actions={{ startProcess, finishProcess, cancelUrgent, moveUrgent, requestDelete, cancelChange, decideChange, markNotificationsSeen }}
      editor={{
        processTypes: processTypes.map((p) => ({ id: p.id, name: p.name })),
        processMachine: Object.fromEntries(times.map((t) => [t.processTypeId, t.machineId])),
        create: createSample,
        update: requestEdit,
      }}
      userAdmin={
        user.canManageUsers
          ? {
              users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
              roles,
              create: createUser,
              update: updateUser,
              resetPassword: resetUserPassword,
            }
          : undefined
      }
      changePassword={changeOwnPassword}
      onLogout={logout}
    />
  );
}
