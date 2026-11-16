"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, ChevronsUp, Hourglass, ImageIcon, Inbox, Pencil, Play, ShieldCheck, Timer, Trash2, UserRound, Users, X, ZapOff } from "lucide-react";
import { isLabRole, type SessionUser } from "@/lib/roles";
import { PROCESSOR_GROUP_NAMES } from "@/lib/processors";
import { fmtHours } from "@/lib/report";
import { CrBadge, MachineChip, StatusBadge, UrgentBadge, fmtDays, rowAccent, type SampleRow } from "./badges";
import { FinishDialog } from "./FinishDialog";

type Result = { ok: true } | { ok: false; error: string };

/** Diisi dengan Server Actions (app/actions.ts). Setiap action memanggil assertCan() di server + menulis AuditLog. */
export interface SampleActions {
  startProcess: (sampleId: string, processorName: string) => Promise<Result>; // Pengajuan masuk → Sedang diproses (pilih grup)
  finishProcess: (form: FormData) => Promise<Result>; // Sedang diproses → Selesai (+ foto hasil uji)
  cancelUrgent: (sampleId: string, reason: string) => Promise<Result>; // intervensi kepala
  moveUrgent: (sampleId: string, direction: "up" | "down" | "top") => Promise<Result>; // urutan urgent manual (lab)
  requestDelete: (sampleId: string, reason: string) => Promise<Result>; // PPIC: minta hapus (divalidasi lab)
  cancelChange: (changeId: string) => Promise<Result>; // PPIC: batalkan permintaan edit/hapus
  decideChange: (changeId: string, approve: boolean, note: string) => Promise<Result>; // lab: validasi permintaan
}

const btn = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-50";
const primary = `${btn} bg-brand-600 text-white shadow-sm hover:bg-brand-700`;
const ghost = `${btn} bg-white text-ink ring-1 ring-line hover:bg-canvas`;
const danger = `${btn} bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50`;
const icon = "h-3.5 w-3.5";
const EDITABLE = ["MENUNGGU", "DALAM_PROSES"];

/** Hook kecil untuk aksi baris: status pending, error, dan reset panel setelah berhasil. */
function useRun(onDone: () => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      onDone();
    });
  const err = error && <span role="alert" className="basis-full text-right text-xs text-rose-600">{error}</span>;
  return { pending, run, err };
}

function RoleActions({ row, user, actions }: { row: SampleRow; user: SessionUser; actions: SampleActions }) {
  const [panel, setPanel] = useState<null | "process" | "finish" | "cancelUrgent">(null);
  const [text, setText] = useState("");
  const { pending, run, err } = useRun(() => { setPanel(null); setText(""); });
  const activeUrgent = row.isUrgent && row.status !== "DISETUJUI";

  // ── Operator Lab: pilih grup pemroses, lalu selesaikan dengan foto hasil uji
  if (user.viewMode === "OPERATOR") {
    if (row.status === "MENUNGGU")
      return panel === "process" ? (
        <>
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            <select autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label="Grup pemroses"
              className="w-56 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
              <option value="">Pilih grup pemroses</option>
              {PROCESSOR_GROUP_NAMES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <button className={primary} disabled={pending || !text} onClick={() => run(() => actions.startProcess(row.id, text))}><Check className={icon} aria-hidden />Mulai proses</button>
            <button className={`${ghost} px-2`} onClick={() => setPanel(null)} aria-label="Batal"><X className={icon} aria-hidden /></button>
          </span>
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

/** Bagian lab: tinjau permintaan edit / hapus dari PPIC lalu setujui atau tolak. */
function ChangeReview({ row, actions, canDecide }: { row: SampleRow; actions: SampleActions; canDecide: boolean }) {
  const c = row.pendingChange!;
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const { pending, run, err } = useRun(() => { setRejecting(false); setNote(""); });
  const isDelete = c.type === "DELETE";
  return (
    <div className={`w-72 rounded-xl p-3 text-left text-xs ring-1 ${isDelete ? "bg-rose-50/70 ring-rose-200" : "bg-amber-50/70 ring-amber-200"}`}>
      <p className={`flex items-center gap-1.5 font-semibold ${isDelete ? "text-rose-800" : "text-amber-900"}`}>
        <ShieldCheck className={icon} aria-hidden /> PPIC meminta {isDelete ? "pengajuan ini dihapus" : "perubahan data"}
      </p>
      <p className="mt-0.5 text-ink-soft">{c.requesterName ? `${c.requesterName} · ` : ""}{fmtStamp(c.createdAt)}</p>
      {c.reason && <p className="mt-1 text-ink">Alasan: {c.reason}</p>}
      {c.diff.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {c.diff.map((d) => (
            <li key={d.field}>
              <span className="font-semibold text-ink">{d.field}:</span>{" "}
              <span className="text-ink-soft line-through">{d.before}</span> → <span className="font-medium text-ink">{d.after}</span>
            </li>
          ))}
        </ul>
      )}
      {canDecide ? (
        rejecting ? (
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan penolakan" aria-label="Alasan penolakan"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100" />
            <button className={danger} disabled={pending || !note.trim()} onClick={() => run(() => actions.decideChange(c.id, false, note))}>Tolak</button>
            <button className={`${ghost} px-2`} onClick={() => setRejecting(false)} aria-label="Batal"><X className={icon} aria-hidden /></button>
          </span>
        ) : (
          <span className="mt-2 flex flex-wrap gap-1.5">
            <button className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={pending} onClick={() => run(() => actions.decideChange(c.id, true, ""))}>
              <Check className={icon} aria-hidden />Setujui {isDelete ? "hapus" : "perubahan"}
            </button>
            <button className={danger} disabled={pending} onClick={() => setRejecting(true)}><X className={icon} aria-hidden />Tolak</button>
          </span>
        )
      ) : (
        <p className="mt-2 font-medium text-amber-800">Menunggu validasi bagian lab</p>
      )}
      {err}
    </div>
  );
}

/** PPIC: minta edit / hapus pengajuan (berlaku setelah divalidasi lab), atau batalkan permintaan yang masih menunggu. */
function PlannerActions({ row, actions, onEdit }: { row: SampleRow; actions: SampleActions; onEdit: (row: SampleRow) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run, err } = useRun(() => { setDeleting(false); setReason(""); });
  if (row.pendingChange)
    return (
      <>
        <button className={ghost} disabled={pending} onClick={() => run(() => actions.cancelChange(row.pendingChange!.id))}>
          <X className={icon} aria-hidden />Batalkan permintaan
        </button>
        {err}
      </>
    );
  if (!EDITABLE.includes(row.status)) return null;
  return deleting ? (
    <>
      <InlineForm label="Alasan penghapusan" value={reason} onChange={setReason} onCancel={() => setDeleting(false)}
        submit="Minta hapus" disabled={pending || !reason.trim()} onSubmit={() => run(() => actions.requestDelete(row.id, reason))} />
      {err}
    </>
  ) : (
    <>
      <button className={ghost} onClick={() => onEdit(row)} aria-label={`Edit pengajuan ${row.orderNo ?? row.spkNo}`}><Pencil className={icon} aria-hidden />Edit</button>
      <button className={danger} onClick={() => setDeleting(true)} aria-label={`Hapus pengajuan ${row.orderNo ?? row.spkNo}`}><Trash2 className={icon} aria-hidden />Hapus</button>
    </>
  );
}

function RowActions({ row, user, actions, onEdit }: { row: SampleRow; user: SessionUser; actions: SampleActions; onEdit?: (row: SampleRow) => void }) {
  const lab = isLabRole(user.roleCode);
  const hasAction = user.viewMode === "OPERATOR" || (user.canInterveneUrgent && row.isUrgent && row.status !== "DISETUJUI") || !!onEdit || (lab && !!row.pendingChange);
  return (
    <span className="flex flex-col items-end gap-2">
      {row.pendingChange && <ChangeReview row={row} actions={actions} canDecide={lab} />}
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        <RoleActions row={row} user={user} actions={actions} />
        {onEdit && <PlannerActions row={row} actions={actions} onEdit={onEdit} />}
        {!hasAction && !row.pendingChange && <span className="text-xs text-ink-soft">Hanya pantau</span>}
      </span>
    </span>
  );
}

/** Lab: geser urutan pengajuan urgent (naik / turun / paling atas). */
function UrgentOrder({ row, actions, isFirst, isLast }: { row: SampleRow; actions: SampleActions; isFirst: boolean; isLast: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const move = (dir: "up" | "down" | "top") =>
    start(async () => {
      setError(null);
      const res = await actions.moveUrgent(row.id, dir);
      if (!res.ok) setError(res.error);
    });
  const b = "flex h-6 w-6 items-center justify-center rounded-md text-fuchsia-700 ring-1 ring-fuchsia-200 transition hover:bg-fuchsia-100 disabled:opacity-30";
  const name = row.orderNo ?? row.spkNo;
  return (
    <span className="mt-1.5 flex flex-col items-center gap-1" aria-label="Atur urutan urgent">
      <button className={b} disabled={pending || isFirst} onClick={() => move("top")} title="Jadikan paling atas" aria-label={`Jadikan ${name} urgent paling atas`}><ChevronsUp className={icon} aria-hidden /></button>
      <button className={b} disabled={pending || isFirst} onClick={() => move("up")} title="Naikkan" aria-label={`Naikkan ${name}`}><ArrowUp className={icon} aria-hidden /></button>
      <button className={b} disabled={pending || isLast} onClick={() => move("down")} title="Turunkan" aria-label={`Turunkan ${name}`}><ArrowDown className={icon} aria-hidden /></button>
      {error && <span role="alert" className="text-[10px] text-rose-600">{error}</span>}
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
const fmtDateTime = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const fmtStamp = (iso: string) => fmtDateTime.format(new Date(iso));

const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
/** Lama menunggu / lama diproses (untuk mencari order terlama). */
export function waitHours(r: SampleRow): number | null {
  if (r.status === "MENUNGGU") return hoursSince(r.createdAt);
  if (r.status === "DALAM_PROSES" && r.processStartedAt) return hoursSince(r.processStartedAt);
  return null;
}
/** Durasi pengajuan → selesai (jam); data riwayat memakai lama di lab (hari). */
export const doneHours = (r: SampleRow) => (r.completedAt ? (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / 3_600_000 : r.labDays * 24);

/** Nomor partai (bisa lebih dari satu) sebagai chip kecil. */
export function PartyChips({ parties }: { parties: string[] }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1" aria-label={`Partai: ${parties.join(", ")}`}>
      <span className="text-[11px] font-medium text-ink-soft">Partai</span>
      {parties.map((p) => (
        <span key={p} className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-semibold text-ink ring-1 ring-line">{p}</span>
      ))}
    </p>
  );
}

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
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {r.processorName ? `Selesai oleh ${r.processorName}` : r.approvedTrialNo ? `ACC pada uji ke-${r.approvedTrialNo}` : "Selesai"}
          {r.completedAt ? ` · ${fmtStamp(r.completedAt)}` : ""}
        </p>
        <p className="inline-flex items-center gap-1 text-ink-soft"><Timer className="h-3.5 w-3.5" aria-hidden />Selesai dalam {r.completedAt ? fmtHours(doneHours(r)) : fmtDays(r.labDays)}</p>
        {r.hasPhoto && <p><PhotoLink id={r.id} /></p>}
        {r.resultNote && <p className="text-ink-muted">Resep: {r.resultNote}</p>}
      </div>
    );
  }
  const wait = waitHours(r);
  return (
    <div className="mt-1.5 space-y-1 text-xs text-ink-soft">
      {r.status === "DALAM_PROSES" && r.processorName && (
        <p className="flex items-center gap-1 font-medium text-sky-700">
          {r.processorName.startsWith("Grup") ? <Users className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          Diproses oleh {r.processorName}{r.processStartedAt ? ` · ${fmtStamp(r.processStartedAt)}` : ""}
        </p>
      )}
      {wait !== null && (
        <p className={`inline-flex items-center gap-1 ${wait >= 72 ? "font-semibold text-rose-700" : ""}`} suppressHydrationWarning>
          <Hourglass className="h-3.5 w-3.5" aria-hidden />{r.status === "MENUNGGU" ? "Belum diproses" : "Diproses"} {fmtHours(wait)}
        </p>
      )}
      {wait === null && <p className="inline-flex items-center gap-1" title="Lama sejak pengajuan masuk lab"><Timer className="h-3.5 w-3.5" aria-hidden />{fmtDays(r.labDays)} di lab</p>}
    </div>
  );
}

export function SampleTable({ rows, user, actions, highlightId, onEdit, canReorder }: {
  rows: SampleRow[]; user: SessionUser; actions: SampleActions; highlightId: string | null; onEdit?: (row: SampleRow) => void;
  canReorder: boolean; // urutan prioritas sedang ditampilkan → lab boleh menggeser urgent
}) {
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-card ring-1 ring-line">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-soft"><Inbox className="h-6 w-6" aria-hidden /></span>
        <p className="mt-3 font-semibold">Tidak ada pengajuan yang cocok</p>
        <p className="mt-1 text-sm text-ink-soft">Ubah kata kunci atau reset filter untuk melihat semua pengajuan.</p>
      </div>
    );

  const urgentIds = rows.filter((r) => r.isUrgent && r.status !== "DISETUJUI").map((r) => r.id);
  const reorder = canReorder && isLabRole(user.roleCode) && urgentIds.length > 1;

  return (
    <div className="scrollbar-thin overflow-x-auto rounded-2xl bg-white shadow-card ring-1 ring-line">
      <table className="w-full min-w-[72rem] text-sm">
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
            const ui = urgentIds.indexOf(r.id);
            return (
              <tr key={r.id} id={`sample-${r.id}`} className={`align-top transition-colors ${rowAccent(r.urgency, urgent)} ${highlightId === r.id ? "!bg-brand-50" : urgent ? "" : "hover:bg-canvas/60"}`}>
                <td className="px-4 py-4">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${urgent ? "bg-fuchsia-600 text-white" : "bg-canvas text-ink-muted"}`}>{i + 1}</span>
                  {reorder && urgent && <UrgentOrder row={r} actions={actions} isFirst={ui === 0} isLast={ui === urgentIds.length - 1} />}
                </td>
                <td className="min-w-[11rem] max-w-[18rem] px-4 py-4">
                  <p className="font-semibold text-ink">Order {r.orderNo ?? r.spkNo}</p>
                  {r.customerName && <p className="text-xs font-medium text-ink-muted">{r.customerName}</p>}
                  {r.spkNo !== r.orderNo && <p className="text-xs text-ink-soft">SPK {r.spkNo}</p>}
                  {r.colorCode && <p className="mt-0.5 text-xs font-medium text-ink">No. CM {r.colorCode}{r.colorName ? <span className="font-normal text-ink-muted"> · {r.colorName}</span> : null}</p>}
                  {r.motif && <p className="text-xs text-ink-muted">Motif {r.motif}</p>}
                  {r.parties.length > 0 && <PartyChips parties={r.parties} />}
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
                  <p className="text-xs text-ink-soft">diajukan {fmtStamp(r.createdAt)}</p>
                  {r.requesterName && <p className="text-xs text-ink-soft">oleh {r.requesterName}</p>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    {urgent && <UrgentBadge />}
                    {urgent && r.urgentRank !== null && <span className="text-[11px] font-medium text-fuchsia-700">Urutan diatur lab</span>}
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
