import Database from "better-sqlite3";
import type { DB, SqlResult, SqlValue } from "../lib/db";
import type { Entrada } from "../lib/types";

const SCHEMA = `
CREATE TABLE habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  arquivado_em TEXT,
  criado_em TEXT NOT NULL
);
CREATE TABLE habit_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id),
  dias_da_semana TEXT NOT NULL,
  vigente_desde TEXT NOT NULL
);
CREATE INDEX ix_schedules_habit ON habit_schedules(habit_id, vigente_desde);
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  habit_id INTEGER REFERENCES habits(id),
  titulo TEXT NOT NULL,
  concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1)),
  concluido_em TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'habito' CHECK (tipo IN ('habito', 'avulsa'))
);
CREATE UNIQUE INDEX ux_entries_habit_data
  ON entries(habit_id, data) WHERE habit_id IS NOT NULL;
CREATE INDEX ix_entries_data ON entries(data);
CREATE TABLE app_meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE dias_extras (data TEXT PRIMARY KEY, criado_em TEXT NOT NULL);
CREATE TABLE dias_removidos (data TEXT PRIMARY KEY, removido_em TEXT NOT NULL);
`;

export class TestDB implements DB {
  private readonly database: Database.Database;

  constructor() {
    this.database = new Database(":memory:");
    this.database.pragma("foreign_keys = ON");
    this.database.exec(SCHEMA);
  }

  async all<T>(sql: string, ...args: SqlValue[]): Promise<T[]> {
    return this.database.prepare(sql).all(...args) as T[];
  }

  async get<T>(sql: string, ...args: SqlValue[]): Promise<T | undefined> {
    return this.database.prepare(sql).get(...args) as T | undefined;
  }

  async run(sql: string, ...args: SqlValue[]): Promise<SqlResult> {
    const result = this.database.prepare(sql).run(...args);
    return {
      rows: [],
      rowsAffected: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  async transaction<T>(callback: (db: DB) => Promise<T>): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const resultado = await callback(this);
      this.database.exec("COMMIT");
      return resultado;
    } catch (erro) {
      this.database.exec("ROLLBACK");
      throw erro;
    }
  }

  close(): void {
    this.database.close();
  }

  prepare(sql: string): Database.Statement {
    return this.database.prepare(sql);
  }
}

export async function bancoDeTeste(): Promise<TestDB> {
  return new TestDB();
}

export function inserirHabito(
  db: TestDB,
  opcoes: {
    nome: string;
    criadoEm: string;
    dias: number[];
    vigenteDesde?: string;
  },
): number {
  const id = Number(
    db
      .prepare("INSERT INTO habits (nome, criado_em) VALUES (?, ?)")
      .run(opcoes.nome, opcoes.criadoEm).lastInsertRowid,
  );

  db.prepare(
    `INSERT INTO habit_schedules (habit_id, dias_da_semana, vigente_desde)
     VALUES (?, ?, ?)`,
  ).run(id, opcoes.dias.join(","), opcoes.vigenteDesde ?? opcoes.criadoEm);

  return id;
}

export function listarEntradas(db: TestDB): Entrada[] {
  return db
    .prepare("SELECT * FROM entries ORDER BY data ASC, id ASC")
    .all() as Entrada[];
}

export function datasDasEntradas(db: TestDB): string[] {
  return listarEntradas(db).map((entrada) => entrada.data);
}
