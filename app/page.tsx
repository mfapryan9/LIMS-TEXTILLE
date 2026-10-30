import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ACTIVE_STATUSES, buildStandardTimeMap, calculateCR, dateOnlyDayNumber, jakartaDayNumber, sortByPriority, withCR } from "@/lib/cr";
import { deriveNotifications } from "@/lib/roles";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { SampleRow } from "@/components/dashboard/badges";
import { approve, changeDueDate, createSample, finishTrial, markNotificationsSeen, reject, setUrgent, startTrial, updateSample } from "@/app/actions";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic"; // CR bergantung pada tanggal hari ini → jangan di-cache statis

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Tanggal kalender WIB dari sebuah instan, sebagai YYYY-MM-DD. */
const jakartaIso = (d: Date) => new Date(jakartaDayNumber(d) * 86_400_000).toISOString().slice(0, 10);

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [samples, times, machines, processTypes] = await Promise.all([
    prisma.sample.findMany({
      include: {
        processType: true,
        machine: true,
        trials: { orderBy: { trialNo: "asc" }, include: { approver: { select: { name: true } } } },
      },
    }),
    prisma.masterProcessTime.findMany(),
    prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.processType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const timeMap = buildStandardTimeMap(times);
  const enriched = sortByPriority(
    withCR(
      samples.map((s) => ({ ...s, dueDate: iso(s.dueDate), receivedDate: iso(s.receivedDate) })),
      timeMap,
    ),
  );
  const today = jakartaDayNumber();

  const rows: SampleRow[] = enriched.map((s) => {
    const last = s.trials[s.trials.length - 1];
    const approved = s.trials.find((t) => t.decision === "APPROVED");
    const firstStart = s.trials[0]?.startedAt;
    // Masuk lab = tanggal terima, atau mulai uji pertama bila tercatat lebih awal (ada di data Excel)
    const labStart = Math.min(dateOnlyDayNumber(s.receivedDate), firstStart ? jakartaDayNumber(firstStart) : Infinity);
    const labEnd = approved?.decidedAt ? jakartaDayNumber(approved.decidedAt) : today;
    const orderDate = s.orderDate ? iso(s.orderDate) : null;

    return {
      id: s.id, orderNo: s.orderNo, orderDate, spkNo: s.spkNo, orderType: s.orderType,
      customerName: s.customerName, motif: s.motif, colorDirection: s.colorDirection, colorCode: s.colorCode,
      processTypeId: s.processTypeId, processName: s.processType.name,
      machineId: s.machineId, machineName: s.machine.name,
      fabricProblem: s.fabricProblem, problemDescription: s.problemDescription,
      receivedDate: s.receivedDate, dueDate: s.dueDate,
      status: s.status, isUrgent: s.isUrgent,
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

  const notifs = deriveNotifications(
    enriched.filter((s) => ACTIVE_STATUSES.includes(s.status)),
    user.notificationsSeenAt,
  );

  return (
    <DashboardClient
      user={user}
      rows={rows}
      notifs={notifs}
      machines={machines.map((m) => {
        // Kelompok mesin = sheet Excel; p sama untuk semua proses di kelompoknya
        const own = times.filter((t) => t.machineId === m.id);
        return {
          id: m.id,
          name: m.name,
          p: own.length ? own[0].standardDays.toNumber() : null,
          processes: processTypes.filter((p) => own.some((t) => t.processTypeId === p.id)).map((p) => p.name),
        };
      })}
      actions={{ startTrial, finishTrial, approve, reject, changeDueDate, setUrgent, markNotificationsSeen }}
      editor={{
        processTypes: processTypes.map((p) => ({ id: p.id, name: p.name })),
        processMachine: Object.fromEntries(times.map((t) => [t.processTypeId, t.machineId])),
        create: createSample,
        update: updateSample,
      }}
      onLogout={logout}
    />
  );
}
