/** Grup pemroses di laboratorium. Operator memilih grup saat mulai memproses pengajuan. */
export const PROCESSOR_GROUPS = [
  ["ALNI", "ATYKAH", "SELA"],
  ["ALFATH", "KASIM", "NOPAL"],
  ["PIO", "NURJANAH", "JELYN"],
  ["RAHMA", "SYIFA", "CAHYONO"],
] as const;

/** Nama yang disimpan & ditampilkan, mis. "Grup ALNI, ATYKAH, SELA". */
export const PROCESSOR_GROUP_NAMES: string[] = PROCESSOR_GROUPS.map((g) => `Grup ${g.join(", ")}`);

export const isProcessorGroup = (name: string) => PROCESSOR_GROUP_NAMES.includes(name);
