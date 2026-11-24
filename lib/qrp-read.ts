/**
 * Membaca file QuickReport (.QRP) "Permintaan Pengujian" dari sistem perusahaan, langsung di browser.
 * File .QRP menyimpan setiap halaman sebagai Enhanced Metafile (EMF). Teks diambil dari record
 * EMR_EXTTEXTOUTW beserta posisinya, sehingga hasilnya persis seperti di sistem (tanpa OCR).
 */

const EMR_HEADER = 1;
const EMR_RECTANGLE = 43;
const EMR_EXTTEXTOUTA = 83;
const EMR_EXTTEXTOUTW = 84;
const MAX_PAGES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

export interface QrpText { x: number; y: number; right: number; text: string }
export interface QrpRect { left: number; top: number; right: number; bottom: number }
export interface QrpPage { width: number; height: number; texts: QrpText[]; rects: QrpRect[] }

const SIGNATURE = [0x20, 0x45, 0x4d, 0x46]; // " EMF" pada offset +40 record EMR_HEADER

function findSignature(b: Uint8Array, from: number): number {
  for (let i = from; i + 4 <= b.length; i++) {
    if (b[i] === SIGNATURE[0] && b[i + 1] === SIGNATURE[1] && b[i + 2] === SIGNATURE[2] && b[i + 3] === SIGNATURE[3]) return i;
  }
  return -1;
}

function decode(b: Uint8Array, start: number, length: number, wide: boolean): string {
  if (start < 0 || length < 0 || start + length > b.length) return "";
  return new TextDecoder(wide ? "utf-16le" : "windows-1252").decode(b.subarray(start, start + length));
}

/** Semua halaman EMF di dalam file .QRP. Melempar Error bila tidak ada halaman yang dikenali. */
export function parseQrp(input: ArrayBuffer | Uint8Array): QrpPage[] {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length > MAX_BYTES) throw new Error("File QRP terlalu besar");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u32 = (o: number) => dv.getUint32(o, true);
  const i32 = (o: number) => dv.getInt32(o, true);
  const pages: QrpPage[] = [];

  let from = 40;
  while (pages.length < MAX_PAGES) {
    const sig = findSignature(b, from);
    if (sig < 0) break;
    from = sig + 4;
    const start = sig - 40;
    if (start < 0 || start + 88 > b.length || u32(start) !== EMR_HEADER) continue;
    const total = u32(start + 48); // nBytes: panjang seluruh metafile halaman ini
    const end = Math.min(start + total, b.length);
    const page: QrpPage = { width: Math.max(0, i32(start + 16)), height: Math.max(0, i32(start + 20)), texts: [], rects: [] };

    let off = start;
    while (off + 8 <= end) {
      const type = u32(off);
      const size = u32(off + 4);
      if (size < 8 || size % 4 !== 0 || off + size > end) break;
      if ((type === EMR_EXTTEXTOUTW || type === EMR_EXTTEXTOUTA) && size >= 76) {
        const wide = type === EMR_EXTTEXTOUTW;
        const n = u32(off + 44);
        const text = decode(b, off + u32(off + 48), wide ? n * 2 : n, wide).replace(/\0/g, "");
        if (text.trim()) page.texts.push({ x: i32(off + 36), y: i32(off + 40), right: i32(off + 16), text });
      } else if (type === EMR_RECTANGLE && size >= 24) {
        page.rects.push({ left: i32(off + 8), top: i32(off + 12), right: i32(off + 16), bottom: i32(off + 20) });
      }
      off += size;
    }
    if (page.texts.length) pages.push(page);
    from = Math.max(from, end);
  }
  if (!pages.length) throw new Error("Tidak ada halaman laporan di file QRP");
  return pages;
}

/**
 * Teks satu halaman sebagai baris "LABEL : nilai" (atas → bawah, kiri → kanan), siap diproses parseSpkText.
 * - Isian kosong ("-") dibuang agar label tidak mengambil baris berikutnya sebagai nilainya.
 * - Bagian hasil uji dan tanda tangan (mulai "DESKRIPSI HASIL") diabaikan karena bukan isian pengajuan.
 */
export function qrpPageText(page: QrpPage): string {
  const rows: { y: number; items: QrpText[] }[] = [];
  for (const t of [...page.texts].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((r) => Math.abs(r.y - t.y) <= 4);
    if (row) row.items.push(t);
    else rows.push({ y: t.y, items: [t] });
  }
  const lines: string[] = [];
  for (const r of rows) {
    const line = r.items.sort((a, b) => a.x - b.x).map((t) => t.text.trim()).filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
    if (/^deskripsi hasil\b/i.test(line)) break;
    if (/:\s*-?\s*$/.test(line)) continue;
    lines.push(line);
  }
  return lines.join("\n");
}

/** Pratinjau halaman: kotak dan teks digambar ulang ke canvas (EMF tidak dapat ditampilkan langsung oleh browser). */
export function renderQrpPage(page: QrpPage, scale = 2): HTMLCanvasElement {
  const maxX = Math.max(page.width, ...page.texts.map((t) => Math.max(t.right, t.x + t.text.length * 7)), ...page.rects.map((r) => r.right));
  const maxY = Math.max(page.height, ...page.texts.map((t) => t.y + 16), ...page.rects.map((r) => r.bottom));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((maxX + 30) * scale);
  canvas.height = Math.round((maxY + 30) * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 0.8;
  for (const r of page.rects) ctx.strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
  ctx.fillStyle = "#111";
  ctx.textBaseline = "top";
  ctx.font = "11px Arial, sans-serif";
  for (const t of page.texts) ctx.fillText(t.text, t.x, t.y);
  return canvas;
}

export const isQrp = (f: File) => /\.qrp$/i.test(f.name);
