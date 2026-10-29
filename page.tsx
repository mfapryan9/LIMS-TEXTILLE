import { prisma } from "@/lib/prisma"; // singleton PrismaClient (gunakan adapter Neon bila memakai edge runtime)
import { getSessionUser } from "@/lib/auth"; // Auth.js: kembalikan SessionUser (termasuk viewMode & flag izin)
import { ACTIVE_STATUSES, buildStandardTimeMap, sortByPriority, withCR } from "@/lib/cr";
import { deriveNotifications } from "@/lib/roles";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import * as actions from "@/app/actions"; // server actions: startTrial, finishTrial, approve, reject, changeDueDate, setUrgent, markNotificationsSeen

export const dynamic = "force-dynamic"; // CR bergantung pada tanggal hari ini → jangan di-cache statis

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [samples, times, machines] = await Promise.all([
    prisma.sample.findMany({
      include: {
        processType: true,
        machine: true,
        trials: { orderBy: { trialNo: "desc" }, take: 1 },
      },
    }),
    prisma.masterProcessTime.findMany(),
    prisma.machine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const enriched = sortByPriority(
    withCR(
      samples.map((s) => ({
        ...s,
        dueDate: iso(s.dueDate),
        receivedDate: iso(s.receivedDate),
      })),
      buildStandardTimeMap(times),
    ),
  );

  const rows = enriched.map((s) => {
    const t = s.trials[0];
    return {
      id: s.id, spkNo: s.spkNo, orderType: s.orderType, customerName: s.customerName, motif: s.motif,
      colorDirection: s.colorDirection, colorCode: s.colorCode,
      processTypeId: s.processTypeId, processName: s.processType.name,
      machineId: s.machineId, machineName: s.machine.name,
      fabricProblem: s.fabricProblem, receivedDate: s.receivedDate, dueDate: s.dueDate,
      status: s.status, isUrgent: s.isUrgent,
      trialNo: t?.trialNo ?? 0,
      openTrialId: t?.status === "BERJALAN" ? t.id : null,
      pendingTrialId: t && t.status === "SELESAI" && t.decision === "PENDING" ? t.id : null,
      cr: s.cr, daysLeft: s.daysLeft, urgency: s.urgency, standardDays: s.standardDays,
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
      machines={machines.map((m) => ({ id: m.id, name: m.name }))}
      actions={actions}
    />
  );
}
