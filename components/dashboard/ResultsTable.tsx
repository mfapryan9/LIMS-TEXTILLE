"use client";

import { useMemo, useState } from "react";
import { fmtDays, type SampleRow } from "./badges";
import type { MachineGroup } from "./header-parts";
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
    <section className="space-y-4" aria-label="Hasil uji selesai">
      <GroupSummary groups={groups} done={allDone} value={group} onChange={setGroup} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Sampel selesai (ACC)" value={String(n)} />
        <Stat label="Rata-rata durasi di lab" value={`${avg((r) => r.labDays).toFixed(1)} hari`} />
        <Stat label="Rata-rata jumlah uji" value={`${avg((r) => r.approvedTrialNo ?? 0).toFixed(1)}×`} />
        <Stat label="ACC di uji pertama" value={n ? `${Math.round((firstTry / n) * 100)}%` : "–"} />
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari SPK, order, proses, mesin, approver"
        aria-label="Cari hasil uji"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 sm:max-w-md"
      />

      {visible.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center text-sm text-ink-soft shadow-card ring-1 ring-line">Belum ada hasil uji yang cocok.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-card ring-1 ring-line">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Hasil uji yang sudah di-ACC, terbaru di atas</caption>
            <thead className="border-b border-line bg-canvas/70 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2">SPK / Order</th>
                <th scope="col" className="px-3 py-2">Kelompok mesin · Proses</th>
                <th scope="col" className="px-3 py-2">Masuk lab → ACC</th>
                <th scope="col" className="px-3 py-2 text-right">Durasi</th>
                <th scope="col" className="px-3 py-2 text-right">Jumlah uji</th>
                <th scope="col" className="px-3 py-2">Hasil</th>
                <th scope="col" className="px-3 py-2 text-right" title="CR saat order masuk: (due date − tgl order) ÷ p, sama dengan perhitungan Excel">CR awal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => (
                <tr key={r.id} className="align-top hover:bg-canvas/50">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-ink">SPK {r.spkNo}</p>
                    {r.orderNo && <p className="text-xs text-ink-muted">Order {r.orderNo}{r.orderDate ? ` · ${fmtDate(r.orderDate)}` : ""}</p>}
                    {r.colorCode && <p className="text-xs text-ink-muted">Warna {r.colorCode}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{r.machineName}</p>
                    <p className="text-xs text-ink-muted">{r.processName}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <p>{fmtDate(r.receivedDate)}</p>
                    <p className="text-xs text-ink-soft">ACC {r.approvedAt ? fmtDate(r.approvedAt) : "–"}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{fmtDays(r.labDays)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.trialNo}×</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                      ACC uji ke-{r.approvedTrialNo ?? "–"}
                    </span>
                    <p className="mt-1 text-xs text-ink-soft">
                      {r.rejectedCount > 0 ? `${r.rejectedCount}× rework sebelumnya` : "Langsung ACC"}
                      {r.approverName && ` · oleh ${r.approverName}`}
                    </p>
                    {r.approvedNotes && <p className="mt-0.5 text-xs text-ink-muted">Catatan: {r.approvedNotes}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.crAtOrder === null ? "–" : r.crAtOrder.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Ringkasan per kelompok mesin (sheet): p dari Excel vs rata-rata durasi aktual. Klik untuk menyaring tabel. */
function GroupSummary({ groups, done, value, onChange }: { groups: MachineGroup[]; done: SampleRow[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-card ring-1 ring-line">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Ringkasan hasil uji per kelompok mesin</caption>
        <thead className="border-b border-line bg-canvas/70 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2">Kelompok mesin (sheet)</th>
            <th scope="col" className="px-3 py-2 text-right">Selesai</th>
            <th scope="col" className="px-3 py-2 text-right" title="Processing time dari Excel, dipakai untuk CR">p (Excel)</th>
            <th scope="col" className="px-3 py-2 text-right">Rata-rata di lab</th>
            <th scope="col" className="px-3 py-2 text-right">Rata-rata jumlah uji</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[{ id: "ALL", name: "Semua kelompok", p: null, processes: [] } as MachineGroup, ...groups].map((g) => {
            const list = g.id === "ALL" ? done : done.filter((r) => r.machineId === g.id);
            const avg = (f: (r: SampleRow) => number) => (list.length ? (list.reduce((a, r) => a + f(r), 0) / list.length).toFixed(1) : "–");
            const sel = value === g.id;
            return (
              <tr key={g.id} onClick={() => onChange(g.id)} className={`cursor-pointer ${sel ? "bg-brand-50" : "hover:bg-canvas/50"}`}>
                <td className="px-3 py-2">
                  <button type="button" aria-pressed={sel} className={`text-left font-medium ${sel ? "text-brand-800" : "text-ink"}`}>{g.name}</button>
                  {g.processes.length > 0 && <p className="text-xs text-ink-soft">{g.processes.join(", ")}</p>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{list.length}</td>
                <td className="px-3 py-2 text-right tabular-nums">{g.p === null ? "–" : `${+g.p.toFixed(2)} hr`}</td>
                <td className="px-3 py-2 text-right tabular-nums">{avg((r) => r.labDays)} hr</td>
                <td className="px-3 py-2 text-right tabular-nums">{avg((r) => r.approvedTrialNo ?? 0)}×</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 shadow-card ring-1 ring-line">
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
