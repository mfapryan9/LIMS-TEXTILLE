"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Notif, SessionUser, ViewMode } from "@/lib/roles";
import { VIEW_DEFAULT_STATUSES } from "@/lib/roles";
import { defaultDueDate, todayJakarta, type SampleStatusKey } from "@/lib/cr";
import type { SampleFormResult, SampleInput } from "@/lib/sample-input";
import type { SampleRow } from "./badges";
import { applyFilters, DEFAULT_FILTERS, FilterBar, NotificationBell, StatsStrip, type Filters } from "./header-parts";
import { SampleForm } from "./SampleForm";
import { SampleTable, type SampleActions } from "./SampleTable";

const VIEW_COPY: Record<ViewMode, { title: string; hint: string }> = {
  OPERATOR: { title: "Antrean kerja lab", hint: "Kerjakan dari atas ke bawah. Urutan mengikuti Critical Ratio terkecil." },
  APPROVER: { title: "Menunggu approval", hint: "Setujui hasil matching atau kirim kembali untuk rework." },
  PLANNER: { title: "Kesiapan sampel", hint: "Tambah SPK, pantau kesiapan, ubah due date, atau tandai sampel urgent." },
  MONITOR: { title: "Monitoring sampel", hint: "Tampilan hanya-lihat untuk seluruh antrean lab." },
};

type Option = { id: string; name: string };

export interface SampleEditor {
  processTypes: Option[];
  create: (input: SampleInput) => Promise<SampleFormResult>;
  update: (sampleId: string, input: SampleInput) => Promise<SampleFormResult>;
}

const toInput = (r: SampleRow): SampleInput => ({
  orderType: r.orderType, spkNo: r.spkNo, customerName: r.customerName, motif: r.motif,
  colorDirection: r.colorDirection, colorCode: r.colorCode, processTypeId: r.processTypeId, machineId: r.machineId,
  fabricProblem: r.fabricProblem ?? "", problemDescription: r.problemDescription ?? "",
  receivedDate: r.receivedDate, dueDate: r.dueDate,
});

export function DashboardClient(props: {
  user: SessionUser;
  rows: SampleRow[]; // sudah di-enrich CR & diurutkan di server (sortByPriority)
  notifs: Notif[];
  machines: Option[];
  actions: SampleActions & { markNotificationsSeen: () => Promise<void> };
  editor?: SampleEditor; // tambah / edit SPK (hanya untuk role yang berhak)
  onLogout?: () => Promise<void>;
}) {
  const { user, rows, notifs, machines, actions, editor, onLogout } = props;
  const copy = VIEW_COPY[user.viewMode];
  const canEdit = !!editor && user.canEditDue;

  // Tab default per role: operator → antrean aktif, approver → menunggu approval, lainnya → semua
  const defaultStatuses = VIEW_DEFAULT_STATUSES[user.viewMode];
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    status: defaultStatuses !== "ALL" && defaultStatuses.length === 1 ? (defaultStatuses[0] as SampleStatusKey) : "ALL",
  });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [form, setForm] = useState<null | { mode: "create" } | { mode: "edit"; row: SampleRow }>(null);

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

  const blank = (): SampleInput => {
    const today = todayJakarta();
    return {
      orderType: user.roleCode.includes("MARKETING") ? "MARKETING" : "PRODUKSI",
      spkNo: "", customerName: "", motif: "", colorDirection: "", colorCode: "",
      processTypeId: "", machineId: "", fabricProblem: "", problemDescription: "",
      receivedDate: today, dueDate: defaultDueDate(today),
    };
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logo-emblem.png" alt="Logo PT Nagasakti Kurnia Textile Mills" width={40} height={40} priority className="h-10 w-10 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold tracking-wide text-ink">
                <span className="sm:hidden">NAGASAKTI</span>
                <span className="hidden sm:inline">PT. NAGASAKTI KURNIA TEXTILE MILLS</span>
              </p>
              <p className="truncate text-xs text-brand-700">LIMS Lab Color Matching</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <NotificationBell
              notifs={notifs}
              onMarkSeen={() => actions.markNotificationsSeen()}
              onOpenSample={(id) => {
                setFilters(DEFAULT_FILTERS); // pastikan baris tidak tersaring
                setHighlight(id);
              }}
            />
            <div className="hidden items-center gap-2 sm:flex">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <p className="text-xs leading-tight">
                <span className="block font-medium text-ink">{user.name}</span>
                <span className="block text-ink-muted">{user.roleCode.replaceAll("_", " ").toLowerCase()}</span>
              </p>
            </div>
            {onLogout && (
              <form action={onLogout}>
                <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">
                  Keluar
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[90rem] space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{copy.title}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{copy.hint}</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setForm({ mode: "create" })}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h2l1.2-1.5h4.6L13.5 5h2A1.5 1.5 0 0 1 17 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" />
                <circle cx="10" cy="10.5" r="2.8" />
              </svg>
              Tambah SPK
            </button>
          )}
        </div>

        <StatsStrip rows={rows} active={filters.status} onPick={(status) => setFilters((f) => ({ ...f, status }))} />

        <FilterBar value={filters} onChange={setFilters} machines={machines} />

        <p className="text-xs text-ink-soft" aria-live="polite">
          Menampilkan {visible.length} dari {rows.length} sampel
        </p>

        <SampleTable rows={visible} user={user} actions={actions} highlightId={highlight} onEdit={canEdit ? (row) => setForm({ mode: "edit", row }) : undefined} />
      </main>

      {form && editor && (
        <SampleForm
          key={form.mode === "edit" ? form.row.id : "create"}
          mode={form.mode}
          initial={form.mode === "edit" ? toInput(form.row) : blank()}
          processTypes={editor.processTypes}
          machines={machines}
          onSubmit={(input) => (form.mode === "edit" ? editor.update(form.row.id, input) : editor.create(input))}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
