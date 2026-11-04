import { describe, expect, it } from "vitest";
import { construirEscalaGrafico } from "../lib/chart";

describe("construirEscalaGrafico", () => {
  it("mantém o domínio em zero e no maior número de conclusões", () => {
    expect(construirEscalaGrafico([2, 8, 0])).toMatchObject({
      maximo: 8,
    });
    expect(construirEscalaGrafico([15, 2, 0])).toMatchObject({
      maximo: 15,
    });
  });

  it("inclui o nível 1 e mantém escala válida sem atividades", () => {
    expect(construirEscalaGrafico([0, 0])).toEqual({
      maximo: 1,
      ticks: [0, 1],
    });
  });
});
