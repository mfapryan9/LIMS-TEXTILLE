"use client";

import Image from "next/image";
import { BadgeCheck, CalendarDays, ListChecks, LogOut, RefreshCw, ScanLine, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Notif, SessionUser, ViewMode } from "@/lib/roles";
import { VIEW_DEFAULT_STATUSES } from "@/lib/roles";
import { defaultDueDate, todayJakarta, type SampleStatusKey } from "@/lib/cr";
import type { SampleFormResult, SampleInput } from "@/lib/sample-input";
import { initials, type SampleRow } from "./badges";
import { applyFilters, DEFAULT_FILTERS, FilterBar, MachineGroupTabs, NotificationBell, StatsStrip, type Filters, type MachineGroup } from "./header-parts";
import { ResultsTable } from "./ResultsTable";
import { SampleForm } from "./SampleForm";
import { fmtDate, SampleTable, type SampleActions } from "./SampleTable";

const VIEW_COPY: Record<ViewMode, { title: string; hint: string }> = {
  OPERATOR: { title: "Antrean kerja lab", hint: "Kerjakan dari atas ke bawah: sampel URGENT paling atas, lalu Critical Ratio terkecil." },
  APPROVER: { title: "Menunggu approval", hint: "ACC hasil matching warna atau kirim kembali untuk rework. Tambah dan edit SPK juga tersedia." },
  PLANNER: { title: "Kesiapan sampel", hint: "Tambah SPK, pantau kesiapan, ubah due date, atau tandai sampel urgent." },
  MONITOR: { title: "Monitoring sampel", hint: "Tampilan hanya-lihat untuk seluruh antrean lab." },
};

type Option = { id: string; name: string };

export interface SampleEditor {
  processTypes: Option[];
  processMachine: Record<string, string>; // proses → mesin (kelompok sheet Excel), untuk isi otomatis
  create: (input: SampleInput) => Promise<SampleFormResult>;
  update: (sampleId: string, input: SampleInput) => Promise<SampleFormResult>;
}

const toInput = (r: SampleRow): SampleInput => ({
  orderType: r.orderType, orderNo: r.orderNo ?? "", orderDate: r.orderDate ?? "", spkNo: r.spkNo,
  customerName: r.customerName ?? "", motif: r.motif ?? "", colorDirection: r.colorDirection ?? "", colorCode: r.colorCode ?? "",
  processTypeId: r.processTypeId, machineId: r.machineId,
  fabricProblem: r.fabricProblem ?? "", problemDescription: r.problemDescription ?? "",
  receivedDate: r.receivedDate, dueDate: r.dueDate,
});

export function DashboardClient(props: {
  user: SessionUser;
  rows: SampleRow[]; // sudah di-enrich CR & diurutkan di server (sortByPriority)
  notifs: Notif[];
  machines: MachineGroup[]; // kelompok mesin = sheet Excel, urut A–E
  actions: SampleActions & { markNotificationsSeen: () => Promise<void> };
  editor?: SampleEditor; // tambah / edit SPK (hanya untuk role yang berhak)
  onLogout?: () => Promise<void>;
}) {
  const { user, rows, notifs, machines, actions, editor, onLogout } = props;
  const copy = VIEW_COPY[user.viewMode];
  const canEdit = !!editor && user.canEditSample;
  const showResults = user.viewMode !== "OPERATOR";
  const [tab, setTab] = useState<"queue" | "results">("queue");
  const router = useRouter();

  // CR dihitung terhadap "hari ini": muat ulang data berkala & saat tab kembali aktif,
  // sehingga CR, sisa hari, dan urutan ikut berubah saat tanggal berganti.
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  // Tab default per role: operator → antrean aktif, approver → menunggu approval, lainnya → semua
  const defaultStatuses = VIEW_DEFAULT_STATUSES[user.viewMode];
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    status: defaultStatuses !== "ALL" && defaultStatuses.length === 1 ? (defaultStatuses[0] as SampleStatusKey) : "ALL",
  });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [form, setForm] = useState<null | { mode: "create" } | { mode: "edit"; row: SampleRow }>(null);

  // Kelompok mesin (sheet) yang dipilih: ringkasan status & tabel hanya untuk kelompok itu
  const groupRows = useMemo(() => (filters.machineId === "ALL" ? rows : rows.filter((r) => r.machineId === filters.machineId)), [rows, filters.machineId]);

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
      orderNo: "", orderDate: "", spkNo: "", customerName: "", motif: "", colorDirection: "", colorCode: "",
      processTypeId: "", machineId: "", fabricProblem: "", problemDescription: "",
      receivedDate: today, dueDate: defaultDueDate(today),
    };
  };

  const doneCount = rows.filter((r) => r.status === "DISETUJUI").length;
  const activeCount = rows.length - doneCount;
  const urgentCount = rows.filter((r) => r.isUrgent && r.status !== "DISETUJUI").length;
  const nav = [
    { key: "queue" as const, label: "Antrean uji", icon: ListChecks, count: activeCount },
    ...(showResults ? [{ key: "results" as const, label: "Hasil uji selesai", icon: BadgeCheck, count: doneCount }] : []),
  ];
  const roleLabel = user.roleCode.replaceAll("_", " ").toLowerCase();

  return (
    <div className="min-h-screen bg-canvas text-ink xl:pl-64">
      {/* ── Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white xl:flex">
        <div className="flex items-center gap-3 px-6 py-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 shadow-glow">
            <Image src="/logo-emblem-white.png" alt="Logo PT Nagasakti Kurnia Textile Mills" width={28} height={28} priority className="h-7 w-7" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-ink">NAGASAKTI</p>
            <p className="text-xs text-ink-soft">Kurnia Textile Mills</p>
          </div>
        </div>

        <p className="px-6 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Lab Color Matching</p>
        <div role="tablist" aria-label="Menu" aria-orientation="vertical" className="space-y-1 px-3">
          {nav.map(({ key, label, icon: Icon, count }) => {
            const sel = tab === key;
            return (
              <button key={key} type="button" role="tab" aria-selected={sel} onClick={() => setTab(key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${sel ? "bg-brand-50 text-brand-800" : "text-ink-muted hover:bg-canvas hover:text-ink"}`}>
                <Icon className={`h-[18px] w-[18px] ${sel ? "text-brand-600" : ""}`} aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${sel ? "bg-white text-brand-700 ring-1 ring-brand-200" : "bg-canvas text-ink-soft"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {urgentCount > 0 && (
          <button type="button" onClick={() => { setTab("queue"); setFilters({ ...DEFAULT_FILTERS, urgency: "URGENT" }); }}
            className="mx-3 mt-6 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-500 p-4 text-left text-white shadow-[0_10px_30px_-10px_rgba(192,38,211,0.6)] transition hover:brightness-105">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Zap className="h-5 w-5 fill-white" aria-hidden /></span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{urgentCount} sampel urgent</span>
              <span className="block text-xs text-white/80">Lihat & kerjakan lebih dulu</span>
            </span>
          </button>
        )}

        <div className="mt-auto border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">{initials(user.name)}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
              <span className="block truncate text-xs capitalize text-ink-soft">{roleLabel}</span>
            </span>
            {onLogout && (
              <form action={onLogout}>
                <button type="submit" aria-label="Keluar" title="Keluar" className="rounded-lg p-2 text-ink-soft transition hover:bg-white hover:text-rose-600">
                  <LogOut className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>

      {/* ── Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logo-emblem.png" alt="Logo PT Nagasakti Kurnia Textile Mills" width={36} height={36} priority className="h-9 w-9 shrink-0 xl:hidden" />
            <div className="min-w-0 leading-tight">
              <p className="hidden text-xs font-medium text-ink-soft sm:block">PT. Nagasakti Kurnia Textile Mills · LIMS</p>
              <p className="truncate text-sm font-semibold text-ink sm:text-base">{tab === "results" ? "Hasil uji selesai" : copy.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-ink-muted ring-1 ring-line md:inline-flex">
              <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden /> {todayLabel()}
            </span>
            <NotificationBell
              notifs={notifs}
              onMarkSeen={() => actions.markNotificationsSeen()}
              onOpenSample={(id) => {
                setFilters(DEFAULT_FILTERS); // pastikan baris tidak tersaring
                setTab("queue");
                setHighlight(id);
              }}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => setForm({ mode: "create" })}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <ScanLine className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Tambah SPK</span>
                <span className="sm:hidden">SPK</span>
              </button>
            )}
            {onLogout && (
              <form action={onLogout} className="xl:hidden">
                <button type="submit" aria-label="Keluar" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-muted ring-1 ring-line">
                  <LogOut className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[96rem] space-y-6 px-4 py-6 sm:px-6 xl:px-8">
        {/* Judul halaman */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{tab === "results" ? "Hasil uji selesai" : copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            {tab === "results"
              ? "Sampel yang sudah di-ACC: jumlah uji/matching dengan master, ACC pada uji ke berapa, dan durasi sejak masuk lab."
              : copy.hint}
          </p>
          {tab === "queue" && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> CR dihitung terhadap hari ini ({fmtDate(todayJakarta())}) dan diperbarui otomatis
            </p>
          )}
        </div>

        {/* Menu tampilan (layar < 1280px; desktop memakai sidebar) */}
        {showResults && (
          <div role="tablist" aria-label="Tampilan" className="inline-flex rounded-xl bg-white p-1 shadow-card ring-1 ring-line xl:hidden">
            {nav.map(({ key, label, count }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${tab === key ? "bg-ink text-white" : "text-ink-muted hover:text-ink"}`}>
                {label} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        )}

        {tab === "results" ? (
          <ResultsTable rows={rows} groups={machines} />
        ) : (
          <>
            <MachineGroupTabs groups={machines} rows={rows} value={filters.machineId} onChange={(machineId) => setFilters((f) => ({ ...f, machineId }))} />

            <StatsStrip rows={groupRows} active={filters.status} onPick={(status) => setFilters((f) => ({ ...f, status }))} />

            <div className="space-y-3">
              <FilterBar value={filters} onChange={setFilters} />
              <p className="text-xs font-medium text-ink-soft" aria-live="polite">
                Menampilkan {visible.length} dari {groupRows.length} sampel
                {filters.machineId !== "ALL" && ` di ${machines.find((m) => m.id === filters.machineId)?.name ?? "kelompok ini"}`}
              </p>
            </div>

            <SampleTable rows={visible} user={user} actions={actions} highlightId={highlight} onEdit={canEdit ? (row) => setForm({ mode: "edit", row }) : undefined} />
          </>
        )}
      </main>

      {form && editor && (
        <SampleForm
          key={form.mode === "edit" ? form.row.id : "create"}
          mode={form.mode}
          initial={form.mode === "edit" ? toInput(form.row) : blank()}
          processTypes={editor.processTypes}
          processMachine={editor.processMachine}
          machines={machines}
          onSubmit={(input) => (form.mode === "edit" ? editor.update(form.row.id, input) : editor.create(input))}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const todayLabel = () => dayFmt.format(new Date());