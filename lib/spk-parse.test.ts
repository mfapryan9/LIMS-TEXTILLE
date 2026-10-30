import { describe, it, expect } from "vitest";
import { matchOption, parseDate, parseSpkText } from "./spk-parse";

const masters = {
  processTypes: [
    { id: "p1", name: "Dyeing Reaktif" },
    { id: "p2", name: "Dyeing Disperse" },
    { id: "p3", name: "Finishing" },
  ],
  machines: [
    { id: "m1", name: "Jet Dyeing JD-01" },
    { id: "m2", name: "Winch W-02" },
    { id: "m3", name: "Lab Dyer LD-03" },
  ],
};

describe("parseDate", () => {
  it("format Indonesia hari/bulan/tahun", () => expect(parseDate("05/11/2026")).toBe("2026-11-05"));
  it("nama bulan Indonesia", () => expect(parseDate("Tgl 3 Okt 2026")).toBe("2026-10-03"));
  it("ISO", () => expect(parseDate("2026-12-01")).toBe("2026-12-01"));
  it("tanggal tidak valid diabaikan", () => expect(parseDate("31/02/2026")).toBeUndefined());
});

describe("matchOption", () => {
  it("kode mesin tanpa tanda hubung", () => expect(matchOption("JD01", masters.machines)).toBe("m1"));
  it("nama proses", () => expect(matchOption("dyeing reaktif (cotton)", masters.processTypes)).toBe("p1"));
  it("tidak ada yang mirip", () => expect(matchOption("xyz", masters.machines)).toBeUndefined());
});

describe("parseSpkText", () => {
  it("form SPK berlabel", () => {
    const text = `
      PT. NAGASAKTI KURNIA TEXTILE MILLS
      SURAT PERINTAH KERJA - MARKETING
      No. SPK : spk-2026-130
      Customer : PT Sinar Tekstil
      Motif : Batik Parang
      Kode Warna : CM 415
      Arah Warna : Lebih biru
      Proses : Dyeing Disperse
      Mesin : Winch W 02
      Tgl Terima : 28/10/2026
      Due Date : 4 Nov 2026
    `;
    const { draft, found } = parseSpkText(text, masters);
    expect(draft).toEqual({
      orderType: "MARKETING",
      spkNo: "SPK-2026-130",
      customerName: "PT Sinar Tekstil",
      motif: "Batik Parang",
      colorCode: "CM-415",
      colorDirection: "Lebih biru",
      processTypeId: "p2",
      machineId: "m2",
      receivedDate: "2026-10-28",
      dueDate: "2026-11-04",
    });
    expect(found).toContain("spkNo");
  });

  it("beberapa field dalam satu baris & nilai di baris berikutnya", () => {
    const text = "Customer: CV Buana Warna     Motif: Floral\nKode Warna\nCM-204\nProduksi";
    const { draft } = parseSpkText(text, masters);
    expect(draft.customerName).toBe("CV Buana Warna");
    expect(draft.motif).toBe("Floral");
    expect(draft.colorCode).toBe("CM-204");
    expect(draft.orderType).toBe("PRODUKSI");
  });

  it("kartu SPK dengan kolom seperti Excel (No. Order, Tgl Order, Tgl Mulai diabaikan)", () => {
    const text = [
      "NO. ORDER : 26-3012",
      "TGL ORDER : 01/09/2026",
      "NO.SPK : 2602108",
      "PROSES LAB : Dyeing Reaktif",
      "TGL TERIMA : 02/09/2026",
      "TGL MULAI : 03/09/2026",
      "DUE DATE : 09/09/2026",
    ].join("\n");
    const { draft } = parseSpkText(text, masters);
    expect(draft).toMatchObject({
      orderNo: "26-3012",
      orderDate: "2026-09-01",
      spkNo: "2602108",
      processTypeId: "p1",
      receivedDate: "2026-09-02",
      dueDate: "2026-09-09",
    });
  });

  it("cadangan pola tanpa label", () => {
    const text = "SPK-2026-140\nwarna cm-777 jet dyeing jd01\n01/11/2026 sampai 08/11/2026";
    const { draft } = parseSpkText(text, masters);
    expect(draft.spkNo).toBe("SPK-2026-140");
    expect(draft.colorCode).toBe("CM-777");
    expect(draft.machineId).toBe("m1");
    expect(draft.receivedDate).toBe("2026-11-01");
    expect(draft.dueDate).toBe("2026-11-08");
  });
});
