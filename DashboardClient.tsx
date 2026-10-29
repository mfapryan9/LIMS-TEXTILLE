"use client";

import { useEffect, useMemo, useState } from "react";
import type { Notif, SessionUser, ViewMode } from "@/lib/roles";
import { VIEW_DEFAULT_STATUSES } from "@/lib/roles";
import type { SampleStatusKey } from "@/lib/cr";
import type { SampleRow } from "./badges";
import { applyFilters, DEFAULT_FILTERS, FilterBar, NotificationBell, StatsStrip, type Filters } from "./header-parts";
import { SampleTable, type SampleActions } from "./SampleTable";

const VIEW_COPY: Record<ViewMode, { title: string; hint: string }> = {
  OPERATOR: { title: "Antrean kerja lab", hint: "Kerjakan dari atas ke bawah. Urutan mengikuti Critical Ratio terkecil." },
  APPROVER: { title: "Menunggu approval", hint: "Setujui hasil matching atau kirim kembali untuk rework." },
  PLANNER: { title: "Kesiapan sampel", hint: "Pantau kesiapan, ubah due date, atau tandai sampel urgent." },
  MONITOR: { title: "Monitoring sampel", hint: "Tampilan hanya-lihat untuk seluruh antrean lab." },
};

export function DashboardClient(props: {
  user: SessionUser;
  rows: SampleRow[]; // sudah di-enrich CR & diurutkan di server (sortByPriority)
  notifs: Notif[];
  machines: { id: string; name: string }[];
  actions: SampleActions & { markNotificationsSeen: () => Promise<void> };
}) {
  const { user, rows, notifs, machines, actions } = props;
  const copy = VIEW_COPY[user.viewMode];

  // Tab default per role: operator → antrean aktif, approver → menunggu approval, lainnya → semua
  const defaultStatuses = VIEW_DEFAULT_STATUSES[user.viewMode];
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    status: defaultStatuses !== "ALL" && defaultStatuses.length === 1 ? (defaultStatuses[0] as SampleStatusKey) : "ALL",
  });
  const [highlight, setHighlight] = useState<string | null>(null);

  // Operator: sembunyikan sampel DISETUJUI dari antrean kecuali dipilih eksplisit
  const scoped = useMemo(() => {
    if (user.viewMode === "OPERATOR" && filters.status === "ALL") return rows.filter((r) => r.status !== "DISETUJUI");
    return rows;
  }, [rows, user.viewMode, filters.status]);

  const visible = useMemo(() => applyFilters(scoped, filters), [scoped, filters]);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`sample-${highlight}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-indigo-950 text-white">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-base font-semibold">LIMS Lab Color Matching</p>
            <p className="text-xs text-indigo-200">PT Nagasakti</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell
              notifs={notifs}
              onMarkSeen={() => actions.markNotificationsSeen()}
              onOpenSample={(id) => {
                setFilters(DEFAULT_FILTERS); // pastikan baris tidak tersaring
                setHighlight(id);
              }}
            />
            <p className="text-right text-xs leading-tight">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-indigo-200">{user.roleCode.replaceAll("_", " ").toLowerCase()}</span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[90rem] space-y-4 px-4 py-5">
        <StatsStrip rows={rows} active={filters.status} onPick={(status) => setFilters((f) => ({ ...f, status }))} />

        <div>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="text-sm text-slate-600">{copy.hint}</p>
        </div>

        <FilterBar value={filters} onChange={setFilters} machines={machines} />

        <p className="text-xs text-slate-500" aria-live="polite">
          Menampilkan {visible.length} dari {rows.length} sampel
        </p>

        <SampleTable rows={visible} user={user} actions={actions} highlightId={highlight} />
      </main>
    </div>
  );
}
