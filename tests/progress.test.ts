import { describe, expect, it } from "vitest";
import { calcularPercentual } from "../lib/progress";

describe("calcularPercentual", () => {
  it("todos os itens têm o mesmo peso", () => {
    expect(calcularPercentual(2, 4)).toBe(50);
    expect(calcularPercentual(1, 4)).toBe(25);
    expect(calcularPercentual(4, 4)).toBe(100);
    expect(calcularPercentual(0, 4)).toBe(0);
  });

  it("arredonda para inteiro", () => {
    expect(calcularPercentual(1, 3)).toBe(33);
    expect(calcularPercentual(2, 3)).toBe(67);
  });

  it("dia sem itens previstos é NULO, não 0%", () => {
    expect(calcularPercentual(0, 0)).toBeNull();
    expect(calcularPercentual(3, 0)).toBeNull();
    expect(calcularPercentual(0, -1)).toBeNull();
  });
});
