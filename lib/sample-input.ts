/** Data form tambah / edit SPK. Divalidasi ulang di server (jangan percaya input client). */
export interface SampleInput {
  orderType: "PRODUKSI" | "MARKETING";
  orderNo: string;
  orderDate: string; // YYYY-MM-DD atau "" (opsional)
  spkNo: string;
  customerName: string;
  motif: string;
  colorDirection: string;
  colorCode: string;
  processTypeId: string; // kosong bila mengisi proses baru (newProcess)
  machineId: string; // kosong bila mengisi kelompok mesin baru (newMachine)
  newProcess: string; // nama proses lab baru → otomatis masuk daftar pilihan
  newMachine: string; // nama kelompok mesin baru → otomatis masuk daftar pilihan
  newMachineP: string; // p (hari) untuk kelompok mesin baru, wajib agar CR bisa dihitung
  fabricProblem: string;
  problemDescription: string;
  receivedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  isUrgent: boolean;
}

/** Kolom bertipe teks (untuk input biasa di form). */
export type SampleTextField = Exclude<keyof SampleInput, "orderType" | "isUrgent">;

export type SampleFormResult = { ok: true } | { ok: false; error: string };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Rapikan & validasi. Wajib: No. SPK, proses, kelompok mesin, tanggal terima, due date (sesuai kartu SPK / Excel).
 * Proses / kelompok mesin boleh dipilih dari daftar atau diisi baru. Customer, motif, dan data warna opsional.
 */
export function validateSampleInput(raw: SampleInput): { error: string } | { data: SampleInput } {
  const t = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s{2,}/g, " ") : "");
  const machineId = t(raw.machineId);
  const processTypeId = t(raw.processTypeId);
  const data: SampleInput = {
    orderType: raw.orderType === "MARKETING" ? "MARKETING" : "PRODUKSI",
    orderNo: t(raw.orderNo).toUpperCase(),
    orderDate: t(raw.orderDate),
    spkNo: t(raw.spkNo).toUpperCase(),
    customerName: t(raw.customerName),
    motif: t(raw.motif),
    colorDirection: t(raw.colorDirection),
    colorCode: t(raw.colorCode).toUpperCase(),
    processTypeId,
    machineId,
    // Nama baru hanya dipakai bila tidak memilih dari daftar
    newProcess: processTypeId ? "" : t(raw.newProcess).toUpperCase(),
    newMachine: machineId ? "" : t(raw.newMachine),
    newMachineP: machineId ? "" : t(raw.newMachineP).replace(",", "."),
    fabricProblem: t(raw.fabricProblem),
    problemDescription: t(raw.problemDescription),
    receivedDate: t(raw.receivedDate),
    dueDate: t(raw.dueDate),
    isUrgent: raw.isUrgent === true,
  };

  if (!data.spkNo) return { error: "No. SPK wajib diisi" };
  if (!data.machineId && !data.newMachine) return { error: "Kelompok mesin wajib dipilih atau diisi" };
  if (!data.processTypeId && !data.newProcess) return { error: "Proses lab wajib dipilih atau diisi" };
  if (data.newMachine) {
    const p = Number(data.newMachineP);
    if (!data.newMachineP || !Number.isFinite(p) || p <= 0 || p > 365) return { error: "p kelompok mesin baru wajib diisi (hari, lebih dari 0)" };
  }
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" && v.length > 200 && k !== "problemDescription") return { error: "Isian terlalu panjang" };
  }
  if (data.newMachine.length > 60 || data.newProcess.length > 60) return { error: "Nama proses / kelompok mesin maksimal 60 karakter" };
  if (data.problemDescription.length > 1000) return { error: "Deskripsi problem terlalu panjang" };
  if (data.orderDate && !isDate(data.orderDate)) return { error: "Tanggal order tidak valid" };
  if (!isDate(data.receivedDate)) return { error: "Tanggal terima tidak valid" };
  if (!isDate(data.dueDate)) return { error: "Due date tidak valid" };
  if (data.dueDate < data.receivedDate) return { error: "Due date tidak boleh sebelum tanggal terima" };
  return { data };
}
