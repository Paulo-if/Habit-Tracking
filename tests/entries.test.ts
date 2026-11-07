import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  criarTarefaAvulsa,
  excluirEntradaDoDia,
  excluirTarefaAvulsa,
  marcarEntrada,
  reordenarEntradas,
} from "../lib/entries";
import { garantirRegistrosAte, garantirRegistrosDoDia } from "../lib/records";
import type { Entrada } from "../lib/types";
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

function entradaDoDia(data: string): Entrada | undefined {
  return listarEntradas(db).find((entrada) => entrada.data === data);
}

describe("marcarEntrada", () => {
  it("marcar um dia não afeta o mesmo hábito em outro dia", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");
    const dia20 = entradaDoDia("2026-10-20")!;

    expect((await marcarEntrada(db, dia20.id, true, "2026-10-21")).ok).toBe(true);

    expect(entradaDoDia("2026-10-19")?.concluido).toBe(0);
    expect(entradaDoDia("2026-10-20")?.concluido).toBe(1);
    expect(entradaDoDia("2026-10-21")?.concluido).toBe(0);

    // Novos dias não "herdam" a marcação.
    await garantirRegistrosAte(db, "2026-10-23");
    expect(entradaDoDia("2026-10-22")?.concluido).toBe(0);
    expect(entradaDoDia("2026-10-23")?.concluido).toBe(0);
  });

  it("desmarcar limpa concluido_em", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-19");
    const entrada = entradaDoDia("2026-10-19")!;

    await marcarEntrada(db, entrada.id, true, "2026-10-19");
    expect(entradaDoDia("2026-10-19")?.concluido_em).not.toBeNull();

    await marcarEntrada(db, entrada.id, false, "2026-10-19");
    expect(entradaDoDia("2026-10-19")?.concluido).toBe(0);
    expect(entradaDoDia("2026-10-19")?.concluido_em).toBeNull();
  });

  it("permite marcar e desmarcar entradas de um dia futuro", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });
    await garantirRegistrosAte(db, "2026-10-22");
    const futuro = entradaDoDia("2026-10-22")!;

    const resultado = await marcarEntrada(db, futuro.id, true, "2026-10-21");
    expect(resultado.ok).toBe(true);
    expect(entradaDoDia("2026-10-22")?.concluido).toBe(1);
  });
});

describe("tarefas avulsas", () => {
  it("cria a primeira tarefa em uma data sem outras entradas", async () => {
    const resultado = await criarTarefaAvulsa(
      db,
      "2026-10-20",
      "Comprar pão",
      "2026-10-22",
    );
    expect(resultado.ok).toBe(true);

    const entradas = listarEntradas(db);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      data: "2026-10-20",
      titulo: "Comprar pão",
      habit_id: null,
      tipo: "avulsa",
      ordem: 0,
    });
  });

  it("cria para uma data específica e não se repete", async () => {
    const resultado = await criarTarefaAvulsa(
      db,
      "2026-10-20",
      "Comprar pão",
      "2026-10-22",
    );
    expect(resultado.ok).toBe(true);

    const entradas = listarEntradas(db);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      data: "2026-10-20",
      titulo: "Comprar pão",
      habit_id: null,
      tipo: "avulsa",
    });
  });

  describe("reordenarEntradas", () => {
    it("permite reordenar tarefas de um dia futuro", async () => {
      const primeira = await criarTarefaAvulsa(
        db,
        "2026-10-23",
        "Primeira",
        "2026-10-22",
      );
      const segunda = await criarTarefaAvulsa(
        db,
        "2026-10-23",
        "Segunda",
        "2026-10-22",
      );
      if (!primeira.ok || !segunda.ok) {
        throw new Error("Falha ao criar tarefas futuras de teste.");
      }

      expect(
        (
          await reordenarEntradas(
            db,
            "2026-10-23",
            [segunda.id, primeira.id],
            "2026-10-22",
          )
        ).ok,
      ).toBe(true);

      expect(
        db
          .prepare(
            "SELECT titulo FROM entries WHERE data = ? ORDER BY ordem ASC, id ASC",
          )
          .all("2026-10-23"),
      ).toEqual([{ titulo: "Segunda" }, { titulo: "Primeira" }]);
    });

    it("salva a ordem de hábitos e tarefas do dia e mantém novas tarefas no final", async () => {
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
      await criarTarefaAvulsa(db, "2026-10-19", "Comprar pão", "2026-10-19");

      const ids = listarEntradas(db)
        .filter((entrada) => entrada.data === "2026-10-19")
        .map((entrada) => entrada.id);
      const novaOrdem = [...ids].reverse();

      expect(
        (await reordenarEntradas(db, "2026-10-19", novaOrdem, "2026-10-19")).ok,
      ).toBe(true);

      inserirHabito(db, {
        nome: "Meditar",
        criadoEm: "2026-10-19",
        dias: [1, 2, 3, 4, 5, 6, 7],
      });
      await garantirRegistrosAte(db, "2026-10-19");

      const novaTarefa = await criarTarefaAvulsa(
        db,
        "2026-10-19",
        "Ligar para dentista",
        "2026-10-19",
      );
      expect(novaTarefa.ok).toBe(true);

      const ordemSalva = db
        .prepare("SELECT id FROM entries WHERE data = ? ORDER BY ordem ASC, id ASC")
        .all("2026-10-19") as Array<{ id: number }>;
      expect(ordemSalva.map((entrada) => entrada.id)).toEqual([
        ...novaOrdem,
        listarEntradas(db).find((entrada) => entrada.titulo === "Meditar")!.id,
        ...(novaTarefa.ok ? [novaTarefa.id] : []),
      ]);
    });

    it("recusa ids duplicados ou de outra data", async () => {
      const tarefaHoje = await criarTarefaAvulsa(
        db,
        "2026-10-19",
        "Hoje",
        "2026-10-19",
      );
      const tarefaOntem = await criarTarefaAvulsa(
        db,
        "2026-10-18",
        "Ontem",
        "2026-10-19",
      );
      if (!tarefaHoje.ok || !tarefaOntem.ok) throw new Error("Falha ao criar tarefas de teste.");

      expect(
        (await reordenarEntradas(
          db,
          "2026-10-19",
          [tarefaHoje.id, tarefaHoje.id],
          "2026-10-19",
        )).ok,
      ).toBe(false);
      expect(
        (await reordenarEntradas(
          db,
          "2026-10-19",
          [tarefaOntem.id],
          "2026-10-19",
        )).ok,
      ).toBe(false);
    });
  });

  it("permite tarefas futuras e recusa título vazio", async () => {
    const futura = await criarTarefaAvulsa(
      db,
      "2026-10-23",
      "Futuro",
      "2026-10-22",
    );
    expect(futura.ok).toBe(true);
    expect(
      (await criarTarefaAvulsa(db, "2026-10-20", "   ", "2026-10-22")).ok,
    ).toBe(false);
  });

  it("remove o hábito apenas naquela data e preserva outras datas", async () => {
    inserirHabito(db, {
      nome: "Leitura",
      criadoEm: "2026-11-01",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-11-08");
    const habitoDia7 = listarEntradas(db).find(
      (entrada) => entrada.data === "2026-11-07" && entrada.habit_id !== null,
    );
    expect(habitoDia7).toBeDefined();

    expect(
      (await excluirEntradaDoDia(db, habitoDia7!.id, "2026-11-07")).ok,
    ).toBe(true);

    expect(
      listarEntradas(db)
        .filter((entrada) => ["2026-11-06", "2026-11-07", "2026-11-08"].includes(entrada.data))
        .map((entrada) => entrada.data),
    ).toEqual(["2026-11-06", "2026-11-08"]);
  });

  it("não recria o hábito removido ao garantir o mesmo dia", async () => {
    inserirHabito(db, {
      nome: "Leitura",
      criadoEm: "2026-11-01",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-11-07");
    const habitoDia7 = listarEntradas(db).find(
      (entrada) => entrada.data === "2026-11-07" && entrada.habit_id !== null,
    );
    expect(habitoDia7).toBeDefined();

    expect(
      (await excluirEntradaDoDia(db, habitoDia7!.id, "2026-11-07")).ok,
    ).toBe(true);
    await garantirRegistrosDoDia(db, "2026-11-07");

    expect(
      listarEntradas(db).filter((entrada) => entrada.data === "2026-11-07"),
    ).toHaveLength(0);
  });

  it("mantém a geração em outras datas após a exclusão do hábito", async () => {
    inserirHabito(db, {
      nome: "Leitura",
      criadoEm: "2026-11-01",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-11-08");
    const habitoDia7 = listarEntradas(db).find(
      (entrada) => entrada.data === "2026-11-07" && entrada.habit_id !== null,
    );
    expect(habitoDia7).toBeDefined();

    expect(
      (await excluirEntradaDoDia(db, habitoDia7!.id, "2026-11-07")).ok,
    ).toBe(true);
    await garantirRegistrosDoDia(db, "2026-11-09");

    expect(
      listarEntradas(db).find(
        (entrada) => entrada.data === "2026-11-09" && entrada.habit_id !== null,
      ),
    ).toBeDefined();
  });

  it("continua excluindo tarefas avulsas normalmente", async () => {
    const tarefa = await criarTarefaAvulsa(
      db,
      "2026-10-20",
      "Comprar pão",
      "2026-10-22",
    );
    expect(tarefa.ok).toBe(true);
    if (!tarefa.ok) return;

    expect((await excluirTarefaAvulsa(db, tarefa.id)).ok).toBe(true);
    expect(listarEntradas(db)).toHaveLength(0);
  });

  it("recusa a exclusão quando a data não bate com a entrada", async () => {
    const tarefa = await criarTarefaAvulsa(
      db,
      "2026-10-20",
      "Comprar pão",
      "2026-10-22",
    );
    expect(tarefa.ok).toBe(true);
    if (!tarefa.ok) return;

    expect((await excluirEntradaDoDia(db, tarefa.id, "2026-10-19")).ok).toBe(false);
    expect(listarEntradas(db)).toHaveLength(1);
  });
});
