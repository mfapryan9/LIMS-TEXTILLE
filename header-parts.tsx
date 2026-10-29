"use client";

import { useState } from "react";
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
  LATE: "bg-red-500",
  URGENT: "bg-fuchsia-500",
  NEAR_DEADLINE: "bg-amber-400",
  NEW: "bg-sky-400",
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
  const unread = notifs.filter((n) => n.unread).length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md px-3 py-1.5 text-sm text-indigo-50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Notifikasi
        {unread > 0 && (
          <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">{unread}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[92vw] rounded-lg bg-white text-slate-900 shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">{notifs.length} pemberitahuan</p>
            <button type="button" onClick={onMarkSeen} className="text-xs text-indigo-700 hover:underline">
              Tandai sudah dibaca
            </button>
          </div>
          <ul className="max-h-96 divide-y overflow-auto">
            {notifs.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Tidak ada yang perlu perhatian saat ini.</li>}
            {notifs.map((n) => (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSample(n.sampleId);
                    setOpen(false);
                  }}
                  className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTIF_DOT[n.type]}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {n.title} {n.unread && <span className="sr-only">(belum dibaca)</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
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

const STAT_ORDER: SampleStatusKey[] = ["MENUNGGU", "DALAM_PROSES", "MENUNGGU_APPROVAL", "DISETUJUI", "MATCHING_ULANG"];
const STAT_BAR: Record<SampleStatusKey, string> = {
  MENUNGGU: "bg-slate-400",
  DALAM_PROSES: "bg-sky-500",
  MENUNGGU_APPROVAL: "bg-violet-500",
  DISETUJUI: "bg-emerald-500",
  MATCHING_ULANG: "bg-orange-500",
};

export function StatsStrip({
  rows,
  active,
  onPick,
}: {
  rows: SampleRow[];
  active: SampleStatusKey | "ALL";
  onPick: (s: SampleStatusKey | "ALL") => void;
}) {
  const count = (s: SampleStatusKey) => rows.filter((r) => r.status === s).length;
  return (
    <section aria-label="Ringkasan status" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatCell label="Semua sampel" value={rows.length} bar="bg-indigo-900" selected={active === "ALL"} onClick={() => onPick("ALL")} />
      {STAT_ORDER.map((s) => (
        <StatCell
          key={s}
          label={s === "MATCHING_ULANG" ? "Rework" : s === "MENUNGGU" ? "Total menunggu" : STATUS_LABEL[s]}
          value={count(s)}
          bar={STAT_BAR[s]}
          selected={active === s}
          onClick={() => onPick(s)}
        />
      ))}
    </section>
  );
}

function StatCell({ label, value, bar, selected, onClick }: { label: string; value: number; bar: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`overflow-hidden rounded-lg bg-white text-left ring-1 transition ${selected ? "ring-2 ring-indigo-700" : "ring-slate-200 hover:ring-slate-400"}`}
    >
      <span className={`block h-1 ${bar}`} />
      <span className="block px-3 py-2">
        <span className="block text-2xl font-semibold tabular-nums">{value}</span>
        <span className="block text-xs text-slate-600">{label}</span>
      </span>
    </button>
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
    if (q && ![r.spkNo, r.customerName, r.motif, r.colorCode, r.colorDirection].some((v) => v.toLowerCase().includes(q))) return false;
    return true; // urutan CR dipertahankan dari server (sortByPriority)
  });
}

const field = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600";

export function FilterBar({
  value,
  onChange,
  machines,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  machines: { id: string; name: string }[];
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={value.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Cari SPK, customer, motif, kode warna"
        aria-label="Cari sampel"
        className={`${field} min-w-[16rem] flex-1`}
      />
      <select aria-label="Urgensi" value={value.urgency} onChange={(e) => set("urgency", e.target.value as Filters["urgency"])} className={field}>
        <option value="ALL">Semua urgensi</option>
        <option value="LATE">Terlambat</option>
        <option value="WARNING">Mendesak</option>
        <option value="URGENT">Ditandai urgent</option>
      </select>
      <select aria-label="Jenis order" value={value.orderType} onChange={(e) => set("orderType", e.target.value as Filters["orderType"])} className={field}>
        <option value="ALL">Produksi & Marketing</option>
        <option value="PRODUKSI">Produksi</option>
        <option value="MARKETING">Marketing</option>
      </select>
      <select aria-label="Mesin" value={value.machineId} onChange={(e) => set("machineId", e.target.value)} className={field}>
        <option value="ALL">Semua mesin</option>
        {machines.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="rounded-md px-2.5 py-1.5 text-sm text-indigo-800 hover:bg-indigo-50">
        Reset filter
      </button>
    </div>
  );
}
