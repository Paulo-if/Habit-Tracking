import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { marcarEntrada } from "../lib/entries";
import {
  arquivarHabito,
  atualizarHabito,
  criarHabito,
} from "../lib/habits";
import { obterDadosGrafico } from "../lib/queries";
import { garantirRegistrosAte } from "../lib/records";
import type { Entrada, Habito } from "../lib/types";
import {
  bancoDeTeste,
  datasDasEntradas,
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

function entradaDoDia(data: string): Entrada | undefined {
  return listarEntradas(db).find((entrada) => entrada.data === data);
}

describe("criarHabito", () => {
  it("cria o registro de hoje quando o dia está selecionado", async () => {
    // 22/10/2026 é quinta-feira (ISO 4)
    const resultado = await criarHabito(db, "Caminhar", [4], "2026-10-22");
    expect(resultado.ok).toBe(true);

    const entradas = listarEntradas(db);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      data: "2026-10-22",
      titulo: "Caminhar",
      concluido: 0,
    });
  });

  it("não cria nada se hoje não está entre os dias escolhidos", async () => {
    await criarHabito(db, "Caminhar", [6, 7], "2026-10-22");
    expect(listarEntradas(db)).toHaveLength(0);
  });

  it("rejeita nome vazio e lista de dias vazia", async () => {
    expect((await criarHabito(db, "   ", [1], "2026-10-22")).ok).toBe(false);
    expect((await criarHabito(db, "Ler", [], "2026-10-22")).ok).toBe(false);
  });
});

describe("atualizarHabito", () => {
  it("mudança de frequência não altera o passado", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");
    await marcarEntrada(db, listarEntradas(db)[1].id, true, "2026-10-21");

    const antes = listarEntradas(db).map((e) => ({
      data: e.data,
      titulo: e.titulo,
      concluido: e.concluido,
    }));

    // Na quinta 22/10 passa a valer "só segunda-feira".
    const resultado = await atualizarHabito(db, id, "Ler", [1], "2026-10-22");
    expect(resultado.ok).toBe(true);

    const depois = listarEntradas(db)
      .filter((e) => e.data <= "2026-10-21")
      .map((e) => ({
        data: e.data,
        titulo: e.titulo,
        concluido: e.concluido,
      }));

    expect(depois).toEqual(antes);
    expect(entradaDoDia("2026-10-22")).toBeUndefined();

    await garantirRegistrosAte(db, "2026-10-26");
    expect(entradaDoDia("2026-10-26")).toBeDefined();
    expect(entradaDoDia("2026-10-23")).toBeUndefined();
  });

  it("cada alteração de frequência cria uma NOVA linha de schedule", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await atualizarHabito(db, id, "Ler", [1, 3], "2026-10-22");
    await atualizarHabito(db, id, "Ler", [2, 4], "2026-10-23");

    const horarios = db
      .prepare(
        `SELECT dias_da_semana, vigente_desde FROM habit_schedules
         WHERE habit_id = ? ORDER BY vigente_desde`,
      )
      .all(id) as Array<{ dias_da_semana: string; vigente_desde: string }>;

    expect(horarios).toEqual([
      { dias_da_semana: "1,2,3,4,5,6,7", vigente_desde: "2026-10-19" },
      { dias_da_semana: "1,3", vigente_desde: "2026-10-22" },
      { dias_da_semana: "2,4", vigente_desde: "2026-10-23" },
    ]);
  });

  it("não duplica schedule quando os dias não mudam", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3],
    });

    await atualizarHabito(db, id, "Ler", [3, 2, 1], "2026-10-22");
    await atualizarHabito(db, id, "Ler", [1, 2, 3], "2026-10-23");

    const total = (
      db
        .prepare(
          "SELECT COUNT(*) AS total FROM habit_schedules WHERE habit_id = ?",
        )
        .get(id) as { total: number }
    ).total;

    expect(total).toBe(1);
  });

  it("renomear congela o passado e atualiza de hoje em diante", async () => {
    const id = inserirHabito(db, {
      nome: "Antigo",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");

    await atualizarHabito(db, id, "Novo", [1, 2, 3, 4, 5, 6, 7], "2026-10-22");

    const entradas = listarEntradas(db);
    for (const entrada of entradas) {
      if (entrada.data < "2026-10-22") {
        expect(entrada.titulo).toBe("Antigo");
      } else {
        expect(entrada.titulo).toBe("Novo");
      }
    }
    expect(entradaDoDia("2026-10-22")?.titulo).toBe("Novo");
  });

  it("tirar hoje da frequência remove só o item não concluído de hoje", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-22");
    expect(entradaDoDia("2026-10-22")).toBeDefined();

    await atualizarHabito(db, id, "Ler", [1], "2026-10-22");
    expect(entradaDoDia("2026-10-22")).toBeUndefined();
    expect(datasDasEntradas(db)).toContain("2026-10-21");
  });

  it("nunca apaga um item já concluído de hoje", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-22");
    const hoje = entradaDoDia("2026-10-22")!;
    await marcarEntrada(db, hoje.id, true, "2026-10-22");

    await atualizarHabito(db, id, "Ler", [1], "2026-10-22");

    expect(entradaDoDia("2026-10-22")?.concluido).toBe(1);
  });
});

describe("arquivarHabito", () => {
  it("preserva todo o histórico anterior", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");
    await marcarEntrada(db, listarEntradas(db)[1].id, true, "2026-10-21");

    const antes = listarEntradas(db).map((e) => ({ ...e }));

    await arquivarHabito(db, id, "2026-10-22");

    const depois = listarEntradas(db).filter((e) => e.data <= "2026-10-21");
    expect(depois).toEqual(antes);
    expect(entradaDoDia("2026-10-22")).toBeUndefined();

    const habito = db
      .prepare("SELECT * FROM habits WHERE id = ?")
      .get(id) as Habito;
    expect(habito.arquivado_em).toBe("2026-10-22");

    await garantirRegistrosAte(db, "2026-10-30");
    expect(entradaDoDia("2026-10-23")).toBeUndefined();
    expect(entradaDoDia("2026-10-30")).toBeUndefined();
  });

  it("preserva o histórico anterior e remove registros do dia do arquivamento em diante", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-22");
    const entradaHoje = entradaDoDia("2026-10-22")!;
    await marcarEntrada(db, entradaHoje.id, true, "2026-10-22");
    await db.run(
      `INSERT INTO entries
         (data, habit_id, titulo, concluido, concluido_em, ordem, tipo)
       VALUES (?, ?, ?, 0, NULL, 0, 'habito')`,
      "2026-10-23",
      id,
      "Ler",
    );

    await arquivarHabito(db, id, "2026-10-22");

    expect(entradaDoDia("2026-10-21")).toBeDefined();
    expect(entradaDoDia("2026-10-22")).toBeUndefined();
    expect(entradaDoDia("2026-10-23")).toBeUndefined();

    await expect(
      obterDadosGrafico(db, "2026-10-21", "2026-10-23"),
    ).resolves.toMatchObject([
      { data: "2026-10-21", concluidas: 0, total: 1 },
      { data: "2026-10-22", concluidas: 0, total: 0 },
      { data: "2026-10-23", concluidas: 0, total: 0 },
    ]);
  });
});
