import { describe, expect, it } from "vitest";
import { construirEscalaGrafico } from "../lib/chart";

describe("construirEscalaGrafico", () => {
  it("define o eixo pelo total de atividades, não pelas conclusões", () => {
    expect(construirEscalaGrafico([3, 10, 0]).maximo).toBe(10);
    expect(construirEscalaGrafico([32, 200, 50]).maximo).toBe(200);
  });

  it("mantém a capacidade de um card mesmo sem atividades concluídas", () => {
    expect(construirEscalaGrafico([50]).maximo).toBe(50);
  });

  it("inclui o nível 1 e mantém escala válida sem atividades", () => {
    expect(construirEscalaGrafico([0, 0])).toEqual({
      maximo: 1,
      ticks: [0, 1],
    });
  });
});
