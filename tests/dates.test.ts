import { describe, expect, it } from "vitest";
import {
  adicionarDias,
  dataValida,
  diaDaSemanaISO,
  diasDaSemana,
  formatarDataBR,
  formatarDataLonga,
  hojeSP,
  inicioDaSemana,
  intervaloDeDias,
} from "../lib/dates";

describe("datas no fuso de São Paulo", () => {
  it("não vira o dia às 21h (23h em São Paulo ainda é o mesmo dia)", () => {
    // 02/11/2026 02:00 UTC = 01/11/2026 23:00 em São Paulo
    expect(hojeSP(new Date("2026-11-02T02:00:00.000Z"))).toBe("2026-11-01");
  });

  it("vira o dia à meia-noite de São Paulo", () => {
    // 02/11/2026 03:00 UTC = 02/11/2026 00:00 em São Paulo
    expect(hojeSP(new Date("2026-11-02T03:00:00.000Z"))).toBe("2026-11-02");
  });

  it("semana começa na segunda-feira", () => {
    expect(inicioDaSemana("2026-11-01")).toBe("2026-10-26"); // domingo
    expect(inicioDaSemana("2026-10-26")).toBe("2026-10-26"); // segunda
  });

  it("dia da semana ISO: segunda=1 ... domingo=7", () => {
    expect(diaDaSemanaISO("2026-10-19")).toBe(1);
    expect(diaDaSemanaISO("2026-10-25")).toBe(7);
  });

  it("soma dias atravessando mês e ano", () => {
    expect(adicionarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(adicionarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(adicionarDias("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("lista os sete dias da semana em ordem", () => {
    expect(diasDaSemana("2026-10-19")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("intervalo é inclusivo e vazio quando invertido", () => {
    expect(intervaloDeDias("2026-10-30", "2026-11-02")).toHaveLength(4);
    expect(intervaloDeDias("2026-11-02", "2026-10-30")).toEqual([]);
  });

  it("valida datas de verdade (rejeita 31/02)", () => {
    expect(dataValida("2026-02-28")).toBe(true);
    expect(dataValida("2026-02-31")).toBe(false);
    expect(dataValida("2026-2-3")).toBe(false);
  });

  it("formata em português", () => {
    expect(formatarDataLonga("2026-11-01")).toBe("domingo, 01/11");
    expect(formatarDataBR("2026-11-01")).toBe("01/11/2026");
  });
});
