"use client";

import { useState, useTransition } from "react";
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

const btn = "rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600";
const primary = `${btn} bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50`;
const ghost = `${btn} ring-1 ring-line bg-white text-ink hover:bg-canvas disabled:opacity-50`;

function RoleActions({ row, user, actions }: { row: SampleRow; user: SessionUser; actions: SampleActions }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<null | "finish" | "reject" | "due">(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState(row.dueDate);
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); setPanel(null); setText(""); });

  // ── Operator Lab: jalankan uji / matching warna
  if (user.viewMode === "OPERATOR") {
    if (row.status === "MENUNGGU" || row.status === "MATCHING_ULANG")
      return <button className={primary} disabled={pending} onClick={() => run(() => actions.startTrial(row.id))}>Mulai uji ke-{row.trialNo + 1}</button>;
    if (row.status === "DALAM_PROSES" && row.openTrialId)
      return panel === "finish" ? (
        <InlineForm label={`Catatan / formula uji ke-${row.trialNo}`} value={text} onChange={setText} onCancel={() => setPanel(null)}
          submit="Selesai uji" disabled={pending || !text.trim()} onSubmit={() => run(() => actions.finishTrial(row.openTrialId!, text))} />
      ) : (
        <button className={primary} onClick={() => setPanel("finish")}>Selesai uji ke-{row.trialNo}</button>
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
        <button className={primary} disabled={pending} onClick={() => run(() => actions.approve(row.pendingTrialId!))}>ACC uji ke-{row.trialNo}</button>
        <button className={ghost} onClick={() => setPanel("reject")}>Reject (rework)</button>
      </>
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
      <>
        <button className={ghost} onClick={() => setPanel("due")}>Ubah due date</button>
        <button className={ghost} disabled={pending}
          onClick={() => run(() => actions.setUrgent(row.id, !row.isUrgent, row.isUrgent ? "Urgent dicabut" : "Permintaan prioritas"))}>
          {row.isUrgent ? "Cabut urgent" : "Tandai urgent"}
        </button>
      </>
    );
  }
  return null;
}

function RowActions({ row, user, actions, onEdit }: { row: SampleRow; user: SessionUser; actions: SampleActions; onEdit?: (row: SampleRow) => void }) {
  const canEdit = onEdit && row.status !== "DISETUJUI";
  const roleActions = <RoleActions row={row} user={user} actions={actions} />;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {roleActions}
      {canEdit && <button className={ghost} onClick={() => onEdit(row)}>Edit</button>}
      {!canEdit && user.viewMode === "MONITOR" && <span className="text-xs text-ink-soft">Hanya lihat</span>}
    </span>
  );
}

function InlineForm(p: { label: string; value: string; onChange: (v: string) => void; onCancel: () => void; submit: string; disabled: boolean; onSubmit: () => void }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input autoFocus value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.label} aria-label={p.label} className="w-52 rounded border border-line px-1.5 py-1 text-xs" />
      <button className={primary} disabled={p.disabled} onClick={p.onSubmit}>{p.submit}</button>
      <button className={ghost} onClick={p.onCancel}>Batal</button>
    </span>
  );
}

const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (s: string) => fmt.format(new Date(s + "T00:00:00Z"));

/** Ringkasan riwayat uji: berapa kali dicocokkan dengan master, ditolak berapa kali, ACC di uji ke berapa. */
export function TrialSummary({ r }: { r: SampleRow }) {
  if (r.status === "DISETUJUI" && r.approvedTrialNo) {
    return (
      <p className="mt-1 text-xs text-emerald-800">
        ACC pada uji ke-{r.approvedTrialNo} · {fmtDays(r.labDays)} di lab
      </p>
    );
  }
  return (
    <div className="mt-1 space-y-0.5 text-xs text-ink-soft">
      <p>{r.trialNo === 0 ? "Belum pernah diuji" : `Sudah diuji ${r.trialNo}× dengan master`}{r.rejectedCount > 0 && ` · ${r.rejectedCount}× rework`}</p>
      <p>Di lab {fmtDays(r.labDays)}</p>
      {r.status === "MATCHING_ULANG" && r.lastRejectNote && <p className="text-orange-800">Alasan: {r.lastRejectNote}</p>}
    </div>
  );
}

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
      <table className="w-full min-w-[60rem] text-sm">
        <caption className="sr-only">Antrean sampel: urgent paling atas, lalu Critical Ratio terkecil</caption>
        <thead className="border-b border-line bg-canvas/70 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
          <tr>
            <th scope="col" className="w-10 px-3 py-2">#</th>
            <th scope="col" className="px-3 py-2">SPK / Order</th>
            <th scope="col" className="px-3 py-2">Proses · Mesin</th>
            <th scope="col" className="px-3 py-2">Due date</th>
            <th scope="col" className="px-3 py-2">Prioritas</th>
            <th scope="col" className="px-3 py-2">Status &amp; riwayat uji</th>
            <th scope="col" className="px-3 py-2">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => {
            const urgent = r.isUrgent && r.status !== "DISETUJUI";
            return (
            <tr key={r.id} id={`sample-${r.id}`} className={`align-top ${rowAccent(r.urgency, urgent)} ${highlightId === r.id ? "!bg-brand-50" : urgent ? "" : "hover:bg-canvas/50"}`}>
              <td className="px-3 py-2.5 tabular-nums text-ink-soft">{i + 1}</td>
              <td className="px-3 py-2.5">
                <p className="font-semibold text-ink">SPK {r.spkNo}</p>
                {r.orderNo && <p className="text-xs text-ink-muted">Order {r.orderNo}{r.orderDate ? ` · ${fmtDate(r.orderDate)}` : ""}</p>}
                {(r.customerName || r.motif) && <p className="text-xs text-ink-muted">{[r.customerName, r.motif].filter(Boolean).join(" · ")}</p>}
                {(r.colorCode || r.colorDirection) && <p className="text-xs text-ink-muted">Warna {[r.colorCode, r.colorDirection].filter(Boolean).join(" · ")}</p>}
                <p className="text-xs text-ink-soft">{r.orderType === "PRODUKSI" ? "Produksi" : "Marketing"}{r.fabricProblem ? ` · Problem: ${r.fabricProblem}` : ""}</p>
              </td>
              <td className="px-3 py-2.5">
                <p>{r.processName}</p>
                <p className="text-xs text-ink-muted">{r.machineName}{r.standardDays ? ` · p = ${+r.standardDays.toFixed(2)} hr` : ""}</p>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <p>{fmtDate(r.dueDate)}</p>
                <p className="text-xs text-ink-soft">terima {fmtDate(r.receivedDate)}</p>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-col items-start gap-1">
                  {urgent && <UrgentBadge />}
                  {r.status !== "DISETUJUI" && <CrBadge cr={r.cr} urgency={r.urgency} daysLeft={r.daysLeft} />}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
                <TrialSummary r={r} />
              </td>
              <td className="px-3 py-2.5"><RowActions row={r} user={user} actions={actions} onEdit={onEdit} /></td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
