"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, CheckCircle2, ClipboardCheck, FlaskConical, Hourglass, Layers, RotateCcw, Search, type LucideIcon } from "lucide-react";
import type { Notif, NotifType } from "@/lib/roles";
import { STATUS_LABEL, type SampleRow } from "./badges";
import type { SampleStatusKey } from "@/lib/cr";

/* ───────── Notifikasi di header (FR-10) ───────── */

const NOTIF_LABEL: Record<NotifType, string> = {
  LATE: "Terlambat",
  URGENT: "Urgent",
  NEAR_DEADLINE: "Mendekati deadline",
  NEW: "Baru masuk",
};
const NOTIF_DOT: Record<NotifType, string> = {
  LATE: "bg-rose-500",
  URGENT: "bg-fuchsia-500",
  NEAR_DEADLINE: "bg-amber-400",
  NEW: "bg-brand-500",
};

export function NotificationBell({
  notifs,
  onOpenSample,
  onMarkSeen,
}: {
  notifs: Notif[];
  onOpenSample: (id: string) => void;
  onMarkSeen: () => void; // server action: set users.notificationsSeenAt = now()
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((n) => n.unread).length;

  // Tutup saat klik di luar panel
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-muted ring-1 ring-line transition hover:text-ink hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 z-30 mt-2 w-[24rem] max-w-[92vw] animate-fade-up overflow-hidden rounded-2xl bg-white text-ink shadow-soft ring-1 ring-line">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">
              Notifikasi <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">{notifs.length}</span>
            </p>
            <button type="button" onClick={onMarkSeen} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Tandai sudah dibaca
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-auto border-t border-line">
            {notifs.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-soft">Tidak ada yang perlu perhatian saat ini.</li>}
            {notifs.map((n) => (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSample(n.sampleId);
                    setOpen(false);
                  }}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-canvas ${n.unread ? "bg-brand-50/40" : ""}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTIF_DOT[n.type]}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {n.title} {n.unread && <span className="sr-only">(belum dibaca)</span>}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {NOTIF_LABEL[n.type]} · {n.detail}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────── Ringkasan status (FR-13) ───────── */

const STATS: { key: SampleStatusKey | "ALL"; label: string; icon: LucideIcon; tone: string }[] = [
  { key: "ALL", label: "Semua sampel", icon: Layers, tone: "bg-brand-50 text-brand-700" },
  { key: "MENUNGGU", label: "Menunggu", icon: Hourglass, tone: "bg-slate-100 text-slate-600" },
  { key: "DALAM_PROSES", label: "Dalam proses", icon: FlaskConical, tone: "bg-sky-50 text-sky-600" },
  { key: "MENUNGGU_APPROVAL", label: STATUS_LABEL.MENUNGGU_APPROVAL, icon: ClipboardCheck, tone: "bg-violet-50 text-violet-600" },
  { key: "DISETUJUI", label: STATUS_LABEL.DISETUJUI, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  { key: "MATCHING_ULANG", label: "Rework", icon: RotateCcw, tone: "bg-orange-50 text-orange-600" },
];

export function StatsStrip({
  rows,
  active,
  onPick,
}: {
  rows: SampleRow[];
  active: SampleStatusKey | "ALL";
  onPick: (s: SampleStatusKey | "ALL") => void;
}) {
  const count = (s: SampleStatusKey | "ALL") => (s === "ALL" ? rows.length : rows.filter((r) => r.status === s).length);
  return (
    <section aria-label="Ringkasan status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {STATS.map(({ key, label, icon: Icon, tone }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            aria-pressed={selected}
            className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-card ring-1 transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
              selected ? "ring-2 ring-brand-500" : "ring-line"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-bold leading-none tabular-nums text-ink">{count(key)}</span>
              <span className="mt-1 block truncate text-xs font-medium text-ink-muted">{label}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

/* ───────── Filter & pencarian ───────── */

export interface Filters {
  q: string;
  status: SampleStatusKey | "ALL";
  urgency: "ALL" | "LATE" | "WARNING" | "URGENT";
  orderType: "ALL" | "PRODUKSI" | "MARKETING";
  machineId: string; // "ALL" atau id
}

export const DEFAULT_FILTERS: Filters = { q: "", status: "ALL", urgency: "ALL", orderType: "ALL", machineId: "ALL" };

export function applyFilters(rows: SampleRow[], f: Filters): SampleRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== "ALL" && r.status !== f.status) return false;
    if (f.orderType !== "ALL" && r.orderType !== f.orderType) return false;
    if (f.machineId !== "ALL" && r.machineId !== f.machineId) return false;
    if (f.urgency === "URGENT" && !r.isUrgent) return false;
    if ((f.urgency === "LATE" || f.urgency === "WARNING") && r.urgency !== f.urgency) return false;
    if (q && ![r.spkNo, r.orderNo, r.processName, r.customerName, r.motif, r.colorCode, r.colorDirection].some((v) => v?.toLowerCase().includes(q))) return false;
    return true; // urutan CR dipertahankan dari server (sortByPriority)
  });
}

export const fieldCls =
  "rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink shadow-card placeholder:text-ink-soft transition focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100";

export function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <span className="relative min-w-[16rem] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          type="search"
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Cari SPK, no. order, proses, customer, kode warna"
          aria-label="Cari sampel"
          className={`${fieldCls} w-full pl-10`}
        />
      </span>
      <select aria-label="Urgensi" value={value.urgency} onChange={(e) => set("urgency", e.target.value as Filters["urgency"])} className={fieldCls}>
        <option value="ALL">Semua urgensi</option>
        <option value="LATE">Terlambat</option>
        <option value="WARNING">Mendesak</option>
        <option value="URGENT">Ditandai urgent</option>
      </select>
      <select aria-label="Jenis order" value={value.orderType} onChange={(e) => set("orderType", e.target.value as Filters["orderType"])} className={fieldCls}>
        <option value="ALL">Produksi & Marketing</option>
        <option value="PRODUKSI">Produksi</option>
        <option value="MARKETING">Marketing</option>
      </select>
      {/* Kelompok mesin dipilih lewat tab sheet di atas; reset tetap mengembalikan ke "Semua kelompok" */}
      <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
        <RotateCcw className="h-4 w-4" aria-hidden /> Reset filter
      </button>
    </div>
  );
}

/* ───────── Kelompok mesin = sheet Excel (A. Thermosol, B. CPB, …) ───────── */

export interface MachineGroup {
  id: string;
  name: string; // nama sheet, mis. "A. Thermosol"
  p: number | null; // processing time kelompok (hari)
  processes: string[]; // proses lab dalam kelompok ini
}

/** Tab per kelompok mesin seperti sheet di Excel. Angka = sampel aktif (belum ACC) di kelompok itu. */
export function MachineGroupTabs({
  groups,
  rows,
  value,
  onChange,
}: {
  groups: MachineGroup[];
  rows: SampleRow[];
  value: string; // "ALL" atau id mesin
  onChange: (id: string) => void;
}) {
  const inGroup = (r: SampleRow, id: string) => id === "ALL" || r.machineId === id;
  const active = (id: string) => rows.filter((r) => r.status !== "DISETUJUI" && inGroup(r, id)).length;
  const urgent = (id: string) => rows.filter((r) => r.isUrgent && r.status !== "DISETUJUI" && inGroup(r, id)).length;

  const tab = (id: string, name: string, sub: string, title?: string) => {
    const sel = value === id;
    const u = urgent(id);
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={sel}
        onClick={() => onChange(id)}
        title={title}
        className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
          sel ? "bg-ink text-white shadow-soft" : "text-ink-muted hover:bg-white hover:text-ink hover:shadow-card"
        }`}
      >
        <span className="leading-tight">
          <span className="block whitespace-nowrap text-sm font-semibold">{name}</span>
          <span className={`block whitespace-nowrap text-[11px] ${sel ? "text-white/60" : "text-ink-soft"}`}>{sub}</span>
        </span>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${sel ? "bg-white/15 text-white" : "bg-canvas text-ink-muted ring-1 ring-line"}`} title="Sampel aktif">
          {active(id)}
        </span>
        {u > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-600 px-1 text-[10px] font-bold text-white" title={`${u} urgent`}>
            {u}
          </span>
        )}
      </button>
    );
  };

  return (
    <div role="tablist" aria-label="Kelompok mesin" className="scrollbar-thin flex gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1.5 ring-1 ring-line backdrop-blur">
      {tab("ALL", "Semua kelompok", `${groups.length} kelompok mesin`)}
      {groups.map((g) => tab(g.id, g.name, g.p != null ? `p ${+g.p.toFixed(2)} hr` : "p belum diatur", g.processes.join(", ")))}
    </div>
  );
}
