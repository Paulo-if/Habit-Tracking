const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const postgres = require("postgres");

const TABELAS = [
  "habits",
  "habit_schedules",
  "entries",
  "app_meta",
  "dias_extras",
  "dias_removidos",
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
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
  concluido INTEGER NOT NULL DEFAULT 0 CHECK (concluido IN (0, 1)),
  concluido_em TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'habito' CHECK (tipo IN ('habito', 'avulsa'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_entries_habit_data
  ON entries(habit_id, data) WHERE habit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_entries_data ON entries(data);
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
ALTER TABLE entries ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0;
`;

function encontrarBackup() {
  const pasta = path.join(os.homedir(), "Desktop", "backup-habitos");
  if (!fs.existsSync(pasta)) {
    throw new Error(`Pasta de backup não encontrada: ${pasta}`);
  }

  const backups = fs
    .readdirSync(pasta, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".db"))
    .map((entry) => {
      const file = path.join(pasta, entry.name);
      return { file, modified: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified);

  if (backups.length === 0) {
    throw new Error(`Nenhum arquivo .db encontrado em ${pasta}`);
  }
  return backups[0].file;
}

function contarOrigem(database) {
  const tabelasOrigem = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  const ausentes = TABELAS.filter((table) => !tabelasOrigem.has(table));
  if (ausentes.length > 0) {
    throw new Error(
      `O backup não contém as tabelas esperadas: ${ausentes.join(", ")}`,
    );
  }

  return Object.fromEntries(
    TABELAS.map((table) => [
      table,
      database.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get().total,
    ]),
  );
}

async function criarSchema(transaction) {
  for (const statement of SCHEMA.split(";").map((sql) => sql.trim()).filter(Boolean)) {
    await transaction.unsafe(statement);
  }
}

async function contarDestino(transaction) {
  const contagens = {};
  for (const table of TABELAS) {
    const [row] = await transaction.unsafe(
      `SELECT COUNT(*)::bigint AS total FROM "${table}"`,
    );
    contagens[table] = Number(row.total);
  }
  return contagens;
}

function conferirDestinoVazio(contagens) {
  const ocupadas = Object.entries(contagens).filter(([, total]) => total > 0);
  if (ocupadas.length > 0) {
    throw new Error(
      `Migração cancelada: o destino já contém dados (${ocupadas
        .map(([table, total]) => `${table}=${total}`)
        .join(", ")}). Nenhuma linha foi inserida.`,
    );
  }
}

async function inserirTabela(transaction, database, table) {
  const colunas = database
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .map((column) => column.name);
  const linhas = database.prepare(`SELECT * FROM "${table}"`).all();

  for (const linha of linhas) {
    const colunasLinha = colunas.filter((column) =>
      Object.prototype.hasOwnProperty.call(linha, column),
    );
    const placeholders = colunasLinha.map((_, index) => `$${index + 1}`);
    const quotedColumns = colunasLinha.map((column) => `"${column}"`).join(", ");
    const values = colunasLinha.map((column) => linha[column]);

    await transaction.unsafe(
      `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders.join(", ")})`,
      values,
    );
  }
}

async function ajustarSequencias(transaction) {
  for (const table of ["habits", "habit_schedules", "entries"]) {
    await transaction.unsafe(
      `SELECT setval(
         pg_get_serial_sequence('${table}', 'id'),
         COALESCE(MAX(id), 1),
         COUNT(*) > 0
       )
       FROM "${table}"`,
    );
  }
}

async function main() {
  const backup = encontrarBackup();
  const database = new Database(backup, {
    readonly: true,
    fileMustExist: true,
  });
  let connection;

  try {
    const origem = contarOrigem(database);
    console.log(`Backup SQLite (somente leitura): ${backup}`);
    console.log("Linhas na origem:");
    for (const table of TABELAS) console.log(`  ${table}: ${origem[table]}`);

    if (process.argv.includes("--check-source")) return;
    if (!process.env.SUPABASE_DB_URL) {
      throw new Error("Defina SUPABASE_DB_URL no ambiente antes de migrar.");
    }

    connection = postgres(process.env.SUPABASE_DB_URL, {
      ssl: "require",
      max: 1,
      prepare: false,
    });

    const destino = await connection.begin(async (transaction) => {
      await criarSchema(transaction);
      const antes = await contarDestino(transaction);
      conferirDestinoVazio(antes);

      for (const table of TABELAS) {
        await inserirTabela(transaction, database, table);
      }
      await ajustarSequencias(transaction);

      return contarDestino(transaction);
    });

    console.log("Linhas no destino após migração:");
    for (const table of TABELAS) {
      console.log(
        `  ${table}: origem=${origem[table]} destino=${destino[table]} ${
          origem[table] === destino[table] ? "OK" : "DIVERGENTE"
        }`,
      );
    }

    if (TABELAS.some((table) => origem[table] !== destino[table])) {
      process.exitCode = 1;
    }
  } finally {
    database.close();
    if (connection) await connection.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const secret = process.env.SUPABASE_DB_URL;
  const message = String(error?.message ?? error)
    .replace(secret ?? "\u0000", "[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED CONNECTION STRING]");
  console.error(`Migração falhou: ${message}`);
  process.exitCode = 1;
});
