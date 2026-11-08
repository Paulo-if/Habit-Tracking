import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarCard } from "../lib/dayCards";
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

  it("histórico mostra dias passados e futuros com registros ou cards", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 3], // segunda e quarta
    });
    await garantirRegistrosAte(db, "2026-10-21");
    await criarTarefaAvulsa(db, "2026-10-20", "Dentista", "2026-10-21");
    await criarCard(db, "2026-10-22", "2026-10-21");

    const dias = await obterSemana(db, "2026-10-19", "2026-10-21", true);

    expect(dias.map((dia) => dia.data)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    expect(dias[3]).toMatchObject({
      data: "2026-10-22",
      ehFuturo: true,
      ehPrevia: false,
      itens: [],
    });
  });

  it("histórico não mostra dias futuros sem registros nem semanas vazias", async () => {
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
      descricao: "Ler por vinte minutos.",
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
    expect(dias[2].itens[0]).toMatchObject({
      id: null,
      titulo: "Ler",
      descricao: "Ler por vinte minutos.",
    });
  });

  it("carrega descrições globais dos hábitos e descrições próprias das tarefas", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
      descricao: "Ler por vinte minutos.",
    });
    await garantirRegistrosAte(db, "2026-10-19");
    const tarefa = await criarTarefaAvulsa(
      db,
      "2026-10-19",
      "Dentista",
      "2026-10-19",
    );
    if (!tarefa.ok) throw new Error(tarefa.erro);
    await db.run(
      "UPDATE entries SET descricao = ? WHERE id = ?",
      "Levar os exames.",
      tarefa.id,
    );

    const [dia] = await obterDias(db, ["2026-10-19"], "2026-10-19");
    expect(dia.itens.map((item) => item.descricao)).toEqual([
      "Ler por vinte minutos.",
      "Levar os exames.",
    ]);
  });
});

describe("obterDadosGrafico", () => {
  it("mantém conclusões e capacidade independentes em dias com muitos pendentes", async () => {
    const registros = [
      { data: "2026-11-03", total: 3, concluidas: 2 },
      { data: "2026-11-04", total: 200, concluidas: 20 },
      { data: "2026-11-05", total: 50, concluidas: 0 },
      { data: "2026-11-06", total: 500, concluidas: 500 },
    ];

    for (const registro of registros) {
      for (let i = 0; i < registro.total; i += 1) {
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

    const pontos = await obterDadosGrafico(db, "2026-11-03", "2026-11-05");
    expect(pontos).toEqual([
      { data: "2026-11-03", concluidas: 2, total: 3 },
      { data: "2026-11-04", concluidas: 20, total: 200 },
      { data: "2026-11-05", concluidas: 0, total: 50 },
    ]);
  });

  it("conta conclusões e totais separadamente, incluindo dias sem registros", async () => {
    const registros = [
      { data: "2026-10-19", concluidas: 3, pendentes: 7 },
      { data: "2026-10-20", concluidas: 5, pendentes: 0 },
      { data: "2026-10-22", concluidas: 2, pendentes: 6 },
      { data: "2026-10-23", concluidas: 100, pendentes: 100 },
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
    expect(pontos).toEqual([
      { data: "2026-10-19", concluidas: 3, total: 10 },
      { data: "2026-10-20", concluidas: 5, total: 5 },
      { data: "2026-10-21", concluidas: 0, total: 0 },
      { data: "2026-10-22", concluidas: 2, total: 8 },
    ]);
  });

  it("mantém o total ao concluir e desfazer atividades", async () => {
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
      return ponto;
    };

    expect(await consultarContagem()).toMatchObject({
      concluidas: 0,
      total: 1,
    });
    await marcarEntrada(db, resultado.id, true, "2026-10-19");
    expect(await consultarContagem()).toMatchObject({
      concluidas: 1,
      total: 1,
    });
    await marcarEntrada(db, resultado.id, false, "2026-10-19");
    expect(await consultarContagem()).toMatchObject({
      concluidas: 0,
      total: 1,
    });
  });

  it("conta hábitos e tarefas avulsas, concluídos ou pendentes", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    inserirHabito(db, {
      nome: "Caminhar",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-19");

    const habitos = listarEntradas(db);
    await marcarEntrada(db, habitos[0].id, true, "2026-10-19");
    await criarTarefaAvulsa(db, "2026-10-19", "Dentista", "2026-10-19");
    const tarefaConcluida = await criarTarefaAvulsa(
      db,
      "2026-10-19",
      "Ligar",
      "2026-10-19",
    );
    if (!tarefaConcluida.ok) throw new Error(tarefaConcluida.erro);
    await marcarEntrada(db, tarefaConcluida.id, true, "2026-10-19");

    const [ponto] = await obterDadosGrafico(db, "2026-10-19", "2026-10-19");
    expect(ponto).toEqual({
      data: "2026-10-19",
      concluidas: 2,
      total: 4,
    });
  });
});
