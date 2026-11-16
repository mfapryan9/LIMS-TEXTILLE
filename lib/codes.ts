/**
 * Format kode di kartu SPK.
 * - No. CM disimpan hanya angka (boleh dengan / . -), tanpa awalan "CM", agar tidak tampil "No. CM CM-102".
 *   Contoh: "CM-102" → "102", "cm 13944 / 3" → "13944/3".
 * - Motif berformat kode huruf-angka, mis. "TR-62": "tr62" / "TR 62" → "TR-62". Motif berupa nama (mis. "Floral") tidak diubah.
 */

export function normalizeCm(v: string): string {
  return String(v ?? "")
    .trim()
    .replace(/^(NO\.?\s*)?CM[\s\-.:]*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** No. CM valid: diawali angka, isinya angka dengan pemisah / . - (mis. 102, 13944/3). */
export const isValidCm = (v: string) => /^\d[\d/.\-]*$/.test(v);

export function normalizeMotif(v: string): string {
  const t = String(v ?? "").trim().replace(/\s{2,}/g, " ");
  const m = t.match(/^([A-Za-z]{1,4})[\s\-.]*(\d.*)$/);
  return m ? `${m[1].toUpperCase()}-${m[2].toUpperCase()}` : t;
}

/** Label singkat pengajuan, mis. "Order 26-4221 · CM 13944/3". */
export const sampleLabel = (s: { orderNo: string | null; spkNo: string; colorCode: string | null }) =>
  `Order ${s.orderNo ?? s.spkNo}${s.colorCode ? ` · CM ${s.colorCode}` : ""}`;
