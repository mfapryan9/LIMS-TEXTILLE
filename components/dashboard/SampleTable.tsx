"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, ImageIcon, Inbox, Pencil, Play, Timer, UserRound, X, ZapOff } from "lucide-react";
import type { SessionUser } from "@/lib/roles";
import { CrBadge, MachineChip, StatusBadge, UrgentBadge, fmtDays, rowAccent, type SampleRow } from "./badges";
import { FinishDialog } from "./FinishDialog";

type Result = { ok: true } | { ok: false; error: string };

/** Diisi dengan Server Actions (app/actions.ts). Setiap action memanggil assertCan() di server + menulis AuditLog. */
export interface SampleActions {
  startProcess: (sampleId: string, processorName: string) => Promise<Result>; // Pengajuan masuk → Sedang diproses
  finishProcess: (form: FormData) => Promise<Result>; // Sedang diproses → Selesai (+ foto hasil uji)
  cancelUrgent: (sampleId: string, reason: string) => Promise<Result>; // intervensi kepala
}

const btn = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-50";
const primary = `${btn} bg-brand-600 text-white shadow-sm hover:bg-brand-700`;
const ghost = `${btn} bg-white text-ink ring-1 ring-line hover:bg-canvas`;
const icon = "h-3.5 w-3.5";

function RoleActions({ row, user, actions }: { row: SampleRow; user: SessionUser; actions: SampleActions }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<null | "process" | "finish" | "cancelUrgent">(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      setPanel(null);
      setText("");
    });
  const err = error && <span role="alert" className="basis-full text-right text-xs text-rose-600">{error}</span>;
  const activeUrgent = row.isUrgent && row.status !== "DISETUJUI";

  // ── Operator Lab: proses pengajuan (wajib nama pemroses) lalu selesaikan dengan foto hasil uji
  if (user.viewMode === "OPERATOR") {
    if (row.status === "MENUNGGU")
      return panel === "process" ? (
        <>
          <InlineForm label="Nama yang memproses" value={text} onChange={setText} onCancel={() => setPanel(null)}
            submit="Mulai proses" disabled={pending || text.trim().length < 2} onSubmit={() => run(() => actions.startProcess(row.id, text))} />
          {err}
        </>
      ) : (
        <button className={primary} onClick={() => setPanel("process")}><Play className={icon} aria-hidden />Proses</button>
      );
    if (row.status === "DALAM_PROSES")
      return (
        <>
          <button className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`} onClick={() => setPanel("finish")}>
            <CheckCircle2 className={icon} aria-hidden />Selesai
          </button>
          {panel === "finish" && <FinishDialog row={row} onSubmit={actions.finishProcess} onClose={() => setPanel(null)} />}
        </>
      );
    return null;
  }

  // ── Seluruh kepala: intervensi pengajuan urgent (batalkan / turunkan urgent)
  if (user.canInterveneUrgent && activeUrgent)
    return panel === "cancelUrgent" ? (
      <>
        <InlineForm label="Alasan membatalkan urgent" value={text} onChange={setText} onCancel={() => setPanel(null)}
          submit="Batalkan urgent" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.cancelUrgent(row.id, text))} />
        {err}
      </>
    ) : (
      <button className={`${btn} bg-white text-fuchsia-700 ring-1 ring-fuchsia-200 hover:bg-fuchsia-50`} onClick={() => setPanel("cancelUrgent")}>
        <ZapOff className={icon} aria-hidden />Batalkan urgent
      </button>
    );
  return null;
}

function RowActions({ row, user, actions, onEdit }: { row: SampleRow; user: SessionUser; actions: SampleActions; onEdit?: (row: SampleRow) => void }) {
  // PPIC hanya dapat mengubah pengajuan yang belum diproses lab
  const canEdit = onEdit && row.status === "MENUNGGU";
  const hasAction = user.viewMode === "OPERATOR" || (user.canInterveneUrgent && row.isUrgent && row.status !== "DISETUJUI") || canEdit;
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <RoleActions row={row} user={user} actions={actions} />
      {canEdit && <button className={ghost} onClick={() => onEdit(row)} aria-label={`Edit pengajuan ${row.orderNo ?? row.spkNo}`}><Pencil className={icon} aria-hidden />Edit</button>}
      {!hasAction && user.viewMode !== "PLANNER" && <span className="text-xs text-ink-soft">Hanya pantau</span>}
    </span>
  );
}

function InlineForm(p: { label: string; value: string; onChange: (v: string) => void; onCancel: () => void; submit: string; disabled: boolean; onSubmit: () => void }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      <input autoFocus value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.label} aria-label={p.label}
        onKeyDown={(e) => e.key === "Enter" && !p.disabled && p.onSubmit()}
        className="w-48 rounded-lg border border-line px-2.5 py-1.5 text-xs focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" />
      <button className={primary} disabled={p.disabled} onClick={p.onSubmit}><Check className={icon} aria-hidden />{p.submit}</button>
      <button className={`${ghost} px-2`} onClick={p.onCancel} aria-label="Batal"><X className={icon} aria-hidden /></button>
    </span>
  );
}

const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (s: string) => fmt.format(new Date(s + "T00:00:00Z"));
const fmtDateTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const fmtStamp = (iso: string) => fmtDateTime.format(new Date(iso));

/** Link foto hasil uji (dibuka di tab baru). */
export function PhotoLink({ id }: { id: string }) {
  return (
    <a href={`/hasil/${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
      <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Lihat foto hasil uji
    </a>
  );
}

/** Siapa yang memproses, kapan selesai, dan lampiran hasil uji: tampil sama untuk semua user. */
export function ProcessInfo({ r }: { r: SampleRow }) {
  if (r.status === "DISETUJUI") {
    return (
      <div className="mt-1.5 space-y-1 text-xs">
        <p className="flex items-center gap-1 font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {r.processorName ? `Selesai oleh ${r.processorName}` : r.approvedTrialNo ? `ACC pada uji ke-${r.approvedTrialNo}` : "Selesai"}
          {r.completedAt ? ` · ${fmtStamp(r.completedAt)}` : ""}
        </p>
        {r.hasPhoto && <PhotoLink id={r.id} />}
        {r.resultNote && <p className="text-ink-muted">Resep: {r.resultNote}</p>}
      </div>
    );
  }
  return (
    <div className="mt-1.5 space-y-1 text-xs text-ink-soft">
      {r.status === "DALAM_PROSES" && r.processorName && (
        <p className="flex items-center gap-1 font-medium text-sky-700">
          <UserRound className="h-3.5 w-3.5" aria-hidden /> Diproses oleh {r.processorName}{r.processStartedAt ? ` · ${fmtStamp(r.processStartedAt)}` : ""}
        </p>
      )}
      <p className="inline-flex items-center gap-1" title="Lama sejak pengajuan masuk lab"><Timer className="h-3.5 w-3.5" aria-hidden />{fmtDays(r.labDays)} di lab</p>
    </div>
  );
}

export function SampleTable({ rows, user, actions, highlightId, onEdit }: { rows: SampleRow[]; user: SessionUser; actions: SampleActions; highlightId: string | null; onEdit?: (row: SampleRow) => void }) {
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-card ring-1 ring-line">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-soft"><Inbox className="h-6 w-6" aria-hidden /></span>
        <p className="mt-3 font-semibold">Tidak ada pengajuan yang cocok</p>
        <p className="mt-1 text-sm text-ink-soft">Ubah kata kunci atau reset filter untuk melihat semua pengajuan.</p>
      </div>
    );

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
      <table className="w-full min-w-[64rem] text-sm">
        <caption className="sr-only">Pengajuan ke lab: urgent paling atas, lalu Critical Ratio terkecil</caption>
        <thead className="border-b border-line bg-surface/60 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          <tr>
            <th scope="col" className="w-12 px-4 py-3">#</th>
            <th scope="col" className="px-4 py-3">Order / Warna</th>
            <th scope="col" className="px-4 py-3">Mesin · Proses</th>
            <th scope="col" className="px-4 py-3">Due date</th>
            <th scope="col" className="px-4 py-3">Prioritas</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => {
            const urgent = r.isUrgent && r.status !== "DISETUJUI";
            return (
              <tr key={r.id} id={`sample-${r.id}`} className={`align-top transition-colors ${rowAccent(r.urgency, urgent)} ${highlightId === r.id ? "!bg-brand-50" : urgent ? "" : "hover:bg-canvas/60"}`}>
                <td className="px-4 py-4">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${urgent ? "bg-fuchsia-600 text-white" : "bg-canvas text-ink-muted"}`}>{i + 1}</span>
                </td>
                <td className="max-w-[18rem] px-4 py-4">
                  <p className="font-semibold text-ink">Order {r.orderNo ?? r.spkNo}</p>
                  {r.spkNo !== r.orderNo && <p className="text-xs text-ink-soft">SPK {r.spkNo}</p>}
                  {r.colorCode && <p className="mt-0.5 text-xs font-medium text-ink">CM {r.colorCode}{r.motif ? <span className="font-normal text-ink-muted"> · motif {r.motif}</span> : null}</p>}
                  {r.colorDirection && <p className="text-xs text-ink-muted">Warna: {r.colorDirection}</p>}
                  {r.problemDescription && <p className="line-clamp-2 text-xs text-ink-muted" title={r.problemDescription}>Order: {r.problemDescription}</p>}
                </td>
                <td className="px-4 py-4">
                  <MachineChip name={r.machineName} color={r.machineColor} />
                  <p className="mt-1.5 text-sm text-ink">{r.processName}</p>
                  <p className="text-xs text-ink-soft">{r.standardDays ? `p = ${+r.standardDays.toFixed(2)} hr` : "p belum diatur"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <p className="font-medium text-ink">{fmtDate(r.dueDate)}</p>
                  <p className="text-xs text-ink-soft">diajukan {fmtDate(r.receivedDate)}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    {urgent && <UrgentBadge />}
                    {r.status !== "DISETUJUI" && <CrBadge cr={r.cr} urgency={r.urgency} daysLeft={r.daysLeft} />}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={r.status} />
                  <ProcessInfo r={r} />
                </td>
                <td className="px-4 py-4">
                  <RowActions row={r} user={user} actions={actions} onEdit={onEdit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
