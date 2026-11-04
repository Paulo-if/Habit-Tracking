import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hojeSP } from "../lib/dates";
import {
  criarCard,
  criarCards,
  listarDatasVisiveis,
  removerCard,
} from "../lib/dayCards";
import { semearExemplo } from "../lib/db";
import { obterDias, obterSemana } from "../lib/queries";
import { garantirRegistrosAte, garantirRegistrosDoDia } from "../lib/records";
import {
  bancoDeTeste,
  inserirHabito,
  listarEntradas,
  type TestDB,
} from "./helpers";

let db: TestDB;

beforeEach(async () => {
  db = await bancoDeTeste();
});

afterEach(() => {
  db.close();
});

function datasDasEntradas(): string[] {
  return listarEntradas(db).map((entrada) => entrada.data);
}

describe("cards de dias", () => {
  it("cria um card e gera os hábitos daquela data", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    expect(await criarCard(db, "2026-10-21", "2026-10-21")).toEqual({ ok: true });

    expect(datasDasEntradas()).toEqual(["2026-10-21"]);
    expect(await listarDatasVisiveis(db, "2026-10-21")).toContain("2026-10-21");
  });

  it("gera vários dias seguidos de uma vez", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    expect(await criarCards(db, "2026-10-19", 3, "2026-10-21")).toEqual({
      ok: true,
    });

    expect(datasDasEntradas()).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
    ]);
  });

  it("cria os hábitos do dia para um card futuro editável", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    expect(await criarCard(db, "2026-10-22", "2026-10-21")).toEqual({
      ok: true,
    });

    const diaFuturo = await obterDias(db, ["2026-10-22"], "2026-10-21");
    expect(diaFuturo[0]).toMatchObject({
      data: "2026-10-22",
      ehFuturo: true,
      editavel: true,
      ehPrevia: false,
    });
    expect(diaFuturo[0].itens).toMatchObject([
      { titulo: "Ler", id: expect.any(Number) },
    ]);
  });

  it("não duplica registros se o card for criado de novo", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await criarCard(db, "2026-10-21", "2026-10-21");
    await criarCard(db, "2026-10-21", "2026-10-21");

    expect(datasDasEntradas()).toEqual(["2026-10-21"]);
  });

  it("apaga card e registros, e o dia não volta sozinho", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-20");

    expect(await removerCard(db, "2026-10-21", "2026-10-20")).toEqual({ ok: true });

    // Avança a geração até o dia apagado: ele deve ser ignorado.
    await garantirRegistrosAte(db, "2026-10-21");
    await garantirRegistrosDoDia(db, "2026-10-21");

    expect(datasDasEntradas()).toEqual(["2026-10-19", "2026-10-20"]);
    expect(await listarDatasVisiveis(db, "2026-10-21")).not.toContain("2026-10-21");
  });

  it("criar de novo o card restaura os hábitos do dia", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-21");
    await removerCard(db, "2026-10-21", "2026-10-21");

    expect(await criarCard(db, "2026-10-21", "2026-10-21")).toEqual({ ok: true });

    expect(datasDasEntradas()).toContain("2026-10-21");
    expect(await listarDatasVisiveis(db, "2026-10-21")).toContain("2026-10-21");
  });

  it("junta a semana atual com cards extras e esconde removidos", async () => {
    await criarCard(db, "2026-11-01", "2026-10-21");
    await removerCard(db, "2026-10-20", "2026-10-21");

    const datas = await listarDatasVisiveis(db, "2026-10-21");

    expect(datas).toContain("2026-10-19");
    expect(datas).not.toContain("2026-10-20");
    expect(datas).toContain("2026-10-21");
    expect(datas).toContain("2026-10-25");
    expect(datas).toContain("2026-11-01");
  });

  it("mostra na grade um card manual criado para ontem", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    expect(await criarCard(db, "2026-11-01", "2026-11-02")).toEqual({ ok: true });

    const datasVisiveis = await listarDatasVisiveis(db, "2026-11-02");
    const diasVisiveis = await obterDias(db, datasVisiveis, "2026-11-02");

    expect(datasVisiveis).toContain("2026-11-01");
    expect(diasVisiveis.map((dia) => dia.data)).toContain("2026-11-01");
    expect(
      diasVisiveis.find((dia) => dia.data === "2026-11-01")?.itens,
    ).toHaveLength(1);
  });

  it("mantém visível no histórico um card manual passado sem itens", async () => {
    expect(await criarCard(db, "2026-11-02", "2026-11-03")).toEqual({
      ok: true,
    });

    const dias = await obterSemana(db, "2026-11-02", "2026-11-03", true);
    const cardDeOntem = dias.find((dia) => dia.data === "2026-11-02");

    expect(cardDeOntem).toMatchObject({
      data: "2026-11-02",
      ehHoje: false,
      editavel: true,
      itens: [],
    });
  });

  it("valida data e quantidade", async () => {
    expect((await criarCard(db, "2026-02-31", "2026-10-21")).ok).toBe(false);
    expect((await criarCards(db, "2026-10-19", 0, "2026-10-21")).ok).toBe(false);
    expect((await criarCards(db, "2026-10-19", 367, "2026-10-21")).ok).toBe(false);
    expect((await criarCards(db, "2026-10-19", 1.5, "2026-10-21")).ok).toBe(false);
    expect((await removerCard(db, "ontem", "2026-10-21")).ok).toBe(false);
  });
});

describe("seed", () => {
  it("cria hábitos diários e nenhum histórico passado", async () => {
    const comSeed = await bancoDeTeste();
    const hoje = hojeSP();
    await semearExemplo(comSeed, hoje);
    await garantirRegistrosAte(comSeed, hoje);

    const habitos = comSeed
      .prepare("SELECT * FROM habits ORDER BY id")
      .all() as Array<{ criado_em: string }>;
    const horarios = comSeed
      .prepare("SELECT * FROM habit_schedules")
      .all() as Array<{ dias_da_semana: string }>;
    const entradas = comSeed.prepare("SELECT * FROM entries").all() as Array<{
      data: string;
    }>;

    expect(habitos).toHaveLength(2);
    expect(habitos.every((habito) => habito.criado_em === hoje)).toBe(true);
    expect(
      horarios.every((horario) => horario.dias_da_semana === "1,2,3,4,5,6,7"),
    ).toBe(true);
    expect(entradas).toHaveLength(2);
    expect(entradas.every((entrada) => entrada.data === hoje)).toBe(true);

    comSeed.close();
  });
});
