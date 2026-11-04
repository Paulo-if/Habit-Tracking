import { describe, expect, it } from "vitest";
import { construirEscalaGrafico } from "../lib/chart";

describe("construirEscalaGrafico", () => {
  it("mantém o domínio em zero e no maior total do período", () => {
    expect(construirEscalaGrafico([10, 5, 0, 8])).toMatchObject({
      maximo: 10,
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
