"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlarmClock, CalendarRange, CheckCircle2, Clock3, FlaskConical, Hourglass, Inbox, Layers, Target, Zap, type LucideIcon } from "lucide-react";
import { todayJakarta } from "@/lib/cr";
import { buildReport, fmtHours, inRange, type GroupStat } from "@/lib/report";
import type { SheetSpec } from "@/lib/export-xlsx";
import { MachineChip, STATUS_LABEL, type SampleRow } from "./badges";
import { fieldCls, type MachineGroup } from "./header-parts";
import { ExportButton, fileStamp, rowsSheet } from "./ExportButton";
import { fmtDate, fmtStamp, waitHours } from "./SampleTable";

const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");
const days = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)} hari`);

/** Laporan kinerja lab dengan rentang tanggal pengajuan yang bisa diatur (dari – sampai). */
export function ReportPanel({ rows, groups }: { rows: SampleRow[]; groups: MachineGroup[] }) {
  const today = todayJakarta();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const presets: { label: string; from: string; to: string }[] = [
    { label: "Hari ini", from: today, to: today },
    { label: "7 hari", from: shift(today, -6), to: today },
    { label: "30 hari", from: shift(today, -29), to: today },
    { label: "Bulan ini", from: `${today.slice(0, 8)}01`, to: today },
    { label: "Semua data", from: "", to: "" },
  ];

  const report = useMemo(() => buildReport(rows, from, to, today), [rows, from, to, today]);
  const ranged = useMemo(() => inRange(rows, from, to), [rows, from, to]);
  const oldest = useMemo(
    () => ranged.filter((r) => r.status !== "DISETUJUI").sort((a, b) => (waitHours(b) ?? 0) - (waitHours(a) ?? 0)).slice(0, 8),
    [ranged],
  );
  const rangeLabel = from || to ? `${from ? fmtDate(from) : "awal"} – ${to ? fmtDate(to) : "sekarang"}` : "Semua data";
  const invalid = !!from && !!to && from > to;
  const machineColor = (name: string) => groups.find((g) => g.name === name)?.color ?? 0;

  const exportBuild = () => {
    const r = report;
    const statSheet = (name: string, title: string, list: GroupStat[], col: string): SheetSpec => ({
      name, title,
      columns: [{ header: col, width: 30 }, { header: "Pengajuan" }, { header: "Selesai" }, { header: "Tepat waktu" }, { header: "% tepat waktu" }, { header: "Rata-rata waktu proses", width: 22 }, { header: "Rata-rata pengajuan → selesai (hari)", width: 22 }],
      rows: list.map((g) => [g.name, g.total, g.done, g.onTime, pct(g.onTime, g.done), fmtHours(g.avgProcessHours), g.avgLabDays === null ? null : +g.avgLabDays.toFixed(1)]),
    });
    return {
      filename: `DyeLIMS-laporan-kinerja-${from || "awal"}_${to || fileStamp()}`,
      sheets: [
        {
          name: "Ringkasan",
          title: `Laporan kinerja lab DyeLIMS · periode pengajuan ${rangeLabel}`,
          columns: [{ header: "Indikator", width: 40 }, { header: "Nilai", width: 22 }],
          rows: [
            ["Total pengajuan", r.total],
            ["Pengajuan urgent", r.urgent],
            ["Pengajuan masuk (belum diproses)", r.waiting],
            ["Sedang diproses", r.inProcess],
            ["Selesai", r.done],
            ["Selesai tepat waktu (≤ due date)", r.onTime],
            ["Selesai terlambat", r.late],
            ["% tepat waktu", pct(r.onTime, r.done)],
            ["Belum selesai & lewat due date", r.overdueOpen],
            ["Rata-rata menunggu sebelum diproses", fmtHours(r.avgWaitHours)],
            ["Rata-rata waktu proses", fmtHours(r.avgProcessHours)],
            ["Rata-rata pengajuan → selesai", days(r.avgLabDays)],
            ["Dicetak", fmtStamp(new Date().toISOString())],
          ],
        },
        statSheet("Per grup pemroses", `Kinerja per grup pemroses · ${rangeLabel}`, r.byProcessor, "Grup pemroses"),
        statSheet("Per kelompok mesin", `Kinerja per kelompok mesin · ${rangeLabel}`, r.byMachine, "Kelompok mesin"),
        rowsSheet("Detail pengajuan", ranged, `Detail pengajuan · ${rangeLabel}`),
      ],
    };
  };

  return (
    <section className="space-y-5" aria-label="Laporan kinerja">
      {/* Rentang tanggal */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><CalendarRange className="h-5 w-5" aria-hidden /></span>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Dari tanggal</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Sampai tanggal</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rentang cepat">
          {presets.map((p) => {
            const sel = p.from === from && p.to === to;
            return (
              <button key={p.label} type="button" aria-pressed={sel} onClick={() => { setFrom(p.from); setTo(p.to); }}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${sel ? "bg-brand-600 text-white" : "text-ink-muted ring-1 ring-line hover:bg-canvas"}`}>
                {p.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto"><ExportButton label="Unduh laporan Excel" build={exportBuild} /></span>
        <p className="basis-full text-xs text-ink-soft">
          Berdasarkan tanggal pengajuan (WIB): <span className="font-semibold text-ink">{rangeLabel}</span>
          {invalid && <span role="alert" className="ml-2 font-semibold text-rose-600">Tanggal awal setelah tanggal akhir</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Layers} tone="bg-brand-50 text-brand-700" label="Total pengajuan" value={String(report.total)} sub={`${report.urgent} urgent`} />
        <Kpi icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Selesai" value={String(report.done)} sub={`${pct(report.done, report.total)} dari pengajuan`} />
        <Kpi icon={Target} tone="bg-emerald-50 text-emerald-700" label="Tepat waktu" value={pct(report.onTime, report.done)} sub={`${report.onTime} tepat · ${report.late} terlambat`} />
        <Kpi icon={AlarmClock} tone="bg-rose-50 text-rose-600" label="Lewat due date (belum selesai)" value={String(report.overdueOpen)} sub={`${report.waiting} menunggu · ${report.inProcess} diproses`} />
        <Kpi icon={Hourglass} tone="bg-slate-100 text-slate-600" label="Rata-rata menunggu diproses" value={fmtHours(report.avgWaitHours)} sub="pengajuan → mulai proses" />
        <Kpi icon={FlaskConical} tone="bg-sky-50 text-sky-600" label="Rata-rata waktu proses" value={fmtHours(report.avgProcessHours)} sub="mulai proses → selesai" />
        <Kpi icon={Clock3} tone="bg-violet-50 text-violet-600" label="Rata-rata sampai selesai" value={days(report.avgLabDays)} sub="pengajuan → selesai" />
        <Kpi icon={Zap} tone="bg-fuchsia-50 text-fuchsia-600" label="Pengajuan urgent" value={String(report.urgent)} sub={pct(report.urgent, report.total) + " dari pengajuan"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <StatTable title="Kinerja per grup pemroses" col="Grup pemroses" list={report.byProcessor} empty="Belum ada pengajuan yang diproses pada periode ini." />
        <StatTable title="Kinerja per kelompok mesin" col="Kelompok mesin" list={report.byMachine} empty="Tidak ada pengajuan pada periode ini." renderName={(n) => <MachineChip name={n} color={machineColor(n)} />} />
      </div>

      <div className="rounded-2xl bg-white shadow-card ring-1 ring-line">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Order terlama yang belum selesai</h2>
        {oldest.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-soft"><Inbox className="h-4 w-4" aria-hidden /> Semua pengajuan pada periode ini sudah selesai.</p>
        ) : (
          <ul className="divide-y divide-line">
            {oldest.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-semibold text-ink">Order {r.orderNo ?? r.spkNo}</span>
                  <span className="text-ink-muted">{r.colorCode ? ` · CM ${r.colorCode}` : ""}{r.customerName ? ` · ${r.customerName}` : ""}</span>
                  <span className="block text-xs text-ink-soft">{STATUS_LABEL[r.status]}{r.processorName ? ` · ${r.processorName}` : ""} · diajukan {fmtStamp(r.createdAt)}</span>
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200" suppressHydrationWarning>
                  {r.status === "MENUNGGU" ? "Belum diproses" : "Diproses"} {fmtHours(waitHours(r))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatTable({ title, col, list, empty, renderName }: { title: string; col: string; list: GroupStat[]; empty: string; renderName?: (name: string) => ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
      <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{title}</h2>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-soft">{empty}</p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface/60 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-2.5">{col}</th>
                <th scope="col" className="px-3 py-2.5 text-right">Pengajuan</th>
                <th scope="col" className="px-3 py-2.5 text-right">Selesai</th>
                <th scope="col" className="px-3 py-2.5 text-right">Tepat waktu</th>
                <th scope="col" className="px-3 py-2.5 text-right">Rata-rata proses</th>
                <th scope="col" className="px-4 py-2.5 text-right">Sampai selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((g) => (
                <tr key={g.name}>
                  <td className="px-4 py-2.5 font-medium text-ink">{renderName ? renderName(g.name) : g.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.done}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{pct(g.onTime, g.done)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{fmtHours(g.avgProcessHours)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{days(g.avgLabDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: LucideIcon; tone: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-none tabular-nums text-ink">{value}</span>
        <span className="mt-1 block text-xs font-medium text-ink-muted">{label}</span>
        <span className="block truncate text-[11px] text-ink-soft">{sub}</span>
      </span>
    </div>
  );
}
