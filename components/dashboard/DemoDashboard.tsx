"use client";

import { useEffect, useMemo, useState } from "react";
import { ACTIVE_STATUSES, buildStandardTimeMap, sortByPriority, todayJakarta, withCR, type SampleStatusKey } from "@/lib/cr";
import { deriveNotifications, ROLE_SEED, type SessionUser, type ViewMode } from "@/lib/roles";
import type { SampleRow } from "./badges";
import type { SampleActions } from "./SampleTable";
import { DashboardClient } from "./DashboardClient";

/**
 * Mode demo: data disimpan di state browser (tanpa database).
 * Logika CR, urutan, dan notifikasi memakai fungsi yang sama dengan versi server (lib/cr, lib/roles).
 * Ganti dengan app/(app)/dashboard/page.tsx + server actions setelah Neon DB & auth siap.
 */

type Trial = {
  id: string;
  trialNo: number;
  status: "BERJALAN" | "SELESAI";
  decision: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  rejectNote: string | null;
};

type DemoSample = {
  id: string;
  spkNo: string;
  orderType: "PRODUKSI" | "MARKETING";
  customerName: string;
  motif: string;
  colorDirection: string;
  colorCode: string;
  processTypeId: string;
  machineId: string;
  fabricProblem: string | null;
  receivedDate: string;
  dueDate: string;
  status: SampleStatusKey;
  isUrgent: boolean;
  createdAt: string;
  trials: Trial[];
};

const PROCESS_TYPES = [
  { id: "p-reaktif", name: "Dyeing Reaktif" },
  { id: "p-disperse", name: "Dyeing Disperse" },
  { id: "p-finishing", name: "Finishing" },
];

const MACHINES = [
  { id: "m-jet", name: "Jet Dyeing JD-01" },
  { id: "m-winch", name: "Winch W-02" },
  { id: "m-labdyer", name: "Lab Dyer LD-03" },
];

// p (hari) per [proses + mesin]. Kombinasi Finishing + Winch sengaja belum diatur → "p belum diatur".
const STANDARD_TIMES = [
  { processTypeId: "p-reaktif", machineId: "m-jet", standardDays: 2 },
  { processTypeId: "p-reaktif", machineId: "m-labdyer", standardDays: 1 },
  { processTypeId: "p-disperse", machineId: "m-jet", standardDays: 3 },
  { processTypeId: "p-disperse", machineId: "m-winch", standardDays: 2.5 },
  { processTypeId: "p-finishing", machineId: "m-labdyer", standardDays: 1.5 },
];

const MS_PER_DAY = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(iso + "T00:00:00Z") + days * MS_PER_DAY).toISOString().slice(0, 10);

function seedSamples(): DemoSample[] {
  const today = todayJakarta();
  const now = Date.now();
  const t = (trialNo: number, status: Trial["status"], decision: Trial["decision"] = "PENDING", rejectNote: string | null = null): Trial => ({
    id: `t-${Math.random().toString(36).slice(2, 9)}`, trialNo, status, decision, notes: status === "SELESAI" ? "Formula disimpan" : null, rejectNote,
  });
  const s = (id: number, o: Omit<DemoSample, "id" | "createdAt" | "dueDate"> & { dueIn: number; createdHoursAgo?: number }): DemoSample => {
    const { dueIn, createdHoursAgo = 72, ...rest } = o;
    return { id: `s-${id}`, ...rest, dueDate: shift(today, dueIn), createdAt: new Date(now - createdHoursAgo * 3600_000).toISOString() };
  };

  return [
    s(1, { spkNo: "SPK-2026-101", orderType: "PRODUKSI", customerName: "PT Sinar Tekstil", motif: "Polos", colorDirection: "Lebih biru", colorCode: "CM-102", processTypeId: "p-reaktif", machineId: "m-jet", fabricProblem: null, receivedDate: shift(today, -8), dueIn: -2, status: "DALAM_PROSES", isUrgent: false, trials: [t(1, "BERJALAN")] }),
    s(2, { spkNo: "SPK-2026-104", orderType: "MARKETING", customerName: "CV Buana Warna", motif: "Batik Parang", colorDirection: "Lebih merah", colorCode: "CM-204", processTypeId: "p-disperse", machineId: "m-jet", fabricProblem: null, receivedDate: shift(today, -5), dueIn: 2, status: "MENUNGGU", isUrgent: false, trials: [] }),
    s(3, { spkNo: "SPK-2026-107", orderType: "PRODUKSI", customerName: "PT Global Fabric", motif: "Twill", colorDirection: "Lebih tua", colorCode: "CM-311", processTypeId: "p-reaktif", machineId: "m-labdyer", fabricProblem: "Belang", receivedDate: shift(today, -3), dueIn: 4, status: "MENUNGGU_APPROVAL", isUrgent: false, trials: [t(1, "SELESAI")] }),
    s(4, { spkNo: "SPK-2026-110", orderType: "MARKETING", customerName: "PT Indah Kain", motif: "Floral", colorDirection: "Lebih cerah", colorCode: "CM-415", processTypeId: "p-disperse", machineId: "m-winch", fabricProblem: null, receivedDate: shift(today, -2), dueIn: 12, status: "MENUNGGU", isUrgent: true, trials: [] }),
    s(5, { spkNo: "SPK-2026-112", orderType: "PRODUKSI", customerName: "PT Sinar Tekstil", motif: "Polos", colorDirection: "Lebih muda", colorCode: "CM-108", processTypeId: "p-reaktif", machineId: "m-jet", fabricProblem: null, receivedDate: shift(today, -6), dueIn: 1, status: "MATCHING_ULANG", isUrgent: false, trials: [t(1, "SELESAI", "REJECTED", "Warna terlalu kusam")] }),
    s(6, { spkNo: "SPK-2026-115", orderType: "PRODUKSI", customerName: "CV Mitra Benang", motif: "Dobby", colorDirection: "Lebih hijau", colorCode: "CM-520", processTypeId: "p-finishing", machineId: "m-winch", fabricProblem: null, receivedDate: shift(today, -1), dueIn: 6, status: "MENUNGGU", isUrgent: false, trials: [], createdHoursAgo: 5 }),
    s(7, { spkNo: "SPK-2026-118", orderType: "MARKETING", customerName: "PT Nusantara Mode", motif: "Jacquard", colorDirection: "Lebih kuning", colorCode: "CM-612", processTypeId: "p-finishing", machineId: "m-labdyer", fabricProblem: null, receivedDate: shift(today, -1), dueIn: 7, status: "MENUNGGU", isUrgent: false, trials: [], createdHoursAgo: 2 }),
    s(8, { spkNo: "SPK-2026-095", orderType: "PRODUKSI", customerName: "PT Global Fabric", motif: "Polos", colorDirection: "Sesuai standar", colorCode: "CM-299", processTypeId: "p-disperse", machineId: "m-jet", fabricProblem: null, receivedDate: shift(today, -10), dueIn: -1, status: "DISETUJUI", isUrgent: false, trials: [t(1, "SELESAI", "REJECTED", "Kurang tua"), t(2, "SELESAI", "APPROVED")] }),
    s(9, { spkNo: "SPK-2026-120", orderType: "PRODUKSI", customerName: "CV Buana Warna", motif: "Ripstop", colorDirection: "Lebih biru", colorCode: "CM-701", processTypeId: "p-reaktif", machineId: "m-labdyer", fabricProblem: null, receivedDate: today, dueIn: 7, status: "MENUNGGU", isUrgent: false, trials: [], createdHoursAgo: 1 }),
  ];
}

type RoleDef = { code: string; name: string; viewMode: ViewMode; canApprove?: boolean; canEditDue?: boolean; canMarkUrgent?: boolean; canManageMaster?: boolean };
const ROLES = ROLE_SEED as readonly RoleDef[];

const toUser = (r: RoleDef, seenAt: string | null): SessionUser => ({
  id: `demo-${r.code}`,
  name: `Demo ${r.name}`,
  roleCode: r.code,
  viewMode: r.viewMode,
  canApprove: !!r.canApprove,
  canEditDue: !!r.canEditDue,
  canMarkUrgent: !!r.canMarkUrgent,
  canManageMaster: !!r.canManageMaster,
  notificationsSeenAt: seenAt,
});

const processName = new Map(PROCESS_TYPES.map((p) => [p.id, p.name]));
const machineName = new Map(MACHINES.map((m) => [m.id, m.name]));
const times = buildStandardTimeMap(STANDARD_TIMES);

export function DemoDashboard() {
  // Data dibuat setelah mount agar tanggal mengikuti "hari ini" di browser (bukan saat build).
  const [samples, setSamples] = useState<DemoSample[] | null>(null);
  const [roleCode, setRoleCode] = useState<string>("OPERATOR_LAB");
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});

  useEffect(() => setSamples(seedSamples()), []);

  const role = ROLES.find((r) => r.code === roleCode) ?? ROLES[0];
  const user = toUser(role, seenAt[role.code] ?? null);

  const enriched = useMemo(() => (samples ? sortByPriority(withCR(samples, times)) : []), [samples]);

  const rows: SampleRow[] = useMemo(
    () =>
      enriched.map((s) => {
        const t = s.trials[s.trials.length - 1];
        return {
          id: s.id, spkNo: s.spkNo, orderType: s.orderType, customerName: s.customerName, motif: s.motif,
          colorDirection: s.colorDirection, colorCode: s.colorCode,
          processTypeId: s.processTypeId, processName: processName.get(s.processTypeId) ?? "-",
          machineId: s.machineId, machineName: machineName.get(s.machineId) ?? "-",
          fabricProblem: s.fabricProblem, receivedDate: s.receivedDate, dueDate: s.dueDate,
          status: s.status, isUrgent: s.isUrgent,
          trialNo: t?.trialNo ?? 0,
          openTrialId: t?.status === "BERJALAN" ? t.id : null,
          pendingTrialId: t && t.status === "SELESAI" && t.decision === "PENDING" ? t.id : null,
          cr: s.cr, daysLeft: s.daysLeft, urgency: s.urgency, standardDays: s.standardDays,
        };
      }),
    [enriched],
  );

  const notifs = useMemo(
    () => deriveNotifications(enriched.filter((s) => ACTIVE_STATUSES.includes(s.status)), user.notificationsSeenAt),
    [enriched, user.notificationsSeenAt],
  );

  if (!samples) return <div className="min-h-screen bg-slate-100" />;

  const updateSample = (id: string, fn: (s: DemoSample) => DemoSample) =>
    setSamples((all) => all && all.map((s) => (s.id === id ? fn(s) : s)));
  const updateTrial = (trialId: string, fn: (s: DemoSample, t: Trial) => DemoSample) =>
    setSamples((all) => all && all.map((s) => {
      const t = s.trials.find((x) => x.id === trialId);
      return t ? fn(s, t) : s;
    }));

  const actions: SampleActions & { markNotificationsSeen: () => Promise<void> } = {
    startTrial: async (sampleId) =>
      updateSample(sampleId, (s) => ({
        ...s,
        status: "DALAM_PROSES",
        trials: [...s.trials, { id: `t-${Date.now()}`, trialNo: s.trials.length + 1, status: "BERJALAN", decision: "PENDING", notes: null, rejectNote: null }],
      })),
    finishTrial: async (trialId, notes) =>
      updateTrial(trialId, (s, t) => ({
        ...s,
        status: "MENUNGGU_APPROVAL",
        trials: s.trials.map((x) => (x.id === t.id ? { ...x, status: "SELESAI", notes } : x)),
      })),
    approve: async (trialId) =>
      updateTrial(trialId, (s, t) => ({
        ...s,
        status: "DISETUJUI",
        trials: s.trials.map((x) => (x.id === t.id ? { ...x, decision: "APPROVED" } : x)),
      })),
    reject: async (trialId, note) =>
      updateTrial(trialId, (s, t) => ({
        ...s,
        status: "MATCHING_ULANG",
        trials: s.trials.map((x) => (x.id === t.id ? { ...x, decision: "REJECTED", rejectNote: note } : x)),
      })),
    changeDueDate: async (sampleId, dueDate) => updateSample(sampleId, (s) => ({ ...s, dueDate })),
    setUrgent: async (sampleId, urgent) => updateSample(sampleId, (s) => ({ ...s, isUrgent: urgent })),
    markNotificationsSeen: async () => setSeenAt((m) => ({ ...m, [role.code]: new Date().toISOString() })),
  };

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-amber-900">
          <p>
            <span className="font-semibold">Mode demo</span> · data contoh tersimpan di browser dan kembali ke awal saat halaman dimuat ulang.
          </p>
          <label className="flex items-center gap-2">
            <span className="font-medium">Login sebagai</span>
            <select
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-slate-800"
            >
              {ROLES.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.viewMode.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setSamples(seedSamples())} className="rounded-md px-2 py-1 font-medium hover:bg-amber-100">
            Reset data
          </button>
        </div>
      </div>
      {/* key: reset filter & tab default saat role berganti */}
      <DashboardClient key={role.code} user={user} rows={rows} notifs={notifs} machines={MACHINES} actions={actions} />
    </>
  );
}
