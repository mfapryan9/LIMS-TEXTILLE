"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, FlaskConical, Inbox, Search, Target, Timer, type LucideIcon } from "lucide-react";
import { fmtDays, type SampleRow } from "./badges";
import { fieldCls, type MachineGroup } from "./header-parts";
import { fmtDate } from "./SampleTable";

/** Hasil uji yang sudah di-ACC: jumlah uji, ACC di uji ke berapa, durasi dari masuk lab, CR saat order (sama dengan Excel). */
export function ResultsTable({ rows, groups }: { rows: SampleRow[]; groups: MachineGroup[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("ALL");

  const allDone = useMemo(() => rows.filter((r) => r.status === "DISETUJUI"), [rows]);
  const done = useMemo(
    () =>
      allDone
        .filter((r) => group === "ALL" || r.machineId === group)
        .sort((a, b) => (b.approvedAt ?? "").localeCompare(a.approvedAt ?? "")),
    [allDone, group],
  );
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return done;
    return done.filter((r) =>
      [r.spkNo, r.orderNo, r.processName, r.machineName, r.customerName, r.colorCode, r.approverName].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [done, q]);

  const n = done.length;
  const avg = (f: (r: SampleRow) => number) => (n ? done.reduce((a, r) => a + f(r), 0) / n : 0);
  const firstTry = done.filter((r) => r.approvedTrialNo === 1).length;

  return (
    <section className="space-y-5" aria-label="Hasil uji selesai">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Sampel selesai (ACC)" value={String(n)} />
        <Stat icon={Timer} tone="bg-sky-50 text-sky-600" label="Rata-rata durasi di lab" value={`${avg((r) => r.labDays).toFixed(1)} hari`} />
        <Stat icon={FlaskConical} tone="bg-violet-50 text-violet-600" label="Rata-rata jumlah uji" value={`${avg((r) => r.approvedTrialNo ?? 0).toFixed(1)}×`} />
        <Stat icon={Target} tone="bg-brand-50 text-brand-700" label="ACC di uji pertama" value={n ? `${Math.round((firstTry / n) * 100)}%` : "–"} />
      </div>

      <GroupSummary groups={groups} done={allDone} value={group} onChange={setGroup} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">
          Riwayat ACC {group !== "ALL" && <span className="text-ink-muted">· {groups.find((g) => g.id === group)?.name}</span>}
          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-line">{visible.length}</span>
        </h2>
        <span className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SPK, order, proses, approver" aria-label="Cari hasil uji" className={`${fieldCls} w-full pl-10`} />
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-card ring-1 ring-line">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-soft"><Inbox className="h-6 w-6" aria-hidden /></span>
          <p className="mt-3 text-sm text-ink-soft">Belum ada hasil uji yang cocok.</p>
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
          <table className="w-full min-w-[62rem] text-sm">
            <caption className="sr-only">Hasil uji yang sudah di-ACC, terbaru di atas</caption>
            <thead className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3">SPK / Order</th>
                <th scope="col" className="px-4 py-3">Mesin · Proses</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3">Masuk lab → ACC</th>
                <th scope="col" className="px-4 py-3 text-right">Durasi</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">Jumlah uji</th>
                <th scope="col" className="px-4 py-3">Hasil</th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right" title="CR saat order masuk: (due date − tgl order) ÷ p, sama dengan perhitungan Excel">CR awal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id} className="align-top transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink">SPK {r.spkNo}</p>
                    {r.orderNo && <p className="mt-0.5 whitespace-nowrap text-xs text-ink-muted">Order {r.orderNo}{r.orderDate ? ` · ${fmtDate(r.orderDate)}` : ""}</p>}
                    {r.colorCode && <p className="text-xs text-ink-muted">Warna {r.colorCode}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold text-ink ring-1 ring-line">{r.machineName}</span>
                    <p className="mt-1.5 text-ink">{r.processName}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <p className="font-medium text-ink">{fmtDate(r.receivedDate)}</p>
                    <p className="text-xs text-ink-soft">ACC {r.approvedAt ? fmtDate(r.approvedAt) : "–"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums">{fmtDays(r.labDays)}</td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums">{r.trialNo}×</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> ACC uji ke-{r.approvedTrialNo ?? "–"}
                    </span>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {r.rejectedCount > 0 ? `${r.rejectedCount}× rework sebelumnya` : "Langsung ACC"}
                      {r.approverName && ` · oleh ${r.approverName}`}
                    </p>
                    {r.approvedNotes && <p className="mt-0.5 text-xs text-ink-muted">Catatan: {r.approvedNotes}</p>}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-ink">{r.crAtOrder === null ? "–" : r.crAtOrder.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Kartu per kelompok mesin (sheet): p dari Excel vs rata-rata durasi aktual di lab. Klik untuk menyaring riwayat. */
function GroupSummary({ groups, done, value, onChange }: { groups: MachineGroup[]; done: SampleRow[]; value: string; onChange: (id: string) => void }) {
  const stats = groups.map((g) => {
    const list = done.filter((r) => r.machineId === g.id);
    const mean = (f: (r: SampleRow) => number) => (list.length ? list.reduce((a, r) => a + f(r), 0) / list.length : null);
    return { g, n: list.length, days: mean((r) => r.labDays), trials: mean((r) => r.approvedTrialNo ?? 0) };
  });
  const scale = Math.max(1, ...stats.flatMap((s) => [s.days ?? 0, s.g.p ?? 0]));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Per kelompok mesin</h2>
        <button type="button" onClick={() => onChange("ALL")} aria-pressed={value === "ALL"}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === "ALL" ? "bg-ink text-white" : "text-ink-muted ring-1 ring-line hover:bg-white"}`}>
          Semua kelompok
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ g, n, days, trials }) => {
          const sel = value === g.id;
          return (
            <button key={g.id} type="button" onClick={() => onChange(sel ? "ALL" : g.id)} aria-pressed={sel} title={g.processes.join(", ")}
              className={`rounded-2xl bg-white p-4 text-left shadow-card ring-1 transition hover:-translate-y-0.5 hover:shadow-soft ${sel ? "ring-2 ring-brand-500" : "ring-line"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{g.name}</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700">{n}</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{g.processes.length} proses lab</p>
              <dl className="mt-4 space-y-2.5 text-xs">
                <Bar label="p (Excel)" value={g.p} scale={scale} tone="bg-brand-400" />
                <Bar label="Rata-rata di lab" value={days} scale={scale} tone={days !== null && g.p !== null && days > g.p ? "bg-amber-400" : "bg-emerald-400"} />
              </dl>
              <p className="mt-3 text-xs text-ink-muted">Rata-rata {trials === null ? "–" : `${trials.toFixed(1)}×`} uji sampai ACC</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ label, value, scale, tone }: { label: string; value: number | null; scale: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-ink-muted">
        <dt>{label}</dt>
        <dd className="font-semibold tabular-nums text-ink">{value === null ? "–" : `${+value.toFixed(2)} hr`}</dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value === null ? 0 : Math.max(4, (value / scale) * 100)}%` }} />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
      <span>
        <span className="block text-2xl font-bold leading-none tabular-nums text-ink">{value}</span>
        <span className="mt-1 block text-xs font-medium text-ink-muted">{label}</span>
      </span>
    </div>
  );
}
