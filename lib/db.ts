import postgres from "postgres";
import { hojeSP } from "./dates";
import {
  definirMeta,
  garantirRegistrosAte,
  horarioVigente,
  listarHorarios,
  obterMeta,
} from "./records";
import type { Habito } from "./types";

export type SqlValue = string | number | bigint | null | Uint8Array;

export type SqlResult = {
  rows: Array<Record<string, unknown>>;
  rowsAffected: number;
  lastInsertRowid: number | bigint;
};

export interface DB {
  all<T>(sql: string, ...args: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, ...args: SqlValue[]): Promise<T | undefined>;
  run(sql: string, ...args: SqlValue[]): Promise<SqlResult>;
  transaction<T>(callback: (db: DB) => Promise<T>): Promise<T>;
  close(): void;
}

const DB_QUERY_TIMEOUT_MS = 20_000;

function operacaoSql(sql: string): string {
  const comando = sql.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i)?.[1]?.toUpperCase() ?? "SQL";
  const tabela = sql.match(/\b(?:FROM|INTO|UPDATE|TABLE)\s+([A-Za-z_][A-Za-z0-9_]*)/i)?.[1];
  return tabela ? `${comando} ${tabela}` : comando;
}

function codigoErro(erro: unknown): string {
  if (typeof erro !== "object" || erro === null || !("code" in erro)) {
    return "unknown";
  }
  const code = erro.code;
  return typeof code === "string" ? code : "unknown";
}

class SupabaseDB implements DB {
  constructor(private readonly client: postgres.Sql | postgres.TransactionSql) {}

  private async query(sql: string, args: SqlValue[], method: string) {
    const operation = `${method} ${operacaoSql(sql)}`;
    const startedAt = Date.now();
    console.info(`[DB_QUERY] start ${operation}`);

    try {
      const result = await this.client
        .unsafe(postgresPlaceholders(sql, args.length), args as never[])
        .signal(AbortSignal.timeout(DB_QUERY_TIMEOUT_MS));
      console.info(`[DB_QUERY] done ${operation} elapsed_ms=${Date.now() - startedAt}`);
      return result;
    } catch (erro) {
      console.error(
        `[DB_QUERY] failed ${operation} elapsed_ms=${Date.now() - startedAt} code=${codigoErro(erro)}`,
      );
      throw erro;
    }
  }

  async all<T>(sql: string, ...args: SqlValue[]): Promise<T[]> {
    const linhas = await this.query(sql, args, "all");
    return (Array.isArray(linhas) ? linhas : []) as T[];
  }

  async get<T>(sql: string, ...args: SqlValue[]): Promise<T | undefined> {
    const linhas = await this.query(sql, args, "get");
    return (Array.isArray(linhas) ? linhas[0] : undefined) as T | undefined;
  }

  async run(sql: string, ...args: SqlValue[]): Promise<SqlResult> {
    const consulta = prepararQueryInsert(sql);
    const resultado = await this.query(consulta, args, "run");
    const linhas = Array.isArray(resultado) ? resultado : [];
    const rowsAffected =
      typeof (resultado as { count?: number })?.count === "number"
        ? (resultado as { count: number }).count
        : linhas.length;
    const lastInsertRowid =
      /^\s*INSERT\b/i.test(sql)
        ? Number(
            (linhas[0] as Record<string, unknown> | undefined)?.id ??
              (linhas[0] as Record<string, unknown> | undefined)?.lastInsertRowid ??
              0,
          )
        : 0;

    return {
      rows: linhas as Array<Record<string, unknown>>,
      rowsAffected,
      lastInsertRowid,
    };
  }

  async transaction<T>(callback: (db: DB) => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    console.info("[DB_TX] start");
    try {
      const resultado = await this.client.begin(async (tx) =>
        callback(new SupabaseDB(tx)),
      );
      console.info(`[DB_TX] done elapsed_ms=${Date.now() - startedAt}`);
      return resultado;
    } catch (erro) {
      console.error(
        `[DB_TX] failed elapsed_ms=${Date.now() - startedAt} code=${codigoErro(erro)}`,
      );
      throw erro;
    }
  }

  close(): void {
    const client = this.client as unknown as {
      end?: (opts?: { timeout?: number }) => void;
    };
    if (typeof client.end === "function") {
      client.end({ timeout: 5 });
    }
  }
}

const SCHEMA_POSTGRES = `
CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  arquivado_em TEXT,
  criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habit_schedules (
  id SERIAL PRIMARY KEY,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  dias_da_semana TEXT NOT NULL,
  vigente_desde TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_schedules_habit
  ON habit_schedules(habit_id, vigente_desde);
CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL,
  habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1)),
  concluido_em TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'habito' CHECK (tipo IN ('habito', 'avulsa'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_entries_habit_data
  ON entries(habit_id, data) WHERE habit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_entries_data ON entries(data);
CREATE TABLE IF NOT EXISTS habit_entries_removed (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  PRIMARY KEY (habit_id, data)
);
CREATE TABLE IF NOT EXISTS app_meta (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dias_extras (
  data TEXT PRIMARY KEY,
  criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dias_removidos (
  data TEXT PRIMARY KEY,
  removido_em TEXT NOT NULL
);
`;

function prepararQueryInsert(sql: string): string {
  const consulta = sql.trim();
  if (!/^INSERT\s+/i.test(consulta) || /\bRETURNING\b/i.test(consulta)) {
    return consulta;
  }

  const tabela = consulta.match(/^INSERT\s+INTO\s+([A-Za-z0-9_]+)/i)?.[1]?.toLowerCase();
  if (tabela && ["habits", "habit_schedules", "entries"].includes(tabela)) {
    return `${consulta} RETURNING id`;
  }

  return consulta;
}

function postgresPlaceholders(sql: string, quantidade: number): string {
  let indice = 0;
  const consulta = sql.replace(/\?/g, () => {
    indice += 1;
    return `$${indice}`;
  });
  if (indice !== quantidade) {
    throw new Error(
      `A consulta SQL espera ${indice} parâmetros, mas recebeu ${quantidade}.`,
    );
  }
  return consulta;
}

function criarBanco(): DB {
  const urlBanco = process.env.SUPABASE_DB_URL;
  if (!urlBanco) {
    throw new Error("Configure SUPABASE_DB_URL para conectar ao Supabase.");
  }

  return new SupabaseDB(
    postgres(urlBanco, {
      ssl: "require",
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
      queue_timeout: 10,
      prepare: false,
      connection: {
        statement_timeout: 15_000,
        lock_timeout: 5_000,
        idle_in_transaction_session_timeout: 15_000,
      },
    }),
  );
}

async function inicializarBanco(db: DB): Promise<void> {
  const startedAt = Date.now();
  console.info("[DB_INIT] start");
  try {
    await db.transaction(async (tx) => {
      await tx.get("SELECT pg_advisory_xact_lock(1296388931, 1)");

      for (const statement of SCHEMA_POSTGRES.split(";").map((sql) => sql.trim()).filter(Boolean)) {
        await tx.run(statement);
      }

      const colunasEntradas = await tx.all<{ name: string }>(
        `SELECT column_name AS name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'entries'`,
      );
      if (!colunasEntradas.some((coluna: { name: string }) => coluna.name === "ordem")) {
        await tx.run(
          "ALTER TABLE entries ADD COLUMN ordem INTEGER NOT NULL DEFAULT 0",
        );
      }
      if (!colunasEntradas.some((coluna: { name: string }) => coluna.name === "descricao")) {
        await tx.run(
          "ALTER TABLE entries ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT ''",
        );
      }

      const colunasHabits = await tx.all<{ name: string }>(
        `SELECT column_name AS name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'habits'`,
      );
      if (!colunasHabits.some((coluna: { name: string }) => coluna.name === "descricao")) {
        await tx.run(
          "ALTER TABLE habits ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT ''",
        );
      }

      const hoje = hojeSP();
      await migrarHabitosParaTodosOsDias(tx, hoje);
      await garantirRegistrosAte(tx, hoje);
    });
    console.info(`[DB_INIT] done elapsed_ms=${Date.now() - startedAt}`);
  } catch (erro) {
    console.error(
      `[DB_INIT] failed elapsed_ms=${Date.now() - startedAt} code=${codigoErro(erro)}`,
    );
    throw erro;
  }
}

const TODOS_OS_DIAS = "1,2,3,4,5,6,7";

async function migrarHabitosParaTodosOsDias(
  db: DB,
  hoje: string,
): Promise<void> {
  const habitos = await db.all<Habito>(
    "SELECT * FROM habits WHERE arquivado_em IS NULL ORDER BY id ASC",
  );

  await db.transaction(async (tx) => {
    for (const habito of habitos) {
      if (habito.criado_em > hoje) continue;

      const vigente = horarioVigente(
        await listarHorarios(tx, habito.id),
        hoje,
      );
      if (vigente?.dias_da_semana === TODOS_OS_DIAS) continue;

      await tx.run(
        `INSERT INTO habit_schedules (habit_id, dias_da_semana, vigente_desde)
         VALUES (?, ?, ?)`,
        habito.id,
        TODOS_OS_DIAS,
        hoje,
      );
    }
  });
}

export async function semearExemplo(db: DB, hoje: string): Promise<void> {
  await db.transaction(async (tx) => {
    if (await obterMeta(tx, "seed_feito")) return;

    const total = await tx.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM habits",
    );
    if ((total?.total ?? 0) > 0) {
      await definirMeta(tx, "seed_feito", "1");
      return;
    }

    for (const nome of ["Estudar 4 blocos", "Fazer almoço"]) {
      const resultado = await tx.run(
        "INSERT INTO habits (nome, criado_em) VALUES (?, ?)",
        nome,
        hoje,
      );
      await tx.run(
        `INSERT INTO habit_schedules (habit_id, dias_da_semana, vigente_desde)
         VALUES (?, ?, ?)`,
        Number(resultado.lastInsertRowid),
        TODOS_OS_DIAS,
        hoje,
      );
    }
    await definirMeta(tx, "seed_feito", "1");
  });
}

const globalComBanco = globalThis as typeof globalThis & {
  __controleHabitosDb?: Promise<DB>;
};

export async function getDb(): Promise<DB> {
  if (!globalComBanco.__controleHabitosDb) {
    const db = criarBanco();
    globalComBanco.__controleHabitosDb = inicializarBanco(db)
      .then(() => db)
      .catch((erro: unknown) => {
        db.close();
        throw erro;
      });
  }
  const inicializacao = globalComBanco.__controleHabitosDb;
  try {
    return await inicializacao;
  } catch (erro) {
    if (globalComBanco.__controleHabitosDb === inicializacao) {
      globalComBanco.__controleHabitosDb = undefined;
    }
    throw erro;
  }
}

export async function prepararApp(): Promise<DB> {
  const db = await getDb();
  await garantirRegistrosAte(db, hojeSP());
  return db;
}
