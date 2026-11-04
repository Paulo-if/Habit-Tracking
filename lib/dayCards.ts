import type { DB } from "./db";
import {
  adicionarDias,
  dataValida,
  diasDaSemana,
  hojeSP,
  inicioDaSemana,
  janelaDeSeteDias,
} from "./dates";
import { garantirRegistrosDoDia } from "./records";
import type { ResultadoAcao } from "./types";

export const MAX_DIAS_POR_VEZ = 366;

async function inserirExtra(db: DB, data: string, hoje: string): Promise<void> {
  await db.run(
    `INSERT INTO dias_extras (data, criado_em)
     SELECT ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM dias_extras WHERE data = ?
     )
     ON CONFLICT DO NOTHING`,
    data,
    hoje,
    data,
  );
  await db.run("DELETE FROM dias_removidos WHERE data = ?", data);
}

export async function criarCard(
  db: DB,
  data: string,
  hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };

  await db.transaction((tx) => inserirExtra(tx, data, hoje));
  await garantirRegistrosDoDia(db, data);
  return { ok: true };
}

export async function criarCards(
  db: DB,
  inicio: string,
  quantidade: number,
  hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  if (!dataValida(inicio)) return { ok: false, erro: "Data inicial inválida." };
  if (
    !Number.isInteger(quantidade) ||
    quantidade < 1 ||
    quantidade > MAX_DIAS_POR_VEZ
  ) {
    return {
      ok: false,
      erro: `Escolha de 1 a ${MAX_DIAS_POR_VEZ} dias.`,
    };
  }

  const datas: string[] = [];
  let data = inicio;
  for (let i = 0; i < quantidade; i++) {
    datas.push(data);
    data = adicionarDias(data, 1);
  }

  await db.transaction(async (tx) => {
    for (const dia of datas) await inserirExtra(tx, dia, hoje);
  });
  for (const dia of datas) {
    await garantirRegistrosDoDia(db, dia);
  }
  return { ok: true };
}

export async function removerCard(
  db: DB,
  data: string,
  hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };

  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM entries WHERE data = ?", data);
    await tx.run("DELETE FROM dias_extras WHERE data = ?", data);
    await tx.run(
      `INSERT INTO dias_removidos (data, removido_em) VALUES (?, ?)
       ON CONFLICT(data) DO UPDATE SET removido_em = excluded.removido_em`,
      data,
      hoje,
    );
  });
  return { ok: true };
}

export async function listarDatasVisiveis(
  db: DB,
  hoje: string = hojeSP(),
): Promise<string[]> {
  const datas = new Set(diasDaSemana(inicioDaSemana(hoje)));
  const extras = await db.all<{ data: string }>(
    "SELECT data FROM dias_extras ORDER BY data ASC",
  );
  for (const extra of extras) {
    if (dataValida(extra.data)) datas.add(extra.data);
  }

  const removidos = new Set(
    (await db.all<{ data: string }>("SELECT data FROM dias_removidos")).map(
      (linha) => linha.data,
    ),
  );
  return [...datas].filter((data) => !removidos.has(data)).sort();
}

export async function listarDatasGrade(
  db: DB,
  hoje: string = hojeSP(),
): Promise<string[]> {
  const removidos = new Set(
    (await db.all<{ data: string }>("SELECT data FROM dias_removidos")).map(
      (linha) => linha.data,
    ),
  );
  return janelaDeSeteDias(hoje).filter((data) => !removidos.has(data));
}

export async function cardExiste(
  db: DB,
  data: string,
  hoje: string = hojeSP(),
): Promise<boolean> {
  if (await db.get("SELECT 1 FROM dias_removidos WHERE data = ?", data)) {
    return false;
  }
  if (data >= hoje && data <= adicionarDias(hoje, 6)) return true;

  return Boolean(
    await db.get(
      `SELECT 1 FROM dias_extras WHERE data = ?
       UNION SELECT 1 FROM entries WHERE data = ?
       LIMIT 1`,
      data,
      data,
    ),
  );
}
