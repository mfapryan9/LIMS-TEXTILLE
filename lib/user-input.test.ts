import { describe, expect, it } from "vitest";
import { checkPassword, validateNewUser, validateUpdateUser } from "./user-input";

describe("validasi akun pengguna", () => {
  const ok = { username: "Operator.Lab2 ", name: "  Budi   Santoso ", roleId: "r1", password: "rahasia123" };

  it("merapikan username (huruf kecil) dan nama", () => {
    expect(validateNewUser(ok)).toEqual({ data: { username: "operator.lab2", name: "Budi Santoso", roleId: "r1", password: "rahasia123" } });
  });

  it("menolak username dengan spasi / terlalu pendek / diawali titik", () => {
    for (const username of ["budi santoso", "ab", ".budi", "budi@lab"]) expect(validateNewUser({ ...ok, username })).toHaveProperty("error");
  });

  it("password minimal 8 karakter, maks 72, tanpa spasi di ujung", () => {
    expect(checkPassword("1234567")).toMatch(/minimal 8/);
    expect(checkPassword("x".repeat(73))).toMatch(/maksimal 72/);
    expect(checkPassword(" rahasia123")).toMatch(/spasi/);
    expect(checkPassword("rahasia123")).toBeNull();
  });

  it("peran wajib dipilih; isActive hanya true bila boolean true", () => {
    expect(validateNewUser({ ...ok, roleId: "" })).toEqual({ error: "Peran wajib dipilih" });
    expect(validateUpdateUser({ name: "Budi", roleId: "r1", isActive: "true" as unknown as boolean })).toEqual({ data: { name: "Budi", roleId: "r1", isActive: false } });
  });
});
