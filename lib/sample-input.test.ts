import { describe, expect, it } from "vitest";
import { validateSampleInput, type SampleInput } from "./sample-input";

const base: SampleInput = {
  orderType: "PRODUKSI", orderNo: "26-4001", orderDate: "", spkNo: "2609001", customerName: "PT Sinar Tekstil", motif: "", colorDirection: "", colorCode: "415", colorName: "Merah marun", parties: ["P-01"], requesterName: "Rina",
  processTypeId: "p1", machineId: "m1", newProcess: "", newMachine: "", newMachineP: "",
  fabricProblem: "", problemDescription: "", receivedDate: "2026-11-03", dueDate: "2026-11-10", isUrgent: false,
};
const ok = (r: ReturnType<typeof validateSampleInput>) => ("data" in r ? r.data : (expect.fail(r.error) as never));

describe("validateSampleInput: pengajuan PPIC (Sprint 3)", () => {
  it("No. Order dan CM warna wajib diisi", () => {
    expect(validateSampleInput({ ...base, orderNo: "" })).toEqual({ error: "Nomor Order wajib diisi" });
    expect(validateSampleInput({ ...base, colorCode: " " })).toEqual({ error: "No. CM wajib diisi" });
  });

  it("partai opsional dan bisa lebih dari satu: dirapikan, kapital, tanpa ganda", () => {
    expect(ok(validateSampleInput({ ...base, parties: [" p-01 ", "P-02", "", "p-01"] })).parties).toEqual(["P-01", "P-02"]);
    expect(ok(validateSampleInput({ ...base, parties: [" "] })).parties).toEqual([]);
  });

  it("No. CM hanya angka (awalan CM dibuang) dan motif berformat TR-62", () => {
    expect(ok(validateSampleInput({ ...base, colorCode: "CM-102" })).colorCode).toBe("102");
    expect(ok(validateSampleInput({ ...base, colorCode: "cm 13944 / 3" })).colorCode).toBe("13944/3");
    expect(validateSampleInput({ ...base, colorCode: "merah" })).toEqual({ error: "No. CM diisi angka saja, mis. 13944/3" });
    expect(ok(validateSampleInput({ ...base, motif: "tr62" })).motif).toBe("TR-62");
    expect(ok(validateSampleInput({ ...base, motif: "TR 71-3" })).motif).toBe("TR-71-3");
    expect(ok(validateSampleInput({ ...base, motif: "Floral" })).motif).toBe("Floral");
  });

  it("nama customer wajib diisi", () => {
    expect(validateSampleInput({ ...base, customerName: " " })).toEqual({ error: "Nama customer wajib diisi" });
  });

  it("nama pengaju wajib diisi", () => {
    expect(validateSampleInput({ ...base, requesterName: "" })).toHaveProperty("error");
  });

  it("No. SPK mengikuti No. Order bila tidak diisi", () => {
    expect(ok(validateSampleInput({ ...base, spkNo: "", orderNo: "26-4002" })).spkNo).toBe("26-4002");
  });
});

describe("validateSampleInput: proses / kelompok mesin baru & urgent", () => {
  it("menerima pilihan dari daftar dan mengabaikan isian baru", () => {
    const d = ok(validateSampleInput({ ...base, newProcess: "x", newMachine: "y", newMachineP: "2" }));
    expect([d.newProcess, d.newMachine, d.newMachineP]).toEqual(["", "", ""]);
  });

  it("menerima proses baru di kelompok yang sudah ada (nama jadi kapital)", () => {
    const d = ok(validateSampleInput({ ...base, processTypeId: "", newProcess: "  proof   pigment " }));
    expect(d.newProcess).toBe("PROOF PIGMENT");
  });

  it("kelompok mesin baru wajib punya p > 0 (koma desimal diterima)", () => {
    const input = { ...base, machineId: "", processTypeId: "", newMachine: "F. Rotary", newProcess: "PROOF ROTARY" };
    expect(validateSampleInput({ ...input, newMachineP: "" })).toHaveProperty("error");
    expect(validateSampleInput({ ...input, newMachineP: "0" })).toHaveProperty("error");
    expect(ok(validateSampleInput({ ...input, newMachineP: "1,5" })).newMachineP).toBe("1.5");
  });

  it("menolak bila proses / kelompok tidak dipilih maupun diisi", () => {
    expect(validateSampleInput({ ...base, processTypeId: "" })).toEqual({ error: "Proses lab wajib dipilih atau diisi" });
    expect(validateSampleInput({ ...base, machineId: "" })).toEqual({ error: "Kelompok mesin wajib dipilih atau diisi" });
  });

  it("urgent hanya true bila benar-benar boolean true", () => {
    expect(ok(validateSampleInput({ ...base, isUrgent: true })).isUrgent).toBe(true);
    expect(ok(validateSampleInput({ ...base, isUrgent: "true" as unknown as boolean })).isUrgent).toBe(false);
  });
});
