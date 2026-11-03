import { describe, expect, it } from "vitest";
import { validateSampleInput, type SampleInput } from "./sample-input";

const base: SampleInput = {
  orderType: "PRODUKSI", orderNo: "", orderDate: "", spkNo: "2609001", customerName: "", motif: "", colorDirection: "", colorCode: "",
  processTypeId: "p1", machineId: "m1", newProcess: "", newMachine: "", newMachineP: "",
  fabricProblem: "", problemDescription: "", receivedDate: "2026-11-03", dueDate: "2026-11-10", isUrgent: false,
};
const ok = (r: ReturnType<typeof validateSampleInput>) => ("data" in r ? r.data : (expect.fail(r.error) as never));

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
