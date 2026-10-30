"use client";

import { useState, useTransition } from "react";
import type { SessionUser } from "@/lib/roles";
import { CrBadge, StatusBadge, UrgentBadge, rowAccent, type SampleRow } from "./badges";

/** Diisi dengan Server Actions (src/app/actions.ts). Setiap action WAJIB memanggil assertCan() + menulis AuditLog. */
export interface SampleActions {
  startTrial: (sampleId: string) => Promise<void>; // buat TestTrial ke-n, status → DALAM_PROSES
  finishTrial: (trialId: string, notes: string) => Promise<void>; // status → MENUNGGU_APPROVAL
  approve: (trialId: string) => Promise<void>; // status → DISETUJUI
  reject: (trialId: string, note: string) => Promise<void>; // status → MATCHING_ULANG
  changeDueDate: (sampleId: string, dueDate: string, reason: string) => Promise<void>;
  setUrgent: (sampleId: string, urgent: boolean, reason: string) => Promise<void>;
}

const btn = "rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const primary = `${btn} bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50`;
const ghost = `${btn} ring-1 ring-line bg-white text-ink hover:bg-canvas disabled:opacity-50`;

function RowActions({ row, user, actions, onEdit }: { row: SampleRow; user: SessionUser; actions: SampleActions; onEdit?: (row: SampleRow) => void }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<null | "finish" | "reject" | "due">(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState(row.dueDate);
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); setPanel(null); setText(""); });

  // ── Operator Lab
  if (user.viewMode === "OPERATOR") {
    if (row.status === "MENUNGGU" || row.status === "MATCHING_ULANG")
      return <button className={primary} disabled={pending} onClick={() => run(() => actions.startTrial(row.id))}>Mulai uji (percobaan {row.trialNo + 1})</button>;
    if (row.status === "DALAM_PROSES" && row.openTrialId)
      return panel === "finish" ? (
        <InlineForm label="Catatan percobaan ke-" labelValue={row.trialNo} value={text} onChange={setText} onCancel={() => setPanel(null)}
          submit="Selesai uji" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.finishTrial(row.openTrialId!, text))} />
      ) : (
        <button className={primary} onClick={() => setPanel("finish")}>Selesai uji</button>
      );
    return <span className="text-xs text-ink-soft">–</span>;
  }

  // ── Kepala Urusan Lab
  if (user.viewMode === "APPROVER") {
    if (row.status !== "MENUNGGU_APPROVAL" || !row.pendingTrialId) return <span className="text-xs text-ink-soft">–</span>;
    return panel === "reject" ? (
      <InlineForm label="Alasan matching ulang" value={text} onChange={setText} onCancel={() => setPanel(null)}
        submit="Kirim rework" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.reject(row.pendingTrialId!, text))} />
    ) : (
      <span className="flex gap-1.5">
        <button className={primary} disabled={pending} onClick={() => run(() => actions.approve(row.pendingTrialId!))}>Approve</button>
        <button className={ghost} onClick={() => setPanel("reject")}>Reject (rework)</button>
      </span>
    );
  }

  // ── PPIC & Marketing
  if (user.viewMode === "PLANNER" && row.status !== "DISETUJUI") {
    return panel === "due" ? (
      <span className="flex flex-wrap items-center gap-1.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date baru" className="rounded border border-line px-1.5 py-1 text-xs" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Alasan perubahan" className="w-36 rounded border border-line px-1.5 py-1 text-xs" />
        <button className={primary} disabled={pending || !text.trim() || date === row.dueDate} onClick={() => run(() => actions.changeDueDate(row.id, date, text))}>Simpan</button>
        <button className={ghost} onClick={() => setPanel(null)}>Batal</button>
      </span>
    ) : (
      <span className="flex flex-wrap gap-1.5">
        {onEdit && <button className={ghost} onClick={() => onEdit(row)}>Edit</button>}
        <button className={ghost} onClick={() => setPanel("due")}>Ubah due date</button>
        <button className={ghost} disabled={pending}
          onClick={() => run(() => actions.setUrgent(row.id, !row.isUrgent, row.isUrgent ? "Urgent dicabut" : "Permintaan prioritas"))}>
          {row.isUrgent ? "Cabut urgent" : "Tandai urgent"}
        </button>
      </span>
    );
  }

  return <span className="text-xs text-ink-soft">Hanya lihat</span>; // MONITOR
}

function InlineForm(p: { label: string; labelValue?: number; value: string; onChange: (v: string) => void; onCancel: () => void; submit: string; disabled: boolean; onSubmit: () => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input autoFocus value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={`${p.label}${p.labelValue ?? ""}`} aria-label={p.label} className="w-48 rounded border border-line px-1.5 py-1 text-xs" />
      <button className={primary} disabled={p.disabled} onClick={p.onSubmit}>{p.submit}</button>
      <button className={ghost} onClick={p.onCancel}>Batal</button>
    </span>
  );
}

const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (s: string) => fmt.format(new Date(s + "T00:00:00Z"));

export function SampleTable({ rows, user, actions, highlightId, onEdit }: { rows: SampleRow[]; user: SessionUser; actions: SampleActions; highlightId: string | null; onEdit?: (row: SampleRow) => void }) {
  if (rows.length === 0)
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-card ring-1 ring-line">
        <p className="font-medium">Tidak ada sampel yang cocok</p>
        <p className="mt-1 text-sm text-ink-soft">Ubah kata kunci atau reset filter untuk melihat semua antrean.</p>
      </div>
    );

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-card ring-1 ring-line">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">Antrean sampel diurutkan dari Critical Ratio terkecil</caption>
        <thead className="border-b border-line bg-canvas/70 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2 w-10">#</th>
            <th scope="col" className="px-3 py-2">SPK / Customer</th>
            <th scope="col" className="px-3 py-2">Warna</th>
            <th scope="col" className="px-3 py-2">Proses · Mesin</th>
            <th scope="col" className="px-3 py-2">Due date</th>
            <th scope="col" className="px-3 py-2">Prioritas</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={r.id} id={`sample-${r.id}`} className={`border-l-4 align-top ${rowAccent(r.urgency, r.isUrgent)} ${highlightId === r.id ? "bg-brand-50" : "hover:bg-canvas/50"}`}>
              <td className="px-3 py-2.5 tabular-nums text-ink-soft">{i + 1}</td>
              <td className="px-3 py-2.5">
                <p className="font-semibold text-ink">{r.spkNo}</p>
                <p className="text-xs text-ink-muted">{r.customerName} · {r.motif}</p>
                <p className="text-xs text-ink-soft">{r.orderType === "PRODUKSI" ? "Produksi" : "Marketing"}{r.fabricProblem ? ` · Problem: ${r.fabricProblem}` : ""}</p>
              </td>
              <td className="px-3 py-2.5">
                <p className="font-medium">{r.colorCode}</p>
                <p className="text-xs text-ink-muted">{r.colorDirection}</p>
              </td>
              <td className="px-3 py-2.5">
                <p>{r.processName}</p>
                <p className="text-xs text-ink-muted">{r.machineName}{r.standardDays ? ` · p = ${r.standardDays} hr` : ""}</p>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <p>{fmtDate(r.dueDate)}</p>
                <p className="text-xs text-ink-soft">terima {fmtDate(r.receivedDate)}</p>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-col items-start gap-1">
                  {r.isUrgent && <UrgentBadge />}
                  {r.status !== "DISETUJUI" && <CrBadge cr={r.cr} urgency={r.urgency} daysLeft={r.daysLeft} />}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
                {r.trialNo > 0 && <p className="mt-1 text-xs text-ink-soft">Percobaan ke-{r.trialNo}</p>}
              </td>
              <td className="px-3 py-2.5"><RowActions row={r} user={user} actions={actions} onEdit={onEdit} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
