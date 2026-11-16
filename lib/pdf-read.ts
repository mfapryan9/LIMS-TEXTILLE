/**
 * Membaca PDF permintaan pengujian di browser (pdf.js).
 * - PDF digital (punya lapisan teks): teks diambil langsung, cepat dan akurat, tanpa OCR.
 * - PDF hasil scan (gambar): halaman dirender ke canvas lalu dibaca OCR oleh pemanggil.
 */

const MAX_PAGES = 3;

type PdfJs = typeof import("pdfjs-dist");
let lib: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();
    return m;
  });
  return lib;
}

export interface PdfRead {
  text: string; // teks dari lapisan teks PDF ("" bila PDF hasil scan)
  pages: HTMLCanvasElement[]; // halaman dirender (pratinjau + OCR)
}

interface TextItem { str: string; transform: number[]; width: number }

/** Susun potongan teks per baris (urut atas → bawah, kiri → kanan); jarak lebar jadi pemisah kolom. */
function toLines(items: TextItem[]): string {
  const rows = new Map<number, TextItem[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    rows.set(y, [...(rows.get(y) ?? []), it]);
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, list]) => {
      list.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "";
      let end = -Infinity;
      for (const it of list) {
        const x = it.transform[4];
        if (line) line += x - end > 18 ? "    " : x - end > 1.5 ? " " : "";
        line += it.str;
        end = x + it.width;
      }
      return line;
    })
    .join("\n");
}

export async function readPdf(file: File, targetPx = 1800): Promise<PdfRead> {
  const m = await pdfjs();
  // isEvalSupported:false → font PDF tidak pernah dieksekusi sebagai kode
  const doc = await m.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const texts: string[] = [];
  const pages: HTMLCanvasElement[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      texts.push(toLines((await page.getTextContent()).items as TextItem[]));
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, targetPx / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push(canvas);
    }
  } finally {
    await doc.destroy();
  }
  const text = texts.join("\n").trim();
  // Lapisan teks dianggap ada bila memuat cukup huruf/angka
  return { text: text.replace(/[^A-Za-z0-9]/g, "").length >= 20 ? text : "", pages };
}

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
