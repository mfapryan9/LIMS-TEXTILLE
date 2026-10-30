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
  processTypeId: string;
  machineId: string;
  fabricProblem: string;
  problemDescription: string;
  receivedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
}

export type SampleFormResult = { ok: true } | { ok: false; error: string };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Rapikan & validasi. Wajib: No. SPK, proses, mesin, tanggal terima, due date (sesuai kartu SPK / Excel).
 * Customer, motif, dan data warna opsional karena tidak selalu tercantum di kartu SPK.
 */
export function validateSampleInput(raw: SampleInput): { error: string } | { data: SampleInput } {
  const t = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s{2,}/g, " ") : "");
  const data: SampleInput = {
    orderType: raw.orderType === "MARKETING" ? "MARKETING" : "PRODUKSI",
    orderNo: t(raw.orderNo).toUpperCase(),
    orderDate: t(raw.orderDate),
    spkNo: t(raw.spkNo).toUpperCase(),
    customerName: t(raw.customerName),
    motif: t(raw.motif),
    colorDirection: t(raw.colorDirection),
    colorCode: t(raw.colorCode).toUpperCase(),
    processTypeId: t(raw.processTypeId),
    machineId: t(raw.machineId),
    fabricProblem: t(raw.fabricProblem),
    problemDescription: t(raw.problemDescription),
    receivedDate: t(raw.receivedDate),
    dueDate: t(raw.dueDate),
  };

  const required: [keyof SampleInput, string][] = [
    ["spkNo", "No. SPK"],
    ["processTypeId", "Proses lab"],
    ["machineId", "Mesin"],
  ];
  for (const [k, label] of required) if (!data[k]) return { error: `${label} wajib diisi` };
  for (const [k, v] of Object.entries(data)) if (v.length > 200 && k !== "problemDescription") return { error: "Isian terlalu panjang" };
  if (data.problemDescription.length > 1000) return { error: "Deskripsi problem terlalu panjang" };
  if (data.orderDate && !isDate(data.orderDate)) return { error: "Tanggal order tidak valid" };
  if (!isDate(data.receivedDate)) return { error: "Tanggal terima tidak valid" };
  if (!isDate(data.dueDate)) return { error: "Due date tidak valid" };
  if (data.dueDate < data.receivedDate) return { error: "Due date tidak boleh sebelum tanggal terima" };
  return { data };
}
