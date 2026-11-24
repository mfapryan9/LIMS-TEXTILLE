import { describe, expect, it } from "vitest";
import { parseQrp, qrpPageText } from "./qrp-read";
import { parseSpkText } from "./spk-parse";

/** Susun file .QRP tiruan: header QuickReport + satu halaman EMF berisi record teks dan kotak. */
function record(type: number, body: Uint8Array): Uint8Array {
  const size = 8 + body.length;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, type, true);
  dv.setUint32(4, size, true);
  out.set(body, 8);
  return out;
}

function textRecord(x: number, y: number, text: string): Uint8Array {
  const chars = new Uint8Array(Math.ceil((text.length * 2) / 4) * 4);
  for (let i = 0; i < text.length; i++) new DataView(chars.buffer).setUint16(i * 2, text.charCodeAt(i), true);
  const body = new Uint8Array(68 + chars.length);
  const dv = new DataView(body.buffer);
  dv.setInt32(8, x + text.length * 7, true); // rclBounds.right
  dv.setInt32(28, x, true); // ptlReference.x (offset 36 dari awal record)
  dv.setInt32(32, y, true);
  dv.setUint32(36, text.length, true); // nChars
  dv.setUint32(40, 76, true); // offString dari awal record
  body.set(chars, 68);
  return record(84, body);
}

function rectRecord(l: number, t: number, r: number, b: number): Uint8Array {
  const body = new Uint8Array(16);
  const dv = new DataView(body.buffer);
  [l, t, r, b].forEach((v, i) => dv.setInt32(i * 4, v, true));
  return record(43, body);
}

function qrpFile(items: [number, number, string][]): Uint8Array {
  const recs = [rectRecord(30, 20, 790, 1090), ...items.map(([x, y, t]) => textRecord(x, y, t)), record(14, new Uint8Array(12))];
  const header = new Uint8Array(100);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, 1, true);
  hv.setUint32(4, 100, true);
  hv.setInt32(16, 755, true);
  hv.setInt32(20, 1081, true);
  header.set([0x20, 0x45, 0x4d, 0x46], 40);
  const pageLen = header.length + recs.reduce((n, r) => n + r.length, 0);
  hv.setUint32(48, pageLen, true);
  const prefix = new Uint8Array(0x88); // header QuickReport (diabaikan)
  const out = new Uint8Array(prefix.length + pageLen + 16);
  let o = 0;
  for (const part of [prefix, header, ...recs]) { out.set(part, o); o += part.length; }
  return out;
}

const SAMPLE: [number, number, string][] = [
  [756, 31, "  NT-FM-G-10  "], [396, 50, " PERMINTAAN PENGUJIAN "],
  [42, 80, "NOMOR ORDER "], [166, 80, " : "], [180, 80, "26-1545"],
  [42, 104, "TANGGAL ORDER "], [166, 104, " : "], [180, 104, "06 MEI 2026"],
  [42, 128, "DESKRIPSI ORDER "], [166, 128, " : "], [180, 128, "-"],
  [689, 157, " SAMPLE "],
  [58, 175, "JENIS PROBLEM "], [165, 175, " : "], [180, 175, "WARNA BARU"],
  [58, 200, "PROSES LABORAT "], [165, 200, " : "], [180, 200, "PROOF DISPERSE"],
  [90, 240, "PARTAI "], [165, 240, " : "], [180, 240, "-"],
  [90, 265, "NO. SPK "], [165, 265, " : "], [180, 265, "2601227"],
  [90, 290, "CUSTOMER "], [165, 290, " : "], [180, 290, "CONTOH TEXTILE CV"],
  [90, 315, "MOTIF "], [165, 315, " : "], [180, 315, "TR 201-1"],
  [90, 340, "NO. CM "], [165, 340, " : "], [180, 340, "13481/18"],
  [90, 365, "WARNA "], [165, 365, " : "], [180, 365, "NAVY"],
  [40, 548, "DESKRIPSI HASIL  "], [689, 567, " SAMPLE "],
  [115, 961, " TGL SELESAI "], [473, 961, " MENGETAHUI"],
  [262, 990, "KA.PRODUKSI"], [402, 990, "KA.LABORAT"],
];

describe("parseQrp", () => {
  it("mengambil teks, posisi, dan kotak dari halaman EMF", () => {
    const [page] = parseQrp(qrpFile(SAMPLE));
    expect(page.width).toBe(755);
    expect(page.rects).toHaveLength(1);
    expect(page.texts.find((t) => t.text === "26-1545")).toMatchObject({ x: 180, y: 80 });
  });

  it("menolak file tanpa halaman EMF", () => {
    expect(() => parseQrp(new Uint8Array(500))).toThrow();
  });

  it("tidak membaca di luar batas record yang rusak", () => {
    const f = qrpFile(SAMPLE);
    new DataView(f.buffer).setUint32(0x88 + 100 + 4, 0xfffffff0, true); // ukuran record pertama tidak masuk akal
    expect(() => parseQrp(f)).toThrow();
  });
});

describe("qrpPageText + parseSpkText: kartu Permintaan Pengujian", () => {
  const text = qrpPageText(parseQrp(qrpFile(SAMPLE))[0]);

  it("menyusun baris label : nilai, membuang isian kosong dan bagian hasil/tanda tangan", () => {
    expect(text).toContain("NOMOR ORDER : 26-1545");
    expect(text).not.toMatch(/DESKRIPSI ORDER|PARTAI|KA\.PRODUKSI|TGL SELESAI/);
  });

  it("mengisi kolom pengajuan", () => {
    const { draft } = parseSpkText(text, { processTypes: [{ id: "p1", name: "PROOF DISPERSE" }, { id: "p2", name: "PROOF REAKTIF" }], machines: [] });
    expect(draft).toMatchObject({
      orderNo: "26-1545",
      orderDate: "2026-05-06",
      spkNo: "2601227",
      customerName: "CONTOH TEXTILE CV",
      motif: "TR-201-1", // dinormalisasi seperti input manual
      colorCode: "13481/18",
      colorName: "NAVY",
      problemDescription: "WARNA BARU",
      processTypeId: "p1",
    });
    expect(draft.orderType).toBeUndefined(); // "KA.PRODUKSI" di tanda tangan tidak dianggap jenis order
    expect(draft.parties).toBeUndefined();
  });
});
