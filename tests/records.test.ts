import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { garantirRegistrosAte, garantirRegistrosDoDia } from "../lib/records";
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

describe("garantirRegistrosAte", () => {
  it("é idempotente: chamar duas vezes não duplica", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");
    const quantidade = listarEntradas(db).length;
    expect(quantidade).toBe(3);

    await garantirRegistrosAte(db, "2026-10-21");
    await garantirRegistrosAte(db, "2026-10-21");
    expect(listarEntradas(db)).toHaveLength(quantidade);
    expect(new Set(datasDasEntradas(db)).size).toBe(quantidade);
  });

  it("não gera registros antes de o hábito existir", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-22",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-25");

    expect(datasDasEntradas(db)).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("começa em max(criado_em, primeiro schedule)", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-22",
      vigenteDesde: "2026-10-01",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-23");

    expect(datasDasEntradas(db)).toEqual(["2026-10-22", "2026-10-23"]);
  });

  it("preenche só o buraco quando fico dias sem abrir", async () => {
    inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-20");
    expect(datasDasEntradas(db)).toEqual(["2026-10-19", "2026-10-20"]);

    await garantirRegistrosAte(db, "2026-10-23");
    expect(datasDasEntradas(db)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
    ]);
  });

  it("hábito criado depois não ganha histórico retroativo", async () => {
    inserirHabito(db, {
      nome: "Antigo",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-20");

    const novo = inserirHabito(db, {
      nome: "Novo",
      criadoEm: "2026-10-21",
      dias: [1, 2, 3, 4, 5, 6, 7],
    });

    await garantirRegistrosAte(db, "2026-10-21");

    const doNovo = listarEntradas(db).filter((e) => e.habit_id === novo);
    expect(doNovo.map((e) => e.data)).toEqual(["2026-10-21"]);
  });

  it("só cria nos dias da semana da regra vigente", async () => {
    inserirHabito(db, {
      nome: "Estudar",
      criadoEm: "2026-10-19",
      dias: [1, 2, 3, 4, 5], // seg a sex
    });

    await garantirRegistrosAte(db, "2026-10-25");

    expect(datasDasEntradas(db)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
    ]);
  });
});

describe("garantirRegistrosDoDia", () => {
  it("também é idempotente", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-22",
      dias: [4],
    });

    await garantirRegistrosDoDia(db, "2026-10-22");
    await garantirRegistrosDoDia(db, "2026-10-22", [id]);
    await garantirRegistrosDoDia(db, "2026-10-22", [id]);

    expect(listarEntradas(db)).toHaveLength(1);
  });

  it("não recria um hábito removido em uma data específica", async () => {
    const id = inserirHabito(db, {
      nome: "Ler",
      criadoEm: "2026-10-22",
      dias: [4],
    });

    await garantirRegistrosDoDia(db, "2026-10-22");
    await db.run("DELETE FROM entries WHERE habit_id = ? AND data = ?", id, "2026-10-22");
    await db.run(
      "INSERT INTO habit_entries_removed (habit_id, data) VALUES (?, ?)",
      id,
      "2026-10-22",
    );

    await garantirRegistrosDoDia(db, "2026-10-22");

    expect(
      listarEntradas(db).filter(
        (entrada) => entrada.habit_id === id && entrada.data === "2026-10-22",
      ),
    ).toHaveLength(0);
  });
});
