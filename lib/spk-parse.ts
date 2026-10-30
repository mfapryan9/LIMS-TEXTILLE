/**
 * Menerjemahkan teks hasil OCR (Tesseract) dari SPK cetak menjadi isian form sampel.
 * Strategi:
 *   1. Baris berlabel ("No. SPK : ...", "Customer: ...") → nilai setelah label.
 *      Label tanpa nilai di barisnya → ambil baris berikutnya.
 *   2. Pola cadangan pada seluruh teks: nomor SPK, kode warna CM-xxx, tanggal.
 *   3. Nama proses & mesin dicocokkan ke master data (kemiripan token).
 * Semua hasil hanya draf: user wajib memeriksa & bisa mengedit sebelum disimpan.
 */

export interface SpkDraft {
  orderType?: "PRODUKSI" | "MARKETING";
  spkNo?: string;
  customerName?: string;
  motif?: string;
  colorDirection?: string;
  colorCode?: string;
  processTypeId?: string;
  machineId?: string;
  fabricProblem?: string;
  receivedDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
}

export type SpkField = keyof SpkDraft;

interface Option {
  id: string;
  name: string;
}

type TextField = Exclude<SpkField, "orderType" | "processTypeId" | "machineId">;
type LabelTarget = TextField | "orderType" | "process" | "machine";

// Urutan penting: label yang lebih spesifik diperiksa dulu ("arah warna" sebelum "warna").
const LABELS: [LabelTarget, string[]][] = [
  ["spkNo", ["nomor spk", "no. spk", "no.spk", "no spk", "spk no", "spk"]],
  ["customerName", ["nama customer", "nama pelanggan", "customer", "pelanggan", "buyer", "konsumen"]],
  ["colorDirection", ["arah warna", "color direction", "arah"]],
  ["colorCode", ["kode warna", "color code", "kode cm", "no. warna", "no warna", "warna"]],
  ["motif", ["motif", "desain", "design", "corak"]],
  ["process", ["jenis proses", "proses lab", "proses", "process"]],
  ["machine", ["mesin", "machine"]],
  ["fabricProblem", ["problem kain", "masalah kain", "problem", "kendala"]],
  ["dueDate", ["due date", "deadline", "jatuh tempo", "tanggal kirim", "tgl kirim", "tgl. kirim", "tanggal selesai", "tgl selesai", "target"]],
  ["receivedDate", ["tanggal terima", "tgl terima", "tgl. terima", "tanggal masuk", "tgl masuk", "tanggal", "tgl", "date"]],
  ["orderType", ["jenis order", "tipe order", "order"]],
];

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, nopember: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function toIso(y: number, m: number, d: number): string | undefined {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined; // mis. 31 Februari
  return `${y}-${pad(m)}-${pad(d)}`;
}

const DATE_PATTERNS: [RegExp, (m: RegExpMatchArray) => string | undefined][] = [
  [/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, (m) => toIso(+m[1], +m[2], +m[3])],
  [/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/, (m) => toIso(+m[3], +m[2], +m[1])],
  [/\b(\d{1,2})[\s-]+([a-z]{3,9})\.?[\s-]+(\d{4})\b/i, (m) => {
    const month = MONTHS[m[2].toLowerCase()];
    return month ? toIso(+m[3], month, +m[1]) : undefined;
  }],
];

/** Tanggal pertama dalam teks sebagai YYYY-MM-DD (format Indonesia: hari dulu). */
export function parseDate(text: string): string | undefined {
  for (const [re, conv] of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const iso = conv(m);
      if (iso) return iso;
    }
  }
  return undefined;
}

function allDates(text: string): string[] {
  const out: string[] = [];
  for (const [re, conv] of DATE_PATTERNS) {
    for (const m of Array.from(text.matchAll(new RegExp(re.source, re.flags + "g")))) {
      const iso = conv(m);
      if (iso && !out.includes(iso)) out.push(iso);
    }
  }
  return out;
}

const clean = (v: string) =>
  v.replace(/^[\s:;=.\-–|]+/, "").replace(/[\s|;]+$/, "").replace(/\s{2,}/g, " ").trim();

function normalizeColorCode(v: string): string {
  const m = v.match(/\bCM[\s\-.]?(\d{2,6})\b/i);
  return m ? `CM-${m[1]}` : clean(v).toUpperCase();
}

function normalizeSpk(v: string): string {
  return clean(v).toUpperCase().replace(/\s+/g, "");
}

const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);

/** Pilih opsi master yang paling mirip dengan teks (berbagi token terbanyak). */
export function matchOption(value: string, options: Option[]): string | undefined {
  const v = tokens(value);
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  let best: { id: string; score: number } | undefined;
  for (const o of options) {
    const ot = tokens(o.name);
    let score = ot.filter((t) => v.includes(t)).length;
    // Kode mesin seperti "JD-01" sering terbaca "JD01" / "JD 01"
    for (const t of o.name.match(/[A-Za-z]+-?\d+/g) ?? []) {
      if (compact.includes(t.toLowerCase().replace("-", ""))) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: o.id, score };
  }
  return best?.id;
}

function splitSegments(line: string): string[] {
  // Beberapa field dalam satu baris dipisah spasi lebar / garis tabel
  return line.split(/\s{3,}|\t|\s\|\s/).map((s) => s.trim()).filter(Boolean);
}

function matchLabel(segment: string): { target: LabelTarget; value: string } | undefined {
  const lower = segment.toLowerCase();
  for (const [target, labels] of LABELS) {
    for (const label of labels) {
      if (!lower.startsWith(label)) continue;
      const rest = segment.slice(label.length);
      // Label harus diikuti pemisah: "spk" tidak boleh cocok dengan "SPK-2026-101" atau "spkxyz"
      if (rest && !/^[\s:.=]/.test(rest)) continue;
      return { target, value: clean(rest) };
    }
  }
  return undefined;
}

export function parseSpkText(
  text: string,
  masters: { processTypes: Option[]; machines: Option[] },
): { draft: SpkDraft; found: SpkField[] } {
  const draft: SpkDraft = {};
  const set = <K extends SpkField>(k: K, v: SpkDraft[K] | undefined) => {
    if (v !== undefined && v !== "" && draft[k] === undefined) draft[k] = v;
  };

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    for (const seg of splitSegments(lines[i])) {
      const hit = matchLabel(seg);
      if (!hit) continue;
      let value = hit.value;
      if (!value && i + 1 < lines.length && !matchLabel(lines[i + 1])) value = clean(lines[i + 1]);
      if (!value) continue;

      switch (hit.target) {
        case "spkNo": set("spkNo", normalizeSpk(value)); break;
        case "colorCode": set("colorCode", normalizeColorCode(value)); break;
        case "receivedDate":
        case "dueDate": set(hit.target, parseDate(value)); break;
        case "process": set("processTypeId", matchOption(value, masters.processTypes)); break;
        case "machine": set("machineId", matchOption(value, masters.machines)); break;
        case "orderType":
          if (/marketing/i.test(value)) set("orderType", "MARKETING");
          else if (/produksi|production/i.test(value)) set("orderType", "PRODUKSI");
          break;
        default: set(hit.target, value);
      }
    }
  }

  // ── Cadangan berbasis pola pada seluruh teks
  const spk = text.match(/\bSPK[\s\-/.]*\d[A-Z0-9\-/.]*/i); // mis. "SPK-2026-101", "SPK 2026/101"
  if (spk) set("spkNo", normalizeSpk(spk[0]));
  if (!draft.colorCode && /\bCM[\s\-.]?\d{2,6}\b/i.test(text)) set("colorCode", normalizeColorCode(text));
  if (!draft.orderType) {
    if (/\bmarketing\b/i.test(text)) set("orderType", "MARKETING");
    else if (/\bproduksi\b/i.test(text)) set("orderType", "PRODUKSI");
  }
  if (!draft.processTypeId) set("processTypeId", matchOption(text, masters.processTypes));
  if (!draft.machineId) set("machineId", matchOption(text, masters.machines));
  if (!draft.receivedDate || !draft.dueDate) {
    const dates = allDates(text).filter((d) => d !== draft.receivedDate && d !== draft.dueDate).sort();
    if (!draft.receivedDate && dates.length) set("receivedDate", dates.shift());
    if (!draft.dueDate && dates.length) set("dueDate", dates.pop());
  }

  return { draft, found: Object.keys(draft) as SpkField[] };
}
