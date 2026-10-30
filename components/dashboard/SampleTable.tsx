"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, FlaskConical, Inbox, Pencil, Play, RotateCcw, Square, Timer, X, Zap } from "lucide-react";
import type { SessionUser } from "@/lib/roles";
import { CrBadge, StatusBadge, UrgentBadge, fmtDays, rowAccent, type SampleRow } from "./badges";

/** Diisi dengan Server Actions (app/actions.ts). Setiap action WAJIB memanggil assertCan() + menulis AuditLog. */
export interface SampleActions {
  startTrial: (sampleId: string) => Promise<void>; // buat TestTrial ke-n, status → DALAM_PROSES
  finishTrial: (trialId: string, notes: string) => Promise<void>; // status → MENUNGGU_APPROVAL
  approve: (trialId: string) => Promise<void>; // status → DISETUJUI
  reject: (trialId: string, note: string) => Promise<void>; // status → MATCHING_ULANG
  changeDueDate: (sampleId: string, dueDate: string, reason: string) => Promise<void>;
  setUrgent: (sampleId: string, urgent: boolean, reason: string) => Promise<void>;
}

const btn = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-50";
const primary = `${btn} bg-brand-600 text-white shadow-sm hover:bg-brand-700`;
const ghost = `${btn} bg-white text-ink ring-1 ring-line hover:bg-canvas`;
const icon = "h-3.5 w-3.5";

function RoleActions({ row, user, actions }: { row: SampleRow; user: SessionUser; actions: SampleActions }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<null | "finish" | "reject" | "due">(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState(row.dueDate);
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); setPanel(null); setText(""); });

  // ── Operator Lab: jalankan uji / matching warna
  if (user.viewMode === "OPERATOR") {
    if (row.status === "MENUNGGU" || row.status === "MATCHING_ULANG")
      return <button className={primary} disabled={pending} onClick={() => run(() => actions.startTrial(row.id))}><Play className={icon} aria-hidden />Mulai uji ke-{row.trialNo + 1}</button>;
    if (row.status === "DALAM_PROSES" && row.openTrialId)
      return panel === "finish" ? (
        <InlineForm label={`Catatan / formula uji ke-${row.trialNo}`} value={text} onChange={setText} onCancel={() => setPanel(null)}
          submit="Selesai uji" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.finishTrial(row.openTrialId!, text))} />
      ) : (
        <button className={primary} onClick={() => setPanel("finish")}><Square className={icon} aria-hidden />Selesai uji ke-{row.trialNo}</button>
      );
    return null;
  }

  // ── Kepala (Kaur Lab, Kasi): approve hasil uji
  if (user.viewMode === "APPROVER") {
    if (row.status !== "MENUNGGU_APPROVAL" || !row.pendingTrialId) return null;
    return panel === "reject" ? (
      <InlineForm label="Alasan matching ulang" value={text} onChange={setText} onCancel={() => setPanel(null)}
        submit="Kirim rework" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.reject(row.pendingTrialId!, text))} />
    ) : (
      <>
        <button className={`${btn} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`} disabled={pending} onClick={() => run(() => actions.approve(row.pendingTrialId!))}>
          <Check className={icon} aria-hidden />ACC uji ke-{row.trialNo}
        </button>
        <button className={ghost} onClick={() => setPanel("reject")}><RotateCcw className={icon} aria-hidden />Reject (rework)</button>
      </>
    );
  }

  // ── PPIC & Marketing
  if (user.viewMode === "PLANNER" && row.status !== "DISETUJUI") {
    return panel === "due" ? (
      <span className="flex flex-wrap items-center gap-1.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date baru" className="rounded-lg border border-line px-2 py-1.5 text-xs" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Alasan perubahan" className="w-36 rounded-lg border border-line px-2 py-1.5 text-xs" />
        <button className={primary} disabled={pending || !text.trim() || date === row.dueDate} onClick={() => run(() => actions.changeDueDate(row.id, date, text))}>Simpan</button>
        <button className={ghost} onClick={() => setPanel(null)}>Batal</button>
      </span>
    ) : (
      <>
        <button className={ghost} onClick={() => setPanel("due")}><CalendarClock className={icon} aria-hidden />Due date</button>
        <button className={ghost} disabled={pending}
          onClick={() => run(() => actions.setUrgent(row.id, !row.isUrgent, row.isUrgent ? "Urgent dicabut" : "Permintaan prioritas"))}>
          <Zap className={icon} aria-hidden />{row.isUrgent ? "Cabut urgent" : "Tandai urgent"}
        </button>
      </>
    );
  }
  return null;
}

function RowActions({ row, user, actions, onEdit }: { row: SampleRow; user: SessionUser; actions: SampleActions; onEdit?: (row: SampleRow) => void }) {
  const canEdit = onEdit && row.status !== "DISETUJUI";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <RoleActions row={row} user={user} actions={actions} />
      {canEdit && <button className={ghost} onClick={() => onEdit(row)} aria-label={`Edit SPK ${row.spkNo}`}><Pencil className={icon} aria-hidden />Edit</button>}
      {!canEdit && user.viewMode === "MONITOR" && <span className="text-xs text-ink-soft">Hanya lihat</span>}
    </span>
  );
}

function InlineForm(p: { label: string; value: string; onChange: (v: string) => void; onCancel: () => void; submit: string; disabled: boolean; onSubmit: () => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input autoFocus value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.label} aria-label={p.label} className="w-56 rounded-lg border border-line px-2.5 py-1.5 text-xs focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" />
      <button className={primary} disabled={p.disabled} onClick={p.onSubmit}>{p.submit}</button>
      <button className={`${ghost} px-2`} onClick={p.onCancel} aria-label="Batal"><X className={icon} aria-hidden /></button>
    </span>
  );
}

const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (s: string) => fmt.format(new Date(s + "T00:00:00Z"));

/** Ringkasan riwayat uji: berapa kali dicocokkan dengan master, ditolak berapa kali, ACC di uji ke berapa. */
export function TrialSummary({ r }: { r: SampleRow }) {
  if (r.status === "DISETUJUI" && r.approvedTrialNo) {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" aria-hidden /> ACC pada uji ke-{r.approvedTrialNo} · {fmtDays(r.labDays)} di lab
      </p>
    );
  }
  return (
    <div className="mt-1.5 space-y-1 text-xs text-ink-soft">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1" title="Jumlah uji / matching warna dengan master">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          {r.trialNo === 0 ? "Belum diuji" : `${r.trialNo}× diuji`}
        </span>
        {r.rejectedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-orange-700"><RotateCcw className="h-3.5 w-3.5" aria-hidden />{r.rejectedCount}× rework</span>
        )}
        <span className="inline-flex items-center gap-1" title="Lama di lab"><Timer className="h-3.5 w-3.5" aria-hidden />{fmtDays(r.labDays)}</span>
      </p>
      {r.status === "MATCHING_ULANG" && r.lastRejectNote && <p className="rounded-md bg-orange-50 px-2 py-1 text-orange-800">Alasan: {r.lastRejectNote}</p>}
    </div>
  );
}

export function SampleTable({ rows, user, actions, highlightId, onEdit }: { rows: SampleRow[]; user: SessionUser; actions: SampleActions; highlightId: string | null; onEdit?: (row: SampleRow) => void }) {
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-card ring-1 ring-line">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-soft"><Inbox className="h-6 w-6" aria-hidden /></span>
        <p className="mt-3 font-semibold">Tidak ada sampel yang cocok</p>
        <p className="mt-1 text-sm text-ink-soft">Ubah kata kunci atau reset filter untuk melihat semua antrean.</p>
      </div>
    );

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
      <table className="w-full min-w-[64rem] text-sm">
        <caption className="sr-only">Antrean sampel: urgent paling atas, lalu Critical Ratio terkecil</caption>
        <thead className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          <tr>
            <th scope="col" className="w-12 px-4 py-3">#</th>
            <th scope="col" className="px-4 py-3">SPK / Order</th>
            <th scope="col" className="px-4 py-3">Mesin · Proses</th>
            <th scope="col" className="px-4 py-3">Due date</th>
            <th scope="col" className="px-4 py-3">Prioritas</th>
            <th scope="col" className="px-4 py-3">Status &amp; riwayat uji</th>
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
                <td className="px-4 py-4">
                  <p className="font-semibold text-ink">SPK {r.spkNo}</p>
                  {r.orderNo && <p className="mt-0.5 whitespace-nowrap text-xs text-ink-muted">Order {r.orderNo}{r.orderDate ? ` · ${fmtDate(r.orderDate)}` : ""}</p>}
                  {(r.customerName || r.motif) && <p className="text-xs text-ink-muted">{[r.customerName, r.motif].filter(Boolean).join(" · ")}</p>}
                  {(r.colorCode || r.colorDirection) && <p className="text-xs text-ink-muted">Warna {[r.colorCode, r.colorDirection].filter(Boolean).join(" · ")}</p>}
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-soft">{r.orderType === "PRODUKSI" ? "Produksi" : "Marketing"}{r.fabricProblem ? ` · Problem: ${r.fabricProblem}` : ""}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold text-ink ring-1 ring-line">{r.machineName}</span>
                  <p className="mt-1.5 text-sm text-ink">{r.processName}</p>
                  <p className="text-xs text-ink-soft">{r.standardDays ? `p = ${+r.standardDays.toFixed(2)} hr` : "p belum diatur"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <p className="font-medium text-ink">{fmtDate(r.dueDate)}</p>
                  <p className="text-xs text-ink-soft">terima {fmtDate(r.receivedDate)}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    {urgent && <UrgentBadge />}
                    {r.status !== "DISETUJUI" && <CrBadge cr={r.cr} urgency={r.urgency} daysLeft={r.daysLeft} />}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={r.status} />
                  <TrialSummary r={r} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end"><RowActions row={r} user={user} actions={actions} onEdit={onEdit} /></div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
