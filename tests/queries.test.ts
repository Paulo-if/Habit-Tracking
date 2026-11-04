import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarTarefaAvulsa, marcarEntrada } from "../lib/entries";
import { obterDadosGrafico, obterDias, obterSemana } from "../lib/queries";
import {
  garantirRegistrosAte,
  garantirRegistrosDoDia,
} from "../lib/records";
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

describe("obterSemana", () => {
  it("dias futuros com registros existentes ficam editáveis", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-21");
    await garantirRegistrosDoDia(db, "2026-10-22");

    const dias = await obterSemana(db, "2026-10-19", "2026-10-21");

    expect(dias).toHaveLength(7);
    expect(dias.slice(0, 3).every((dia) => dia.editavel)).toBe(true);
    expect(dias[3]).toMatchObject({
      ehFuturo: true,
      editavel: true,
      ehPrevia: false,
    });
    expect(dias[3].itens[0]).toMatchObject({ id: expect.any(Number), titulo: "Ler" });
  });

  it("dia sem itens previstos fica vazio (sem erro de divisão)", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1], // só segunda
    });
    await garantirRegistrosAte(db, "2026-10-21");

    const dias = await obterSemana(db, "2026-10-19", "2026-10-21");
    const terca = dias.find((dia) => dia.data === "2026-10-20")!;

    expect(terca.itens).toEqual([]);
    expect(terca.ehPrevia).toBe(false);
  });

  it("histórico só mostra dias <= hoje que têm registros", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 3], // segunda e quarta
    });
    await garantirRegistrosAte(db, "2026-10-21");
    await criarTarefaAvulsa(db, "2026-10-20", "Dentista", "2026-10-21");

    const dias = await obterSemana(db, "2026-10-19", "2026-10-21", true);

    expect(dias.map((dia) => dia.data)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
    ]);
  });

  it("histórico não mostra dias futuros nem semanas vazias", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1],
    });
    await garantirRegistrosAte(db, "2026-10-21");

    const semanaAtual = await obterSemana(db, "2026-10-19", "2026-10-21", true);
    expect(semanaAtual.map((dia) => dia.data)).toEqual(["2026-10-19"]);

    const semanaVazia = await obterSemana(db, "2026-10-05", "2026-10-21", true);
    expect(semanaVazia).toEqual([]);
  });
});

describe("obterDias", () => {
  it("monta datas arbitrárias, com prévia no futuro", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-21");

    const dias = await obterDias(
      db,
      ["2026-10-21", "2026-10-19", "2026-10-23"],
      "2026-10-21",
    );

    expect(dias.map((dia) => dia.data)).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
    expect(dias[0].itens).toHaveLength(1);
    expect(dias[1].ehHoje).toBe(true);
    expect(dias[2]).toMatchObject({
      ehFuturo: true,
      editavel: true,
      ehPrevia: true,
    });
    expect(dias[2].itens[0]).toMatchObject({ id: null, titulo: "Ler" });
  });
});

describe("obterDadosGrafico", () => {
  it("conta somente atividades concluídas e inclui datas sem conclusão com zero", async () => {
    const registros = [
      { data: "2026-10-19", concluidas: 2, pendentes: 1 },
      { data: "2026-10-20", concluidas: 3, pendentes: 0 },
      { data: "2026-10-22", concluidas: 1, pendentes: 4 },
    ];

    for (const registro of registros) {
      for (let i = 0; i < registro.concluidas + registro.pendentes; i += 1) {
        await db.run(
          `INSERT INTO entries
             (data, titulo, concluido, ordem, tipo)
           VALUES (?, ?, ?, ?, 'avulsa')`,
          registro.data,
          `Atividade ${i + 1}`,
          i < registro.concluidas ? 1 : 0,
          i,
        );
      }
    }

    const pontos = await obterDadosGrafico(db, "2026-10-19", "2026-10-22");
    expect(pontos.map((ponto) => ponto.concluidas)).toEqual([2, 3, 0, 1]);
  });

  it("atualiza a contagem ao concluir e desfazer uma atividade", async () => {
    const resultado = await criarTarefaAvulsa(
      db,
      "2026-10-19",
      "Dentista",
      "2026-10-19",
    );
    if (!resultado.ok) throw new Error(resultado.erro);

    const consultarContagem = async () => {
      const [ponto] = await obterDadosGrafico(
        db,
        "2026-10-19",
        "2026-10-19",
      );
      return ponto.concluidas;
    };

    expect(await consultarContagem()).toBe(0);
    await marcarEntrada(db, resultado.id, true, "2026-10-19");
    expect(await consultarContagem()).toBe(1);
    await marcarEntrada(db, resultado.id, false, "2026-10-19");
    expect(await consultarContagem()).toBe(0);
  });

  it("conta tarefas avulsas e hábitos concluídos, não as pendentes", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1],
    });
    await garantirRegistrosAte(db, "2026-10-19");

    const entrada = listarEntradas(db)[0];
    await marcarEntrada(db, entrada.id, true, "2026-10-19");
    await criarTarefaAvulsa(db, "2026-10-19", "Dentista", "2026-10-19");

    let pontos = await obterDadosGrafico(db, "2026-10-19", "2026-10-19");
    expect(pontos[0].concluidas).toBe(1);

    const tarefaPendente = listarEntradas(db).find(
      (item) => item.titulo === "Dentista",
    )!;
    await marcarEntrada(db, tarefaPendente.id, true, "2026-10-19");

    pontos = await obterDadosGrafico(db, "2026-10-19", "2026-10-19");
    expect(pontos[0].concluidas).toBe(2);
  });
});
